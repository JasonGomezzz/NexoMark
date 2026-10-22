"""
Envío de campañas aprobadas al buzón de TikTok.

Reglas (mismas que la rama de Piero, sobre el modelo de apps/social):

- Solo campañas APROBADAS, solo el marketero dueño y solo a cuentas de TikTok
  conectadas por él o por el cliente de la campaña.
- Se envía exactamente lo aprobado: el copy y la imagen se congelan en la
  Publication antes de llamar a TikTok.
- Una publicación por (campaña, cuenta, versión): repetir el envío devuelve
  la existente; nunca se manda dos veces lo mismo.
- Si la respuesta es ambigua (red caída, tiempo agotado) queda
  `resultado_incierto` y no se reenvía: la persona revisa su buzón.
- Consultar el estado no reenvía y llama a TikTok como mucho cada 30 s.
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignStatus
from apps.social.models import ConexionEstado, PublicacionEstado, Publication, RedSocial, SocialConnection
from services import public_media, tiktok_api
from services.social_tokens import TokenIlegible, cifrar, descifrar

logger = logging.getLogger(__name__)

INTERVALO_CONSULTA = timedelta(seconds=30)
MENSAJE_INCIERTO = (
    "No se confirmó si TikTok recibió el envío. Revisa tu buzón de TikTok; "
    "no lo reenviamos para evitar duplicados."
)


class EnvioNoPermitido(Exception):
    def __init__(self, mensaje: str, status: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def cuentas_disponibles(campaign: Campaign) -> list[SocialConnection]:
    """Cuentas de TikTok del marketero de la campaña y del cliente al que va dirigida."""
    filtro = Q(usuario_id=campaign.marketero_id)
    if campaign.cliente_email:
        filtro |= Q(usuario__email__iexact=campaign.cliente_email, usuario__rol=UserRole.CLIENTE)
    return list(
        SocialConnection.objects.filter(filtro, red=RedSocial.TIKTOK, estado=ConexionEstado.ACTIVA)
        .select_related("usuario")
        .order_by("cuenta_nombre")
    )


def guardar_conexion(usuario: User, tokens: tiktok_api.Tokens, nombre: str) -> SocialConnection:
    conexion, _ = SocialConnection.objects.update_or_create(
        usuario=usuario,
        red=RedSocial.TIKTOK,
        cuenta_id=tokens.open_id,
        defaults={
            "cuenta_nombre": nombre[:150],
            "pagina_id": "",
            "token_cifrado": cifrar(tokens.access),
            "refresh_token_cifrado": cifrar(tokens.refresh),
            "token_expira_at": tokens.expira_at,
            "refresh_expira_at": tokens.refresh_expira_at,
            "permisos": tokens.permisos,
            "estado": ConexionEstado.ACTIVA,
        },
    )
    return conexion


def token_vigente(conexion: SocialConnection) -> str:
    """Access token válido; lo renueva bajo bloqueo si vence en menos de 30 s."""
    with transaction.atomic():
        actual = SocialConnection.objects.select_for_update().get(pk=conexion.pk)
        if actual.estado != ConexionEstado.ACTIVA:
            raise EnvioNoPermitido("La cuenta de TikTok fue desconectada. Vuelve a conectarla.")
        try:
            if actual.token_expira_at and actual.token_expira_at > timezone.now() + timedelta(seconds=30):
                return descifrar(actual.token_cifrado)
            if actual.refresh_expira_at and actual.refresh_expira_at <= timezone.now():
                raise EnvioNoPermitido("La autorización de TikTok venció. Vuelve a conectar la cuenta.")
            tokens = tiktok_api.renovar(descifrar(actual.refresh_token_cifrado), actual.cuenta_id)
        except TokenIlegible:
            raise EnvioNoPermitido("No se pudo leer la autorización de TikTok. Vuelve a conectar la cuenta.") from None
        except tiktok_api.TikTokError as exc:
            raise EnvioNoPermitido(f"{exc} Vuelve a conectar la cuenta.") from None
        actual.token_cifrado = cifrar(tokens.access)
        actual.refresh_token_cifrado = cifrar(tokens.refresh)
        actual.token_expira_at = tokens.expira_at
        actual.refresh_expira_at = tokens.refresh_expira_at
        actual.permisos = tokens.permisos
        actual.save(update_fields=[
            "token_cifrado", "refresh_token_cifrado", "token_expira_at", "refresh_expira_at", "permisos",
            "fecha_actualizacion",
        ])
        return tokens.access


def enviar(campaign_id: int, conexion_id: int, usuario: User) -> tuple[Publication, bool]:
    """
    Envía la campaña aprobada al buzón de la cuenta. Devuelve (publicación, nueva).

    Raises:
        EnvioNoPermitido: campaña, cuenta o configuración no válidas.
    """
    if not tiktok_api.configurado():
        raise EnvioNoPermitido("TikTok todavía no está configurado en el servidor.", 503)
    if not tiktok_api.medios_verificados():
        raise EnvioNoPermitido(
            "Falta verificar en el portal de TikTok el dominio desde donde descarga la imagen.", 503
        )
    with transaction.atomic():
        campaign = Campaign.objects.select_for_update().filter(pk=campaign_id, marketero=usuario).first()
        if campaign is None:
            raise EnvioNoPermitido("Campaña no encontrada.", 404)
        if campaign.estado != CampaignStatus.APROBADO:
            raise EnvioNoPermitido("Solo se envían a TikTok campañas que el cliente ya aprobó.", 409)
        conexion = next((c for c in cuentas_disponibles(campaign) if c.id == conexion_id), None)
        if conexion is None:
            raise EnvioNoPermitido("Elige una cuenta de TikTok tuya o del cliente de esta campaña.")
        if "video.upload" not in (conexion.permisos or []):
            raise EnvioNoPermitido("Esa cuenta no autorizó el envío de contenido. Vuelve a conectarla.")
        texto = (campaign.texto_generado or "").strip()
        if not texto or tiktok_api.largo_utf16(texto) > tiktok_api.MAX_TEXTO_UTF16:
            raise EnvioNoPermitido("El texto aprobado debe tener entre 1 y 4000 caracteres para TikTok.")
        if not campaign.imagen_b64:
            raise EnvioNoPermitido("La campaña no tiene imagen para enviar a TikTok.")
        existente = Publication.objects.filter(
            campaign=campaign, red=RedSocial.TIKTOK, cuenta_id=conexion.cuenta_id, version_aprobada=campaign.version
        ).first()
        if existente is not None:
            return existente, False
        publicacion = Publication.objects.create(
            campaign=campaign,
            conexion=conexion,
            red=RedSocial.TIKTOK,
            cuenta_id=conexion.cuenta_id,
            cuenta_nombre=conexion.cuenta_nombre,
            estado=PublicacionEstado.PUBLICANDO,
            copy_aprobado=texto,
            imagen_aprobada_b64=campaign.imagen_b64,
            version_aprobada=campaign.version,
            intentos=1,
            publicando_desde=timezone.now(),
            solicitada_por=usuario,
        )

    # La intención queda guardada antes de llamar a TikTok: un fallo ambiguo nunca se reintenta solo.
    try:
        token = token_vigente(conexion)
        publicacion.externo_id = tiktok_api.enviar_foto(token, texto, public_media.url_publica(publicacion.id))
        publicacion.save(update_fields=["externo_id", "fecha_actualizacion"])
    except EnvioNoPermitido as exc:
        _fallar(publicacion, exc.mensaje)
    except tiktok_api.TikTokError as exc:
        _fallar(publicacion, str(exc))
    except tiktok_api.TikTokIncierto:
        logger.warning("Envío a TikTok sin confirmar (publicación %s)", publicacion.id)
        publicacion.estado = PublicacionEstado.FALLIDO
        publicacion.resultado_incierto = True
        publicacion.error = MENSAJE_INCIERTO
        publicacion.save(update_fields=["estado", "resultado_incierto", "error", "fecha_actualizacion"])
    return publicacion, True


def _fallar(publicacion: Publication, mensaje: str) -> None:
    publicacion.estado = PublicacionEstado.FALLIDO
    publicacion.error = mensaje[:1000]
    publicacion.save(update_fields=["estado", "error", "fecha_actualizacion"])


def consultar(publicacion_id: int, usuario: User) -> tuple[Publication, str | None]:
    """Actualiza el estado desde TikTok si pasaron 30 s. Devuelve (publicación, aviso)."""
    with transaction.atomic():
        # of=("self",): PostgreSQL no permite FOR UPDATE sobre el lado nulo del
        # LEFT JOIN de conexion; basta con bloquear la fila de la publicación.
        publicacion = (
            Publication.objects.select_for_update(of=("self",))
            .select_related("campaign", "conexion")
            .filter(pk=publicacion_id, red=RedSocial.TIKTOK)
            .first()
        )
        if publicacion is None or publicacion.campaign.marketero_id != usuario.id:
            raise EnvioNoPermitido("Envío no encontrado.", 404)
        final = publicacion.estado in (PublicacionEstado.PUBLICADO, PublicacionEstado.FALLIDO)
        if final or not publicacion.externo_id or publicacion.conexion is None:
            return publicacion, None
        ahora = timezone.now()
        if publicacion.consultado_at and ahora - publicacion.consultado_at < INTERVALO_CONSULTA:
            return publicacion, "TikTok se consulta como mucho cada 30 segundos."
        publicacion.consultado_at = ahora
        publicacion.save(update_fields=["consultado_at"])
    try:
        estado, motivo = tiktok_api.consultar_estado(token_vigente(publicacion.conexion), publicacion.externo_id)
    except (EnvioNoPermitido, tiktok_api.TikTokError, tiktok_api.TikTokIncierto):
        # Se conserva el último estado conocido: una lectura fallida no reenvía ni degrada.
        return publicacion, "No se pudo consultar TikTok ahora. Intenta en 30 segundos; no reenvíes."
    cambios = ["fecha_actualizacion"]
    if estado == "en_buzon" and publicacion.estado != PublicacionEstado.EN_BUZON:
        publicacion.estado = PublicacionEstado.EN_BUZON
        cambios.append("estado")
    elif estado == "publicado":
        publicacion.estado = PublicacionEstado.PUBLICADO
        publicacion.publicado_at = publicacion.publicado_at or timezone.now()
        cambios += ["estado", "publicado_at"]
    elif estado == "fallido":
        publicacion.estado = PublicacionEstado.FALLIDO
        publicacion.error = f"TikTok no pudo procesar el envío{': ' + motivo if motivo else ''}."
        cambios += ["estado", "error"]
    publicacion.save(update_fields=cambios)
    return publicacion, None
