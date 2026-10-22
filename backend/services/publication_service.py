"""
MarketMind Voice — Programar y publicar campañas aprobadas en Meta.

Flujo:
1. Al enviar al cliente, el marketero elige destinos → Publication en
   'esperando_aprobacion' (programar_publicaciones). Una sola por cuenta de
   Meta: si cliente y marketero conectaron la misma, se usa la del cliente.
2. Cuando el cliente aprueba en Spring, Spring avisa a Django tras su commit
   → publicar_campana_aprobada congela copy + imagen y publica.
3. Si algo falla, el marketero puede reintentar (reintentar_publicacion).

Garantías (verificadas con tests, no con Meta real):
- Una publicación se reclama con bloqueo de fila: dos avisos simultáneos no
  publican dos veces.
- Se publica el contenido congelado al aprobar, no el actual de la campaña.
- Un reintento no publica a ciegas: en Instagram primero se consulta el
  contenedor del intento anterior (su id se guarda en cuanto se crea); en
  Facebook, y en Instagram sin contenedor, se busca en la cuenta un post con
  el mismo texto desde que se programó.
- Si el contenedor ya quedó publicado se recupera el id del post buscando el
  caption en los media recientes (la API no lo expone en el contenedor). Si no
  se encuentra exactamente uno, queda 'publicado' sin enlace y con un aviso.
- Si el proceso muere a mitad, la publicación queda en 'publicando'; pasado
  MARGEN_ATASCADA el marketero puede reintentarla con las mismas comprobaciones.
- La llamada a Meta ocurre fuera de la transacción.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignStatus
from apps.social.models import (
    REDES_META,
    ConexionEstado,
    PublicacionEstado,
    Publication,
    RedSocial,
    SocialConnection,
)
from services import meta_graph, public_media
from services.social_tokens import TokenIlegible, descifrar

logger = logging.getLogger(__name__)

MAX_INTENTOS = 3
# Un intento tarda segundos (≈30 s como máximo esperando a Instagram). Pasado
# este margen se asume que el proceso que lo reclamó murió.
MARGEN_ATASCADA = timedelta(minutes=5)
AVISO_SIN_ID = (
    "Instagram confirma que se publicó, pero no se pudo identificar el post: "
    "no hay enlace ni estadísticas. Revísalo en la cuenta."
)


class DestinoInvalido(Exception):
    pass


class PublicacionNoPermitida(Exception):
    pass


def conexiones_disponibles(marketero: User, cliente_email: str | None) -> list[SocialConnection]:
    """
    Cuentas activas de Meta donde se publica al aprobar: las del cliente y las del marketero.
    X nunca entra aquí: su texto es una variante aparte que el cliente aprueba (ver x_publication_service).
    """
    filtro = Q(usuario=marketero)
    if cliente_email:
        filtro |= Q(usuario__email__iexact=cliente_email, usuario__rol=UserRole.CLIENTE)
    return list(
        SocialConnection.objects.filter(filtro, estado=ConexionEstado.ACTIVA, red__in=REDES_META)
        .select_related("usuario")
    )


def _es_del_cliente(conexion: SocialConnection, cliente_email: str | None) -> bool:
    return (
        bool(cliente_email)
        and conexion.usuario.rol == UserRole.CLIENTE
        and conexion.usuario.email.lower() == cliente_email.lower()
    )


def una_por_cuenta(conexiones: list[SocialConnection], cliente_email: str | None) -> list[SocialConnection]:
    """
    Una conexión por cuenta de Meta (red + id externo), en el orden recibido.
    Si cliente y marketero conectaron la misma cuenta, gana la del cliente (su dueño).
    """
    elegidas: dict[tuple[str, str], SocialConnection] = {}
    for conexion in conexiones:
        clave = (conexion.red, conexion.cuenta_id)
        actual = elegidas.get(clave)
        if actual is None or (
            _es_del_cliente(conexion, cliente_email) and not _es_del_cliente(actual, cliente_email)
        ):
            elegidas[clave] = conexion
    return list(elegidas.values())


def programar_publicaciones(campaign: Campaign, conexion_ids: list[int], marketero: User) -> list[Publication]:
    """
    Crea (o reutiliza) una Publication por cuenta de Meta elegida. Llamar dentro
    de la transacción de submit. Dos conexiones a la misma cuenta (del cliente y
    del marketero) generan una sola publicación: nunca dos posts iguales.
    """
    if not conexion_ids:
        return []
    if SocialConnection.objects.filter(id__in=conexion_ids).exclude(red__in=REDES_META).exists():
        raise DestinoInvalido(
            "X y TikTok no se publican al aprobar: cuando la campaña esté aprobada, prepara su "
            "versión para X o envíala al buzón de TikTok."
        )
    permitidas = {c.id: c for c in conexiones_disponibles(marketero, campaign.cliente_email)}
    desconocidas = [cid for cid in conexion_ids if cid not in permitidas]
    if desconocidas:
        raise DestinoInvalido(
            "Alguna cuenta destino no existe, está desconectada o no pertenece al cliente ni al marketero."
        )
    elegidas = una_por_cuenta([permitidas[cid] for cid in dict.fromkeys(conexion_ids)], campaign.cliente_email)
    publicaciones = []
    for conexion in elegidas:
        existente = (
            Publication.objects.filter(campaign=campaign, red=conexion.red, cuenta_id=conexion.cuenta_id).first()
            or Publication.objects.filter(campaign=campaign, conexion=conexion).first()
        )
        if existente is None:
            existente = Publication.objects.create(
                campaign=campaign,
                conexion=conexion,
                red=conexion.red,
                cuenta_id=conexion.cuenta_id,
                cuenta_nombre=conexion.cuenta_nombre,
                solicitada_por=marketero,
            )
        publicaciones.append(existente)
    return publicaciones


@dataclass
class ResumenPublicacion:
    publicadas: int = 0
    fallidas: int = 0
    omitidas: int = 0


def publicar_campana_aprobada(campaign_id: int) -> ResumenPublicacion:
    """Publica todas las publicaciones pendientes de una campaña aprobada. Idempotente."""
    resumen = ResumenPublicacion()
    ids = list(
        Publication.objects.filter(
            campaign_id=campaign_id, estado=PublicacionEstado.ESPERANDO_APROBACION, red__in=REDES_META
        )
        .values_list("id", flat=True)
    )
    for publication_id in ids:
        resultado = _publicar(publication_id, desde=(PublicacionEstado.ESPERANDO_APROBACION,))
        setattr(resumen, resultado, getattr(resumen, resultado) + 1)
    return resumen


def publicacion_atascada(publicacion: Publication) -> bool:
    """'publicando' desde hace más de MARGEN_ATASCADA: el proceso que la reclamó murió."""
    if publicacion.estado != PublicacionEstado.PUBLICANDO:
        return False
    desde = publicacion.publicando_desde or publicacion.fecha_actualizacion
    return desde is not None and timezone.now() - desde > MARGEN_ATASCADA


def reintentar_publicacion(publication: Publication, usuario: User) -> Publication:
    """'Publicar ahora / Reintentar' del marketero dueño de la campaña."""
    if publication.campaign.marketero_id != usuario.id:
        raise PublicacionNoPermitida("Solo el marketero de la campaña puede publicarla.")
    if publication.red == RedSocial.X:
        raise PublicacionNoPermitida(
            "Las publicaciones en X se hacen desde la versión para X de la campaña, confirmando el costo."
        )
    if publication.red == RedSocial.TIKTOK:
        raise PublicacionNoPermitida(
            "Los envíos a TikTok no se reintentan: consulta su estado o revisa tu buzón de TikTok."
        )
    if publication.campaign.estado != CampaignStatus.APROBADO:
        raise PublicacionNoPermitida("La campaña todavía no fue aprobada por el cliente.")
    atascada = publicacion_atascada(publication)
    if publication.estado == PublicacionEstado.PUBLICANDO and not atascada:
        minutos = int(MARGEN_ATASCADA.total_seconds() // 60)
        raise PublicacionNoPermitida(
            f"La publicación se está procesando. Si en {minutos} minutos sigue igual, podrás reintentarla."
        )
    if publication.estado not in (
        PublicacionEstado.FALLIDO,
        PublicacionEstado.ESPERANDO_APROBACION,
        PublicacionEstado.PUBLICANDO,
    ):
        raise PublicacionNoPermitida(f"La publicación está '{publication.estado}' y no se puede reintentar.")
    # Una atascada siempre se puede revisar: su intento ya contó y quedó sin resultado.
    if not atascada and publication.intentos >= MAX_INTENTOS:
        raise PublicacionNoPermitida("Se alcanzó el máximo de intentos. Revisa la cuenta conectada.")
    _publicar(
        publication.id,
        desde=(PublicacionEstado.FALLIDO, PublicacionEstado.ESPERANDO_APROBACION),
        recuperar_atascada=True,
    )
    publication.refresh_from_db()
    return publication


def _publicar(publication_id: int, desde: tuple[str, ...], recuperar_atascada: bool = False) -> str:
    """Reclama la publicación con bloqueo, publica fuera de la transacción y guarda el resultado."""
    with transaction.atomic():
        # of=("self",): PostgreSQL no permite FOR UPDATE sobre el lado nulo del
        # LEFT JOIN de conexion; basta con bloquear la fila de la publicación.
        publicacion = (
            Publication.objects.select_for_update(of=("self",))
            .select_related("campaign", "conexion")
            .filter(pk=publication_id)
            .first()
        )
        if publicacion is None:
            return "omitidas"
        if publicacion.estado == PublicacionEstado.PUBLICANDO:
            # Solo se retoma una atascada; una reciente sigue en manos de otro proceso.
            if not (recuperar_atascada and publicacion_atascada(publicacion)):
                return "omitidas"
        elif publicacion.estado not in desde:
            return "omitidas"
        campaign = publicacion.campaign
        if campaign.estado != CampaignStatus.APROBADO:
            return "omitidas"

        # Congelar lo aprobado solo la primera vez: un reintento publica lo mismo.
        if publicacion.version_aprobada is None:
            publicacion.copy_aprobado = campaign.texto_generado
            publicacion.imagen_aprobada_b64 = campaign.imagen_b64
            publicacion.version_aprobada = campaign.version
        reintento = publicacion.intentos > 0
        publicacion.estado = PublicacionEstado.PUBLICANDO
        publicacion.publicando_desde = timezone.now()
        publicacion.intentos += 1
        publicacion.error = ""
        publicacion.save()

    conexion = publicacion.conexion
    try:
        if conexion is None or conexion.estado != ConexionEstado.ACTIVA:
            raise meta_graph.MetaError("La cuenta destino fue desconectada. Vuelve a conectarla.")
        token = descifrar(conexion.token_cifrado)
        resultado = _enviar_a_meta(publicacion, conexion, token, reintento)
    except (meta_graph.MetaError, TokenIlegible) as exc:
        _marcar_fallida(publicacion, exc)
        return "fallidas"

    Publication.objects.filter(pk=publicacion.pk).update(
        estado=PublicacionEstado.PUBLICADO,
        externo_id=resultado.externo_id,
        permalink=resultado.permalink,
        contenedor_id=resultado.contenedor_id or publicacion.contenedor_id,
        error=resultado.aviso[:1000],
        publicado_at=timezone.now(),
        fecha_actualizacion=timezone.now(),
    )
    logger.info("Publicación %s publicada en %s (%s)", publicacion.pk, publicacion.red, resultado.externo_id)
    return "publicadas"


def _enviar_a_meta(
    publicacion: Publication, conexion: SocialConnection, token: str, reintento: bool
) -> meta_graph.ResultadoPublicacion:
    if publicacion.red == RedSocial.INSTAGRAM:
        if publicacion.contenedor_id:
            # Un intento anterior creó un contenedor: su estado dice si ya salió.
            estado = meta_graph.estado_contenedor(publicacion.contenedor_id, token)
            if estado == "PUBLISHED":
                return _recuperar_publicado(publicacion, conexion, token)
            if estado in ("FINISHED", "IN_PROGRESS"):
                return meta_graph.publicar_contenedor(conexion.cuenta_id, token, publicacion.contenedor_id)
            # ERROR, EXPIRED o desconocido: ese contenedor no publicó nada; se crea otro.
        elif reintento:
            encontrado = _buscar_ya_publicada(publicacion, conexion, token)
            if encontrado:
                return encontrado

        def guardar_contenedor(contenedor_id: str) -> None:
            Publication.objects.filter(pk=publicacion.pk).update(contenedor_id=contenedor_id)

        imagen_url = public_media.url_publica(publicacion.pk)
        return meta_graph.publicar_instagram(
            conexion.cuenta_id, token, imagen_url, publicacion.copy_aprobado,
            al_crear_contenedor=guardar_contenedor,
        )

    # Facebook publica en una sola llamada: si un intento anterior quedó en duda,
    # se busca el post en la página antes de volver a publicar.
    if reintento:
        encontrado = _buscar_ya_publicada(publicacion, conexion, token)
        if encontrado:
            return encontrado
    imagen_url = public_media.url_publica(publicacion.pk)
    return meta_graph.publicar_facebook(conexion.pagina_id, token, imagen_url, publicacion.copy_aprobado)


def _buscar(
    publicacion: Publication, conexion: SocialConnection, token: str
) -> meta_graph.ResultadoPublicacion | None:
    """Post de la cuenta con el copy aprobado, publicado desde que se programó y no usado por otra publicación."""
    desde = publicacion.fecha_creacion - timedelta(minutes=1)
    excluir = list(
        Publication.objects.filter(red=publicacion.red, cuenta_id=conexion.cuenta_id)
        .exclude(pk=publicacion.pk)
        .exclude(externo_id="")
        .values_list("externo_id", flat=True)
    )
    if publicacion.red == RedSocial.INSTAGRAM:
        return meta_graph.buscar_publicacion_instagram(
            conexion.cuenta_id, token, publicacion.copy_aprobado, desde, excluir
        )
    return meta_graph.buscar_publicacion_facebook(
        conexion.pagina_id, token, publicacion.copy_aprobado, desde, excluir
    )


def _buscar_ya_publicada(
    publicacion: Publication, conexion: SocialConnection, token: str
) -> meta_graph.ResultadoPublicacion | None:
    """Reintento sin contenedor que consultar: ¿el intento anterior llegó a publicar?"""
    try:
        encontrado = _buscar(publicacion, conexion, token)
    except meta_graph.MetaError as exc:
        # Sin poder comprobarlo se publica igual: es lo que pidió el marketero al reintentar.
        logger.warning("Publicación %s: no se pudo comprobar si ya estaba en la red: %s", publicacion.pk, exc)
        return None
    if encontrado:
        logger.info(
            "Publicación %s ya estaba en %s (%s): no se repite",
            publicacion.pk, publicacion.red, encontrado.externo_id,
        )
    return encontrado


def _recuperar_publicado(
    publicacion: Publication, conexion: SocialConnection, token: str
) -> meta_graph.ResultadoPublicacion:
    """El contenedor ya está PUBLISHED: se busca el id del post; si no aparece, se avisa sin inventarlo."""
    try:
        encontrado = _buscar(publicacion, conexion, token)
    except meta_graph.MetaError as exc:
        logger.warning("Publicación %s publicada, pero no se pudo buscar su id: %s", publicacion.pk, exc)
        encontrado = None
    if encontrado:
        encontrado.contenedor_id = publicacion.contenedor_id
        return encontrado
    return meta_graph.ResultadoPublicacion(
        externo_id="", permalink="", contenedor_id=publicacion.contenedor_id, aviso=AVISO_SIN_ID
    )


def _marcar_fallida(publicacion: Publication, exc: Exception) -> None:
    mensaje = str(exc)
    if isinstance(exc, meta_graph.MetaError) and exc.ambiguo:
        mensaje += " El resultado es incierto: revisa la cuenta antes de reintentar."
    if isinstance(exc, meta_graph.MetaError) and exc.token_invalido and publicacion.conexion_id:
        SocialConnection.objects.filter(pk=publicacion.conexion_id).update(estado=ConexionEstado.DESCONECTADA)
        mensaje += " La cuenta quedó desconectada: el dueño debe volver a autorizarla."
    cambios = {"estado": PublicacionEstado.FALLIDO, "error": mensaje[:1000], "fecha_actualizacion": timezone.now()}
    if getattr(exc, "contenedor_id", ""):
        cambios["contenedor_id"] = exc.contenedor_id
    Publication.objects.filter(pk=publicacion.pk).update(**cambios)
    logger.warning("Publicación %s falló: %s", publicacion.pk, mensaje)
