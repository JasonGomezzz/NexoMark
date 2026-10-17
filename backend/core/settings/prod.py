"""
MarketMind IA — Django Production Settings
Extiende base.py con configuraciones para Render.com.
Uso: DJANGO_SETTINGS_MODULE=core.settings.prod
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

# ─────────────────────────────────────────────
# SECURITY
# ─────────────────────────────────────────────
DEBUG = False

# Render termina SSL en su edge y reenvía HTTP interno con este header.
# Sin esto SECURE_SSL_REDIRECT entra en bucle infinito.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"

SECURE_HSTS_SECONDS = 31536000           # 1 año — HTTPS obligatorio
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True               # HTTP → HTTPS automático
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# El token interno Spring ↔ Django no puede quedar en el valor de desarrollo
# (está en el repositorio): en producción es obligatorio y distinto.
INTERNAL_EVENT_TOKEN = config("INTERNAL_EVENT_TOKEN")  # noqa: F405
if INTERNAL_EVENT_TOKEN in ("", "dev-internal-event-token"):
    raise ImproperlyConfigured("INTERNAL_EVENT_TOKEN debe definirse con un valor propio en producción.")

# Secreto compartido con n8n: sin él cualquiera que conozca la URL podría
# disparar generaciones (cuota de Gemini) o enviar resultados falsos a los callbacks.
N8N_WEBHOOK_TOKEN = config("N8N_WEBHOOK_TOKEN", default="")  # noqa: F405
if N8N_WEBHOOK_TOKEN == "dev-n8n-webhook-token" or len(N8N_WEBHOOK_TOKEN) < 32:
    raise ImproperlyConfigured(
        "N8N_WEBHOOK_TOKEN debe definirse en producción con un valor propio de al menos 32 caracteres."
    )

# X es opcional: solo si se enciende exige sus credenciales y un retorno HTTPS.
if X_HABILITADO and not (X_CLIENT_ID and X_CLIENT_SECRET and X_REDIRECT_URI.startswith("https://")):  # noqa: F405
    raise ImproperlyConfigured(
        "Con X_HABILITADO=True hay que definir X_CLIENT_ID, X_CLIENT_SECRET y un X_REDIRECT_URI con https."
    )

# ─────────────────────────────────────────────
# LOGGING — errores a archivo en producción
# ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "format": '{"level": "%(levelname)s", "time": "%(asctime)s", "module": "%(module)s", "message": "%(message)s"}',
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING"},
        "apps": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "services": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
