"""
Cliente mínimo de la API v2 de X: OAuth 2.0 con PKCE, usuario, imagen y post.

Documentación oficial consultada el 2026-10-17:
- OAuth 2.0 Authorization Code con PKCE:
  https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
  https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token
  Autorización en https://x.com/i/oauth2/authorize (response_type=code, client_id,
  redirect_uri con coincidencia exacta, scope, state, code_challenge,
  code_challenge_method=S256). Canje y renovación en POST
  https://api.x.com/2/oauth2/token como application/x-www-form-urlencoded; el
  cliente confidencial se autentica con Authorization: Basic base64(id:secret)
  y no manda client_id en el cuerpo. El código caduca 30 s después de emitirse.
  El token de acceso dura 2 horas; offline.access entrega un refresh token.
- Usuario autenticado: GET https://api.x.com/2/users/me (tweet.read users.read)
  https://docs.x.com/x-api/users/get-my-user
- Imagen: POST https://api.x.com/2/media/upload (media.write) con JSON
  {"media": <base64>, "media_category": "tweet_image"}; responde data.id y, si
  aplica, processing_info.state. https://docs.x.com/x-api/media/upload-media
- Post: POST https://api.x.com/2/tweets {"text", "media": {"media_ids": [...]}}
  (tweet.read tweet.write users.read); responde 201 con data.id.
  https://docs.x.com/x-api/posts/create-post
- Precios (pago por uso): https://docs.x.com/x-api/getting-started/pricing

Todas las llamadas pasan por _x() para poder simularlas en tests: los tests
nunca llaman a la API real.
"""

import base64
import hashlib
import logging
import re
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

URL_AUTORIZACION = "https://x.com/i/oauth2/authorize"
TIMEOUT = 30.0
_ID_NUMERICO = re.compile(r"^[0-9]{1,64}$")
_USUARIO = re.compile(r"^[A-Za-z0-9_]{1,50}$")

MENSAJES_POR_ESTADO = {
    401: "La autorización de X ya no es válida. El dueño debe volver a conectar la cuenta.",
    402: "X rechazó la solicitud por falta de saldo en la cuenta de desarrollador.",
    403: "X rechazó la solicitud (permisos de la app o contenido no permitido, por ejemplo un post duplicado).",
    429: "X alcanzó su límite de solicitudes. Espera unos minutos antes de volver a intentarlo.",
}


class XError(Exception):
    def __init__(self, mensaje: str, status: int | None = None, ambiguo: bool = False):
        super().__init__(mensaje)
        self.status = status
        # True si la operación pudo aplicarse en X aunque la respuesta no llegó o no se entiende.
        self.ambiguo = ambiguo

    @property
    def token_invalido(self) -> bool:
        return self.status == 401


@dataclass
class TokensX:
    access_token: str
    refresh_token: str
    expires_in: int
    scope: str = ""


# ── PKCE ─────────────────────────────────────────────────────────────────


def nuevo_code_verifier() -> str:
    """RFC 7636: 43 a 128 caracteres no reservados. token_urlsafe(64) da 86."""
    return secrets.token_urlsafe(64)


