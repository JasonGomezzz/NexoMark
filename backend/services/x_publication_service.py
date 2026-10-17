"""
NexoMark — Versión para X de una campaña aprobada y su publicación.

Regla del producto: lo aprobado es lo publicado. Decisión del 16/10 para X:
- X es opcional y está apagada por defecto (X_HABILITADO).
- "Resumir para X" crea una VarianteX (borrador) que el CLIENTE aprueba. La
  campaña aprobada no se reabre nunca ni cambia de versión.
- Al aprobar se guarda sha256(texto). Al publicar se exige que el texto
  actual dé el mismo hash y que el contenido de la campaña (copy + imagen)
  siga siendo el de cuando se creó la variante.
- Editar la variante la devuelve a borrador (solo la variante).
- Publicar exige confirmación explícita del costo y respeta el tope de gasto
  mensual (x_gasto). Una respuesta ambigua de X no se reintenta a ciegas.

Garantías verificadas con tests y X simulado (nunca contra la API real):
- La fila de la publicación se reclama con bloqueo: dos clics no publican dos veces.
- Una sola publicación por campaña y cuenta de X (constraint de la tabla).
- La llamada a X ocurre fuera de la transacción.
"""

import hashlib
import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignStatus
from apps.social.models import (
    ConexionEstado,
    PublicacionEstado,
    Publication,
    RedSocial,
    SocialConnection,
    VarianteX,
    VarianteXEstado,
)
from services import public_media, x_api, x_gasto, x_texto
from services.gemini_text_service import resumir_para_x
from services.publication_service import MARGEN_ATASCADA, publicacion_atascada
from services.social_tokens import TokenIlegible, cifrar, descifrar

logger = logging.getLogger(__name__)

MAX_INTENTOS = 3
FEEDBACK_MIN, FEEDBACK_MAX = 10, 500
# Margen para renovar el token de acceso antes de que venza en mitad de la publicación.
MARGEN_TOKEN = timedelta(seconds=60)
AVISO_INCIERTO = (
    "X no confirmó el resultado: el post pudo haberse publicado. Revisa la cuenta de X antes de "
    "reintentar; NexoMark no reintenta a ciegas."
)


class OperacionNoPermitida(Exception):
    def __init__(self, mensaje: str, status: int = 409, motivo: str = ""):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status
        self.motivo = motivo


def hash_campana(campaign: Campaign) -> str:
    """sha256 del copy + imagen aprobados de la campaña (separados para que no se confundan)."""
    contenido = f"{campaign.texto_generado or ''}\x00{campaign.imagen_b64 or ''}"
    return hashlib.sha256(contenido.encode("utf-8")).hexdigest()


def es_cliente_de(usuario: User, campaign: Campaign) -> bool:
    return (
        usuario.rol == UserRole.CLIENTE
        and bool(campaign.cliente_email)
        and usuario.email.lower() == campaign.cliente_email.lower()
    )


def variantes_visibles(usuario: User) -> QuerySet[VarianteX]:
    """Superadmin todo (solo lectura), marketero sus campañas, cliente lo enviado a su email."""
    qs = VarianteX.objects.select_related("campaign", "campaign__marketero")
    if usuario.rol == UserRole.SUPERADMIN:
        return qs
    if usuario.rol == UserRole.CLIENTE:
        # El borrador es trabajo del marketero: el cliente ve la variante desde que se la envían.
        return qs.filter(campaign__cliente_email__iexact=usuario.email).exclude(estado=VarianteXEstado.BORRADOR)
    return qs.filter(campaign__marketero=usuario)


def publicaciones_x(campaign_id: int) -> QuerySet[Publication]:
    return Publication.objects.filter(campaign_id=campaign_id, red=RedSocial.X)


def bloqueada(variante: VarianteX) -> bool:
    """Ya publicada (o con resultado incierto) en alguna cuenta: su texto queda como registro de lo publicado."""
    return publicaciones_x(variante.campaign_id).filter(
        Q(estado__in=[PublicacionEstado.PUBLICADO, PublicacionEstado.PUBLICANDO])
        | Q(estado=PublicacionEstado.FALLIDO, resultado_incierto=True)
    ).exists()


def _solo_marketero_dueno(campaign: Campaign, usuario: User) -> None:
    if usuario.rol == UserRole.SUPERADMIN:
        raise OperacionNoPermitida("El superadmin solo puede ver la versión para X.", 403, "solo_lectura")
    if usuario.rol != UserRole.MARKETERO or campaign.marketero_id != usuario.id:
        raise OperacionNoPermitida("Solo el marketero de la campaña prepara su versión para X.", 403)


