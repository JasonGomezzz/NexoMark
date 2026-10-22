"""
MarketMind IA — Django Development Settings
Extiende base.py con configuraciones solo para desarrollo local.
Uso: DJANGO_SETTINGS_MODULE=core.settings.dev
"""

from decouple import Csv, config

from .base import *  # noqa: F401, F403

# ─────────────────────────────────────────────
# DEBUG — solo True en desarrollo
# ─────────────────────────────────────────────
DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "10.0.2.2", "host.docker.internal"]
# IP del Mac en la Wi-Fi para probar la app en un teléfono real (p. ej. 192.168.1.67).
# Django debe correr con `runserver 0.0.0.0:8000`; solo en desarrollo.
ALLOWED_HOSTS += config("DEV_HOSTS_EXTRA", cast=Csv(), default="")

# ─────────────────────────────────────────────
# APPS EXTRA solo en dev
# ─────────────────────────────────────────────
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405

MIDDLEWARE += ["debug_toolbar.middleware.DebugToolbarMiddleware"]  # noqa: F405

INTERNAL_IPS = ["127.0.0.1"]

# ─────────────────────────────────────────────
# DRF — habilitar BrowsableAPI en dev
# ─────────────────────────────────────────────
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

# ─────────────────────────────────────────────
# EMAIL — en dev, todo va a consola
# ─────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─────────────────────────────────────────────
# LOGGING — detallado en desarrollo
# ─────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} {module} — {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "services": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
