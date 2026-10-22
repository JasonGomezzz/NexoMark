"""
Cliente mínimo de la API de TikTok (Login Kit + Content Posting, modo Sandbox).

Portado de la rama de Piero (apps/authentication/tiktok.py y
apps/campaigns/tiktok_publication.py), donde se probó con una cuenta de prueba
del Sandbox. Solo pide `user.info.basic` y `video.upload`:

- Se envía una FOTO en modo MEDIA_UPLOAD: llega como borrador al buzón de
  TikTok y la persona termina de publicar en la app. No hay Direct Post (exige
  `video.publish` y auditoría de TikTok).
- Con estos permisos TikTok no entrega métricas de las publicaciones.
- El texto va tal cual se aprobó, máximo 4000 unidades UTF-16; no se recorta.
- `is_aigc=true`: el contenido se marca como generado con IA.

Referencias (developers.tiktok.com, revisadas por Piero el 12/10/2026):
login-kit-web, oauth-user-access-token-management, tiktok-api-v2-get-user-info,
content-posting-api-reference-photo-post y …-get-video-status.
"""

import secrets
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.utils import timezone

AUTORIZAR = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN = "https://open.tiktokapis.com/v2/oauth/token/"
USUARIO = "https://open.tiktokapis.com/v2/user/info/"
PUBLICAR = "https://open.tiktokapis.com/v2/post/publish/"
PERMISOS = {"user.info.basic", "video.upload"}
MAX_TEXTO_UTF16 = 4000
TIEMPO = 20


class TikTokError(Exception):
    """TikTok respondió y rechazó la operación (resultado conocido)."""


class TikTokIncierto(Exception):
    """No se sabe si TikTok recibió el envío (red caída, tiempo agotado). No se reintenta."""


@dataclass
class Tokens:
    access: str
    refresh: str
    open_id: str
    expira_at: object
    refresh_expira_at: object
    permisos: list[str]


def configurado() -> bool:
    """Credenciales del Sandbox y redirect HTTPS (TikTok no acepta http)."""
    try:
        redirect = urlsplit(settings.TIKTOK_REDIRECT_URI)
    except ValueError:
        return False
    return bool(
        settings.TIKTOK_CLIENT_KEY
        and settings.TIKTOK_CLIENT_SECRET
        and redirect.scheme == "https"
        and redirect.netloc
        and not redirect.query
        and not redirect.fragment
    )


def medios_verificados() -> bool:
    """TikTok solo descarga imágenes de un prefijo de URL verificado en su portal."""
    base = settings.PUBLIC_BASE_URL or ""
    return bool(settings.TIKTOK_MEDIA_VERIFIED and base.startswith("https://"))


def largo_utf16(texto: str) -> int:
    return len(texto.encode("utf-16-le")) // 2


def url_autorizacion(state: str) -> str:
    return AUTORIZAR + "?" + urlencode({
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "response_type": "code",
        "scope": ",".join(sorted(PERMISOS)),
        "redirect_uri": settings.TIKTOK_REDIRECT_URI,
        "state": state,
        "disable_auto_auth": 1,
    })


def nuevo_state() -> str:
    return secrets.token_urlsafe(32)


def _tokens(datos: dict) -> Tokens:
    for campo in ("access_token", "refresh_token", "open_id"):
        if not isinstance(datos.get(campo), str) or not 0 < len(datos[campo]) <= 4096:
            raise TikTokError("Respuesta de autorización inválida.")
    if len(datos["open_id"]) > 128:
        raise TikTokError("Identidad de TikTok inválida.")
    for campo, maximo in (("expires_in", 86400), ("refresh_expires_in", 31536000)):
        if type(datos.get(campo)) is not int or not 0 < datos[campo] <= maximo:
            raise TikTokError("Vigencia de autorización inválida.")
    permisos = {p.strip() for p in str(datos.get("scope", "")).split(",") if p.strip()}
    if str(datos.get("token_type", "")).lower() != "bearer" or not PERMISOS.issubset(permisos):
        raise TikTokError("Faltan permisos de TikTok: autoriza el envío de contenido.")
    ahora = timezone.now()
    return Tokens(
        access=datos["access_token"],
        refresh=datos["refresh_token"],
        open_id=datos["open_id"],
        expira_at=ahora + timedelta(seconds=datos["expires_in"]),
        refresh_expira_at=ahora + timedelta(seconds=datos["refresh_expires_in"]),
        permisos=sorted(permisos),
    )