def code_challenge(code_verifier: str) -> str:
    """S256: base64url(sha256(verifier)) sin relleno."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ── HTTP ─────────────────────────────────────────────────────────────────


def _autenticacion_cliente() -> httpx.BasicAuth:
    return httpx.BasicAuth(settings.X_CLIENT_ID, settings.X_CLIENT_SECRET)


def _mensaje_error(response: httpx.Response, data: dict) -> str:
    if response.status_code in MENSAJES_POR_ESTADO:
        return MENSAJES_POR_ESTADO[response.status_code]
    detalle = data.get("detail") or data.get("title") or data.get("error_description") or data.get("error")
    if not detalle and isinstance(data.get("errors"), list) and data["errors"]:
        primero = data["errors"][0]
        detalle = primero.get("message") or primero.get("detail") if isinstance(primero, dict) else None
    texto = str(detalle) if detalle else f"X respondió HTTP {response.status_code}."
    return texto[:300]


def _x(
    metodo: str,
    ruta: str,
    *,
    token: str | None = None,
    json: dict | None = None,
    data: dict | None = None,
    cliente: bool = False,
) -> tuple[int, dict[str, Any]]:
    """
    Llama a la API de X. `token`: Bearer del usuario; `cliente`: Basic con las
    credenciales de la app (canje y renovación). Devuelve (status, json).
    Un timeout o un corte en un POST es ambiguo: X pudo haberlo aplicado.
    """
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        response = httpx.request(
            metodo,
            f"{settings.X_API_BASE_URL}{ruta}",
            headers=headers,
            json=json,
            data=data,
            auth=_autenticacion_cliente() if cliente else None,
            timeout=TIMEOUT,
            follow_redirects=False,
        )
    except httpx.TimeoutException as exc:
        raise XError("X no respondió a tiempo.", ambiguo=metodo == "POST") from exc
    except httpx.HTTPError as exc:
        # Si la conexión se cortó después de enviar, tampoco se sabe si X lo aplicó.
        raise XError("No se pudo conectar con X.", ambiguo=metodo == "POST" and not isinstance(
            exc, httpx.ConnectError)) from exc
    try:
        cuerpo = response.json()
    except ValueError:
        cuerpo = {}
    if not isinstance(cuerpo, dict):
        cuerpo = {}
    if response.status_code >= 400:
        raise XError(_mensaje_error(response, cuerpo), status=response.status_code,
                     ambiguo=response.status_code >= 500 and metodo == "POST")
    return response.status_code, cuerpo


# ── OAuth ────────────────────────────────────────────────────────────────


def url_autorizacion(state: str, code_verifier: str, redirect_uri: str | None = None) -> str:
    params = {
        "response_type": "code",
        "client_id": settings.X_CLIENT_ID,
        "redirect_uri": redirect_uri or settings.X_REDIRECT_URI,
        "scope": " ".join(settings.X_OAUTH_SCOPES),
        "state": state,
        "code_challenge": code_challenge(code_verifier),
        "code_challenge_method": "S256",
    }
    return f"{URL_AUTORIZACION}?{urlencode(params)}"


def _leer_tokens(cuerpo: dict, refresh_anterior: str = "") -> TokensX:
    access = cuerpo.get("access_token")
    refresh = cuerpo.get("refresh_token") or refresh_anterior
    expira = cuerpo.get("expires_in")
    if not isinstance(access, str) or not access or not isinstance(refresh, str) or not refresh:
        raise XError("X no entregó los tokens esperados. Revisa que la app pida offline.access.")
    if isinstance(expira, bool) or not isinstance(expira, int) or expira <= 0:
        expira = 7200  # La doc indica 2 horas cuando no se informa.
    return TokensX(access_token=access, refresh_token=refresh, expires_in=expira, scope=str(cuerpo.get("scope", "")))


def canjear_codigo(code: str, code_verifier: str, redirect_uri: str | None = None) -> TokensX:
    """code + code_verifier → tokens de acceso y de renovación (cliente confidencial)."""
    _, cuerpo = _x(
        "POST",
        "/2/oauth2/token",
        data={
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri or settings.X_REDIRECT_URI,
            "code_verifier": code_verifier,
        },
        cliente=True,
    )
    return _leer_tokens(cuerpo)


def refrescar_token(refresh_token: str) -> TokensX:
    """Renueva el token de acceso. X rota el refresh token: hay que guardar el nuevo."""
    _, cuerpo = _x(
        "POST",
        "/2/oauth2/token",
        data={"refresh_token": refresh_token, "grant_type": "refresh_token"},
        cliente=True,
    )
    return _leer_tokens(cuerpo, refresh_anterior=refresh_token)


def usuario_actual(access_token: str) -> dict[str, str]:
    """id y @usuario de la cuenta que autorizó (GET /2/users/me)."""
    _, cuerpo = _x("GET", "/2/users/me", token=access_token)
    datos = cuerpo.get("data") if isinstance(cuerpo.get("data"), dict) else {}
    user_id, username = datos.get("id"), datos.get("username")
    if not (isinstance(user_id, str) and _ID_NUMERICO.match(user_id)
            and isinstance(username, str) and _USUARIO.match(username)):
        raise XError("X no devolvió los datos de la cuenta.")
    return {"id": user_id, "username": username, "name": str(datos.get("name") or username)}


# ── Publicación ──────────────────────────────────────────────────────────


def subir_imagen(access_token: str, jpeg: bytes) -> str:
    """Sube el JPEG aprobado y devuelve el media_id. Subir no publica nada: nunca es ambiguo."""
    try:
        _, cuerpo = _x(
            "POST",
            "/2/media/upload",
            token=access_token,
            json={"media": base64.b64encode(jpeg).decode("ascii"), "media_category": "tweet_image"},
        )
    except XError as exc:
        exc.ambiguo = False
        raise
    datos = cuerpo.get("data") if isinstance(cuerpo.get("data"), dict) else {}
    media_id = datos.get("id")
    if not isinstance(media_id, str) or not _ID_NUMERICO.match(media_id):
        raise XError("X no devolvió el identificador de la imagen.")
    procesamiento = datos.get("processing_info")
    if isinstance(procesamiento, dict) and procesamiento.get("state") not in (None, "succeeded"):
        raise XError("X todavía procesa la imagen; vuelve a intentarlo en unos segundos.")
    return media_id


def crear_post(access_token: str, texto: str, media_ids: list[str]) -> str:
    """
    Publica el post y devuelve su id. Un 4xx es un rechazo confirmado (no se
    publicó); un timeout, un 5xx o una respuesta 2xx incomprensible son
    ambiguos: el post pudo haberse creado.
    """
    status, cuerpo = _x(
        "POST",
        "/2/tweets",
        token=access_token,
        json={"text": texto, "media": {"media_ids": media_ids}},
    )
    datos = cuerpo.get("data") if isinstance(cuerpo.get("data"), dict) else {}
    post_id = datos.get("id")
    if status != 201 or not isinstance(post_id, str) or not _ID_NUMERICO.match(post_id):
        raise XError("X no confirmó la publicación.", status=status, ambiguo=True)
    return post_id


def enlace_post(usuario: str, post_id: str) -> str:
    return f"https://x.com/{usuario.lstrip('@')}/status/{post_id}"
