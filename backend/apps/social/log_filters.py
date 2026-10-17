"""
Quita de los logs los secretos que viajan en URLs del OAuth de Meta y de X.

El callback llega como GET /api/social/meta/callback/?code=...&state=... (o
/api/social/x/callback/ en X) y
runserver (django.server) y gunicorn (--access-logfile, gunicorn.access)
registran la línea de la petición completa. httpx también registra las URLs
de la Graph API, que llevan client_secret, code y access_token como parámetros.
El filtro se instala en esos loggers desde SocialConfig.ready().

No cubre lo que registren servicios externos (Render, ngrok): ahí el code
sigue siendo inútil sin el state ligado al usuario y sin el secreto de la app.
"""

import logging
import re

PARAMETROS_SECRETOS = (
    "code", "state", "access_token", "client_secret", "fb_exchange_token", "input_token",
    # X (OAuth 2.0 con PKCE): van en el cuerpo del POST, pero se filtran por si alguien las registra.
    "code_verifier", "code_challenge", "refresh_token",
)
_PATRON = re.compile(
    r"(?<![A-Za-z0-9_])(?P<clave>" + "|".join(PARAMETROS_SECRETOS) + r")=[^&#\s\"']+"
)
LOGGERS_CON_URLS = ("django.server", "django.request", "gunicorn.access", "httpx", "httpcore")


def redactar(texto: str) -> str:
    return _PATRON.sub(r"\g<clave>=[filtrado]", texto)


class FiltroSecretosOAuth(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            mensaje = record.getMessage()
        except Exception:  # un mensaje mal formado no debe romper el log
            return True
        limpio = redactar(mensaje)
        if limpio != mensaje:
            record.msg = limpio
            record.args = ()
        return True


def instalar() -> None:
    filtro = FiltroSecretosOAuth()
    for nombre in LOGGERS_CON_URLS:
        logger = logging.getLogger(nombre)
        if not any(isinstance(f, FiltroSecretosOAuth) for f in logger.filters):
            logger.addFilter(filtro)