def _solo_aprobada(campaign: Campaign) -> None:
    if campaign.estado != CampaignStatus.APROBADO:
        raise OperacionNoPermitida(
            "Solo las campañas aprobadas por el cliente tienen versión para X.", 409, "campana_no_aprobada"
        )


def _texto_valido(texto: str) -> str:
    texto = x_texto.normalizar(texto).strip()
    validacion = x_texto.validar(texto)
    if not validacion["valido"]:
        raise OperacionNoPermitida(validacion["motivo"], 400, "texto_invalido")
    return texto


def _no_bloqueada(variante: VarianteX) -> None:
    if bloqueada(variante):
        raise OperacionNoPermitida(
            "La versión para X ya se publicó (o está en revisión por un resultado incierto): "
            "su texto queda como registro de lo publicado.",
            409,
            "bloqueada",
        )


def _reiniciar_aprobacion(variante: VarianteX) -> None:
    variante.estado = VarianteXEstado.BORRADOR
    variante.hash_aprobado = ""
    variante.aprobada_por = None
    variante.aprobada_at = None
    variante.enviada_at = None


# ── Variante ─────────────────────────────────────────────────────────────


def crear_o_regenerar(campaign: Campaign, usuario: User, texto: str | None = None) -> tuple[VarianteX, bool]:
    """
    Crea la versión para X o reemplaza su texto (una vigente por campaña).
    Sin `texto` la resume Gemini (o el recorte determinista en modo simulado);
    no cobra crédito. Siempre queda en borrador: el cliente aún no la vio.
    """
    _solo_marketero_dueno(campaign, usuario)
    _solo_aprobada(campaign)
    if texto is not None:
        texto_final, por_ia = _texto_valido(texto), False
    else:
        if not (campaign.texto_generado or "").strip():
            raise OperacionNoPermitida("La campaña no tiene copy aprobado para resumir.", 409, "sin_copy")
        # Fuera de la transacción: no se bloquea nada mientras responde Gemini.
        resumen, por_ia = resumir_para_x(campaign.texto_generado, campaign.industria, campaign.tono)
        try:
            texto_final = _texto_valido(resumen)
        except OperacionNoPermitida:
            raise OperacionNoPermitida(
                "No se pudo preparar un resumen válido para X. Escríbelo a mano.", 502, "resumen_invalido"
            ) from None

    with transaction.atomic():
        actual = Campaign.objects.select_for_update().get(pk=campaign.pk)
        _solo_aprobada(actual)
        variante = VarianteX.objects.select_for_update().filter(campaign=actual).first()
        creada = variante is None
        if creada:
            variante = VarianteX(campaign=actual, creada_por=usuario)
        else:
            _no_bloqueada(variante)
            _reiniciar_aprobacion(variante)
        variante.texto = texto_final
        variante.generada_por_ia = por_ia
        variante.version_origen = actual.version
        variante.hash_origen = hash_campana(actual)
        variante.estado = VarianteXEstado.BORRADOR
        try:
            with transaction.atomic():
                variante.save()
        except IntegrityError:  # otra petición la creó a la vez
            raise OperacionNoPermitida("La versión para X se está creando en otra pestaña. Recarga.", 409) from None
    return variante, creada


def editar(variante: VarianteX, usuario: User, texto) -> VarianteX:
    """Cambiar el texto devuelve SOLO la variante a borrador. La campaña no cambia de estado ni de versión."""
    _solo_marketero_dueno(variante.campaign, usuario)
    if not isinstance(texto, str):
        raise OperacionNoPermitida("Falta el texto para X.", 400, "texto_invalido")
    texto_final = _texto_valido(texto)
    with transaction.atomic():
        actual = VarianteX.objects.select_for_update().select_related("campaign").get(pk=variante.pk)
        _no_bloqueada(actual)
        if texto_final != actual.texto:
            actual.texto = texto_final
            actual.generada_por_ia = False
            _reiniciar_aprobacion(actual)
            actual.save()
    return actual