def _pedir_token(datos: dict) -> Tokens:
    try:
        r = requests.post(
            TOKEN,
            data={"client_key": settings.TIKTOK_CLIENT_KEY, "client_secret": settings.TIKTOK_CLIENT_SECRET, **datos},
            timeout=TIEMPO,
            allow_redirects=False,
        )
        cuerpo = r.json()
    except (requests.RequestException, ValueError) as exc:
        raise TikTokError("No se pudo contactar a TikTok.") from exc
    if r.status_code != 200 or not isinstance(cuerpo, dict) or cuerpo.get("error"):
        raise TikTokError("TikTok rechazó la autorización.")
    return _tokens(cuerpo)


def canjear_codigo(code: str) -> tuple[Tokens, str]:
    """Canjea el código y lee el nombre visible (TikTok no da @usuario con estos permisos)."""
    tokens = _pedir_token({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.TIKTOK_REDIRECT_URI,
    })
    try:
        r = requests.get(
            USUARIO,
            params={"fields": "open_id,display_name"},
            headers={"Authorization": f"Bearer {tokens.access}"},
            timeout=TIEMPO,
            allow_redirects=False,
        )
        perfil = r.json()
    except (requests.RequestException, ValueError) as exc:
        raise TikTokError("No se pudo verificar la cuenta de TikTok.") from exc
    error = perfil.get("error", {}) if isinstance(perfil, dict) else {}
    if r.status_code != 200 or error.get("code") != "ok":
        raise TikTokError("No se pudo verificar la cuenta de TikTok.")
    usuario = perfil.get("data", {}).get("user", {})
    nombre = usuario.get("display_name")
    if usuario.get("open_id") != tokens.open_id or not isinstance(nombre, str) or not 0 < len(nombre.strip()) <= 150:
        raise TikTokError("Identidad de TikTok inválida.")
    return tokens, nombre.strip()


def renovar(refresh: str, open_id: str) -> Tokens:
    tokens = _pedir_token({"grant_type": "refresh_token", "refresh_token": refresh})
    if tokens.open_id != open_id:
        raise TikTokError("La renovación no corresponde a esta cuenta.")
    return tokens


def _publicar(ruta: str, token: str, cuerpo: dict) -> dict:
    """POST a Content Posting. Error de red → TikTokIncierto; rechazo explícito → TikTokError."""
    try:
        r = requests.post(
            PUBLICAR + ruta,
            headers={"Authorization": f"Bearer {token}"},
            json=cuerpo,
            timeout=TIEMPO,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise TikTokIncierto("No se confirmó la respuesta de TikTok.") from exc
    try:
        datos = r.json()
    except ValueError as exc:
        raise TikTokIncierto("TikTok respondió algo ilegible.") from exc
    error = datos.get("error") if isinstance(datos, dict) else None
    if r.status_code != 200 or not isinstance(error, dict) or error.get("code") != "ok":
        mensaje = error.get("message") if isinstance(error, dict) else None
        raise TikTokError(f"TikTok rechazó la solicitud{': ' + mensaje if mensaje else ''}.")
    if not isinstance(datos.get("data"), dict):
        raise TikTokIncierto("TikTok no devolvió datos del envío.")
    return datos["data"]


def enviar_foto(token: str, texto: str, url_imagen: str) -> str:
    """Envía la foto al buzón de TikTok. Devuelve el publish_id."""
    datos = _publicar("content/init/", token, {
        "media_type": "PHOTO",
        "post_mode": "MEDIA_UPLOAD",
        "is_aigc": True,
        "post_info": {"description": texto},
        "source_info": {"source": "PULL_FROM_URL", "photo_cover_index": 0, "photo_images": [url_imagen]},
    })
    publish_id = datos.get("publish_id")
    if not isinstance(publish_id, str) or not 0 < len(publish_id) <= 64:
        raise TikTokIncierto("TikTok no devolvió el identificador del envío.")
    return publish_id


ESTADOS = {
    "PROCESSING_DOWNLOAD": "procesando",
    "PROCESSING_UPLOAD": "procesando",
    "SEND_TO_USER_INBOX": "en_buzon",
    "PUBLISH_COMPLETE": "publicado",
    "FAILED": "fallido",
}


def consultar_estado(token: str, publish_id: str) -> tuple[str, str]:
    """('procesando' | 'en_buzon' | 'publicado' | 'fallido', motivo de fallo si lo hay)."""
    datos = _publicar("status/fetch/", token, {"publish_id": publish_id})
    estado = ESTADOS.get(str(datos.get("status")))
    if estado is None:
        raise TikTokIncierto("Estado de TikTok desconocido.")
    return estado, str(datos.get("fail_reason") or "")