def enviar(variante: VarianteX, usuario: User) -> VarianteX:
    _solo_marketero_dueno(variante.campaign, usuario)
    _solo_aprobada(variante.campaign)
    if not variante.campaign.cliente_email:
        raise OperacionNoPermitida("La campaña no tiene email de cliente para revisar la versión para X.", 409)
    with transaction.atomic():
        actual = VarianteX.objects.select_for_update().select_related("campaign").get(pk=variante.pk)
        _no_bloqueada(actual)
        if actual.estado == VarianteXEstado.APROBADA:
            raise OperacionNoPermitida("El cliente ya aprobó esta versión para X.", 409, "ya_aprobada")
        _texto_valido(actual.texto)
        if actual.estado != VarianteXEstado.PENDIENTE_CLIENTE:
            actual.estado = VarianteXEstado.PENDIENTE_CLIENTE
            actual.enviada_at = timezone.now()
            actual.save()
    return actual


def _decision_del_cliente(variante: VarianteX, usuario: User) -> VarianteX:
    if not es_cliente_de(usuario, variante.campaign):
        raise OperacionNoPermitida("Solo el cliente de la campaña aprueba o rechaza su versión para X.", 403)
    actual = VarianteX.objects.select_for_update().select_related("campaign").get(pk=variante.pk)
    if actual.estado != VarianteXEstado.PENDIENTE_CLIENTE:
        raise OperacionNoPermitida("Esta versión para X no está esperando tu revisión.", 409, "no_pendiente")
    return actual


def aprobar(variante: VarianteX, usuario: User, hash_visto) -> VarianteX:
    """
    El cliente aprueba el texto que vio: `hash_visto` es el sha256 del texto
    que tenía en pantalla. Si el marketero lo cambió entretanto, no se aprueba.
    """
    with transaction.atomic():
        actual = _decision_del_cliente(variante, usuario)
        if not isinstance(hash_visto, str) or hash_visto != x_texto.hash_texto(actual.texto):
            raise OperacionNoPermitida(
                "La versión para X cambió mientras la revisabas. Recarga y revisa el texto nuevo.", 409, "cambio"
            )
        actual.estado = VarianteXEstado.APROBADA
        actual.hash_aprobado = x_texto.hash_texto(actual.texto)
        actual.aprobada_por = usuario
        actual.aprobada_at = timezone.now()
        actual.feedback_cliente = ""
        actual.save()
    return actual


def rechazar(variante: VarianteX, usuario: User, feedback) -> VarianteX:
    feedback = feedback.strip() if isinstance(feedback, str) else ""
    if not FEEDBACK_MIN <= len(feedback) <= FEEDBACK_MAX:
        raise OperacionNoPermitida(
            f"Explica el motivo del rechazo (entre {FEEDBACK_MIN} y {FEEDBACK_MAX} caracteres).", 400, "feedback"
        )
    with transaction.atomic():
        actual = _decision_del_cliente(variante, usuario)
        actual.estado = VarianteXEstado.RECHAZADA
        actual.feedback_cliente = feedback
        actual.save()
    return actual


# ── Publicación ──────────────────────────────────────────────────────────


def _conexion_x(campaign: Campaign, conexion_id) -> SocialConnection:
    """Cuenta de X activa del marketero de la campaña o de su cliente."""
    if isinstance(conexion_id, bool) or not isinstance(conexion_id, int):
        raise OperacionNoPermitida("Elige la cuenta de X donde publicar.", 400, "conexion")
    filtro = Q(usuario_id=campaign.marketero_id)
    if campaign.cliente_email:
        filtro |= Q(usuario__email__iexact=campaign.cliente_email, usuario__rol=UserRole.CLIENTE)
    conexion = (
        SocialConnection.objects.filter(filtro, pk=conexion_id, red=RedSocial.X, estado=ConexionEstado.ACTIVA)
        .select_related("usuario")
        .first()
    )
    if conexion is None:
        raise OperacionNoPermitida(
            "La cuenta de X no existe, está desconectada o no es del cliente ni del marketero.", 400, "conexion"
        )
    return conexion


def _comprobar_lo_aprobado(variante: VarianteX, campaign: Campaign) -> None:
    """Lo que se va a publicar es exactamente lo que aprobó el cliente."""
    _solo_aprobada(campaign)
    if variante.estado != VarianteXEstado.APROBADA or not variante.hash_aprobado:
        raise OperacionNoPermitida("El cliente todavía no aprobó esta versión para X.", 409, "sin_aprobar")
    if x_texto.hash_texto(variante.texto) != variante.hash_aprobado:
        raise OperacionNoPermitida(
            "El texto para X no coincide con el que aprobó el cliente. Envíalo de nuevo a revisión.",
            409,
            "texto_alterado",
        )
    if hash_campana(campaign) != variante.hash_origen:
        raise OperacionNoPermitida(
            "La campaña cambió desde que se preparó la versión para X. Vuelve a generarla y "
            "envíala al cliente.",
            409,
            "campana_cambiada",
        )
    validacion = x_texto.validar(variante.texto)
    if not validacion["valido"]:
        raise OperacionNoPermitida(validacion["motivo"], 409, "texto_invalido")


@dataclass
class _Intento:
    publicacion: Publication
    texto: str
    jpeg: bytes | None


def publicar(
    variante: VarianteX, usuario: User, conexion_id, confirmo_costo, confirmo_revision=False
) -> Publication:
    """
    Publica en X la variante aprobada. Exige `confirmo_costo is True`.
    `confirmo_revision` solo destraba un intento anterior con resultado
    incierto, después de que el marketero revisó la cuenta de X.
    """
    campaign = variante.campaign
    _solo_marketero_dueno(campaign, usuario)
    if confirmo_costo is not True:
        raise OperacionNoPermitida(
            f"Confirma que publicar en X tiene un costo aproximado de US${x_gasto.estado().costo_post_usd}.",
            400,
            "confirmar_costo",
        )
    conexion = _conexion_x(campaign, conexion_id)
    _comprobar_lo_aprobado(variante, campaign)
    try:
        jpeg = public_media.a_jpeg(campaign.imagen_b64) if campaign.imagen_b64 else None
    except public_media.ImagenNoDisponible:
        raise OperacionNoPermitida("La imagen aprobada de la campaña no es válida.", 409, "imagen") from None

    intento = _reclamar(variante.pk, campaign.pk, conexion, usuario, jpeg, confirmo_revision is True)
    return _enviar(intento, conexion)


def _reclamar(
    variante_id: int, campaign_id: int, conexion: SocialConnection, usuario: User, jpeg: bytes | None,
    revisado: bool,
) -> _Intento:
    """Comprueba todo de nuevo con las filas bloqueadas, reserva el gasto y marca 'publicando'."""
    try:
        with transaction.atomic():
            variante = VarianteX.objects.select_for_update().get(pk=variante_id)
            campaign = Campaign.objects.get(pk=campaign_id)
            _comprobar_lo_aprobado(variante, campaign)
            publicacion = (
                Publication.objects.select_for_update()
                .filter(campaign=campaign, red=RedSocial.X, cuenta_id=conexion.cuenta_id)
                .first()
            )
            if publicacion is not None:
                _puede_intentarse(publicacion, revisado)
            if not x_gasto.reservar_publicacion():
                estado = x_gasto.estado()
                raise OperacionNoPermitida(
                    f"Se alcanzó el tope mensual de gasto en X (US${estado.tope_mensual_usd}). "
                    f"Quedan {estado.restantes} de {estado.maximo_mes} publicaciones este mes.",
                    409,
                    "tope",
                )
            if publicacion is None:
                publicacion = Publication(
                    campaign=campaign, red=RedSocial.X, cuenta_id=conexion.cuenta_id, intentos=0
                )
            # Se congela lo aprobado en cada intento: el hash ya garantizó que es lo que vio el cliente.
            publicacion.conexion = conexion
            publicacion.cuenta_nombre = conexion.cuenta_nombre
            publicacion.copy_aprobado = variante.texto
            publicacion.imagen_aprobada_b64 = campaign.imagen_b64
            publicacion.version_aprobada = campaign.version
            publicacion.estado = PublicacionEstado.PUBLICANDO
            publicacion.publicando_desde = timezone.now()
            publicacion.intentos += 1
            publicacion.error = ""
            publicacion.resultado_incierto = False
            publicacion.solicitada_por = usuario
            with transaction.atomic():
                publicacion.save()
    except IntegrityError:  # dos clics a la vez: solo uno crea la publicación
        raise OperacionNoPermitida("La publicación en X ya se está procesando.", 409, "en_proceso") from None
    return _Intento(publicacion=publicacion, texto=variante.texto, jpeg=jpeg)


def _puede_intentarse(publicacion: Publication, revisado: bool) -> None:
    if publicacion.estado == PublicacionEstado.PUBLICADO:
        raise OperacionNoPermitida(f"Ya se publicó en {publicacion.cuenta_nombre}.", 409, "ya_publicada")
    atascada = publicacion_atascada(publicacion)
    if publicacion.estado == PublicacionEstado.PUBLICANDO and not atascada:
        minutos = int(MARGEN_ATASCADA.total_seconds() // 60)
        raise OperacionNoPermitida(
            f"La publicación en X se está procesando. Si en {minutos} minutos sigue igual, revisa la cuenta.",
            409,
            "en_proceso",
        )
    incierta = publicacion.resultado_incierto or atascada
    if incierta and not revisado:
        raise OperacionNoPermitida(AVISO_INCIERTO, 409, "incierto")
    if not incierta and publicacion.intentos >= MAX_INTENTOS:
        raise OperacionNoPermitida("Se alcanzó el máximo de intentos. Revisa la cuenta de X.", 409, "intentos")


def _enviar(intento: _Intento, conexion: SocialConnection) -> Publication:
    publicacion = intento.publicacion
    try:
        token = token_vigente(conexion)
        media_ids = [x_api.subir_imagen(token, intento.jpeg)] if intento.jpeg else []
        post_id = x_api.crear_post(token, intento.texto, media_ids)
    except (x_api.XError, TokenIlegible) as exc:
        _marcar_fallida(publicacion, exc)
        publicacion.refresh_from_db()
        return publicacion
    ahora = timezone.now()
    Publication.objects.filter(pk=publicacion.pk).update(
        estado=PublicacionEstado.PUBLICADO,
        externo_id=post_id,
        permalink=x_api.enlace_post(conexion.cuenta_nombre, post_id),
        error="",
        publicado_at=ahora,
        fecha_actualizacion=ahora,
    )
    logger.info("Publicación %s publicada en X (%s)", publicacion.pk, post_id)
    publicacion.refresh_from_db()
    return publicacion


def _marcar_fallida(publicacion: Publication, exc: Exception) -> None:
    ambiguo = isinstance(exc, x_api.XError) and exc.ambiguo
    mensaje = AVISO_INCIERTO if ambiguo else str(exc)
    if isinstance(exc, x_api.XError) and exc.token_invalido and publicacion.conexion_id:
        SocialConnection.objects.filter(pk=publicacion.conexion_id).update(estado=ConexionEstado.DESCONECTADA)
        mensaje += " La cuenta quedó desconectada: el dueño debe volver a conectarla."
    Publication.objects.filter(pk=publicacion.pk).update(
        estado=PublicacionEstado.FALLIDO,
        error=mensaje[:1000],
        resultado_incierto=ambiguo,
        fecha_actualizacion=timezone.now(),
    )
    logger.warning("Publicación %s en X falló%s: %s", publicacion.pk, " (incierta)" if ambiguo else "", exc)


def token_vigente(conexion: SocialConnection) -> str:
    """
    Token de acceso válido. Si vence en menos de un minuto lo renueva con el
    refresh token bajo bloqueo de la conexión: X rota el refresh token y dos
    renovaciones simultáneas invalidarían la cuenta.
    """
    with transaction.atomic():
        actual = SocialConnection.objects.select_for_update().get(pk=conexion.pk)
        if actual.estado != ConexionEstado.ACTIVA:
            raise x_api.XError("La cuenta de X fue desconectada. Vuelve a conectarla.")
        if actual.token_expira_at and actual.token_expira_at > timezone.now() + MARGEN_TOKEN:
            return descifrar(actual.token_cifrado)
        if not actual.refresh_token_cifrado:
            raise x_api.XError("La autorización de X venció. El dueño debe volver a conectar la cuenta.", status=401)
        try:
            tokens = x_api.refrescar_token(descifrar(actual.refresh_token_cifrado))
        except x_api.XError as exc:
            exc.ambiguo = False  # renovar no publica nada
            if exc.status in (400, 401):
                raise x_api.XError(
                    "La autorización de X venció y no se pudo renovar. El dueño debe volver a conectar la cuenta.",
                    status=401,
                ) from exc
            raise
        actual.token_cifrado = cifrar(tokens.access_token)
        actual.refresh_token_cifrado = cifrar(tokens.refresh_token)
        actual.token_expira_at = timezone.now() + timedelta(seconds=tokens.expires_in)
        actual.save(update_fields=["token_cifrado", "refresh_token_cifrado", "token_expira_at", "fecha_actualizacion"])
        return tokens.access_token
