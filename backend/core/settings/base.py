"""
MarketMind IA — Django Base Settings
Contiene toda configuración compartida entre dev y prod.
Nunca instanciar directamente: usar dev.py o prod.py.
"""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


# ─────────────────────────────────────────────
# SECURITY — nunca hardcodear valores aquí
# ─────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY")
ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv(), default="localhost")


# ─────────────────────────────────────────────
# APPS
# ─────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # JWT Blacklist activada (HU2)
    "corsheaders",
    "django_ratelimit",
]

LOCAL_APPS = [
    "apps.authentication",
    "apps.campaigns",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


# ─────────────────────────────────────────────
# MIDDLEWARE — orden importa, corsheaders primero
# ─────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # CORS antes de todo
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",     # Archivos estáticos
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ─────────────────────────────────────────────
# URLS & WSGI
# ─────────────────────────────────────────────
ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"


# ─────────────────────────────────────────────
# TEMPLATES
# ─────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ─────────────────────────────────────────────
# DATABASE — PostgreSQL en Neon.tech
# ─────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", default="5432"),
        "OPTIONS": {
            "sslmode": config("DB_SSLMODE", default="require"),  # Neon.tech requiere SSL
            "options": "-c client_encoding=UTF8",  # Fuerza UTF-8 a nivel de protocolo
        },
        "CONN_MAX_AGE": 60,  # Connection pooling básico
    }
}


# ─────────────────────────────────────────────
# AUTH — modelo customizado
# ─────────────────────────────────────────────
AUTH_USER_MODEL = "authentication.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ─────────────────────────────────────────────
# REST FRAMEWORK
# ─────────────────────────────────────────────
REST_FRAMEWORK = {
    # JWT como autenticación por defecto.
    # TokenVersionJWTAuthentication (HU18) valida token_version del JWT
    # contra BD → invalida tokens cuando un admin suspende/reactiva al usuario.
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.authentication.authentication.TokenVersionJWTAuthentication",
    ),
    # Requiere autenticación por defecto en todos los endpoints
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    # Paginación global
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # Throttling — rate limiting a nivel DRF
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "register": "5/minute",   # RegisterRateThrottle sobrescribe duration → 600s (5/10min)
        "login": "10/minute",     # LoginRateThrottle sobrescribe duration → 300s (10/5min)
    },
    # Renderer solo JSON, sin BrowsableAPI en producción
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # Manejo de excepciones centralizado
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}


# ─────────────────────────────────────────────
# JWT — simplejwt configuración completa (HU2)
# ─────────────────────────────────────────────
SIMPLE_JWT = {
    # Tiempos de vida según criterios de aceptación
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,       # Nuevo refresh en cada uso
    "BLACKLIST_AFTER_ROTATION": True,    # Invalida refresh anterior
    "UPDATE_LAST_LOGIN": True,

    # Algoritmo y firma
    "ALGORITHM": "HS256",
    "SIGNING_KEY": config("SECRET_KEY"),

    # Claims adicionales — campo "role" en payload (criterio HU2)
    "TOKEN_OBTAIN_SERIALIZER": "apps.authentication.serializers.CustomTokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "apps.authentication.serializers.VersionedTokenRefreshSerializer",

    # Headers
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",

    # Blacklist activada desde Sprint 1
    "TOKEN_BLACKLIST_ENABLED": True,
}


# ─────────────────────────────────────────────
# CORS — whitelist estricta (nunca allow_all)
# ─────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    cast=Csv(),
    default="http://localhost:5173",   # Vite dev server por defecto
)
CORS_ALLOW_CREDENTIALS = True          # Necesario para enviar cookies/headers auth
CORS_ALLOW_ALL_ORIGINS = False         # NUNCA True


# ─────────────────────────────────────────────
# CACHE — Redis con django-redis
# ─────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://localhost:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,  # Si Redis cae, la app sigue funcionando
        },
    }
}


# ─────────────────────────────────────────────
# STATIC & MEDIA
# ─────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# ─────────────────────────────────────────────
# INTERNACIONALIZACIÓN
# ─────────────────────────────────────────────
LANGUAGE_CODE = "es-pe"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True


# ─────────────────────────────────────────────
# DEFAULT PRIMARY KEY
# ─────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ─────────────────────────────────────────────
# SERVICIOS EXTERNOS — URLs centralizadas
# ─────────────────────────────────────────────
# Env var preferida: N8N_WEBHOOK_BASE_URL.
# Compatibilidad: N8N_WEBHOOK_URL existe en .env.example y docker-compose.
N8N_WEBHOOK_BASE_URL = config(
    "N8N_WEBHOOK_BASE_URL",
    default=config("N8N_WEBHOOK_URL", default="http://localhost:5678"),
)
N8N_WEBHOOK_TIMEOUT = 5             # segundos — "Respond Immediately" debe responder < 500ms
DJANGO_BASE_URL = config("DJANGO_BASE_URL", default="http://host.docker.internal:8000")
SPRINGBOOT_INTERNAL_URL = config("SPRINGBOOT_INTERNAL_URL", default="http://localhost:8081")
INTERNAL_EVENT_TOKEN = config('INTERNAL_EVENT_TOKEN', default='')

GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TTS_MODEL = config("GEMINI_TTS_MODEL", default="gemini-2.5-flash-preview-tts")
GEMINI_TTS_VOICE = config("GEMINI_TTS_VOICE", default="Kore")
GEMINI_TRANSCRIPTION_MODEL = config("GEMINI_TRANSCRIPTION_MODEL", default="gemini-2.5-flash")
GEMINI_TRANSCRIPTION_TIMEOUT = config("GEMINI_TRANSCRIPTION_TIMEOUT", cast=int, default=45)
GEMINI_TIMEOUT = 10                 # segundos — manejo de timeout según HU4

USE_MOCK_AI = config("USE_MOCK_AI", cast=bool, default=False)

# Resend (activo en Sprint 4)
RESEND_API_KEY = config("RESEND_API_KEY", default="")
RESEND_FROM_EMAIL = config("RESEND_FROM_EMAIL", default="noreply@marketmind.ai")

FRONTEND_BASE_URL = config('FRONTEND_BASE_URL', default='http://localhost:5173')
GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')
INSTAGRAM_APP_ID = config('INSTAGRAM_APP_ID', default='')
INSTAGRAM_APP_SECRET = config('INSTAGRAM_APP_SECRET', default='')
INSTAGRAM_REDIRECT_URI = config('INSTAGRAM_REDIRECT_URI', default='')
INSTAGRAM_FRONTEND_ORIGIN = config('INSTAGRAM_FRONTEND_ORIGIN', default='')
SOCIAL_TOKEN_ENCRYPTION_KEY = config('SOCIAL_TOKEN_ENCRYPTION_KEY', default='')
FACEBOOK_APP_ID = config('FACEBOOK_APP_ID', default='')
FACEBOOK_APP_SECRET = config('FACEBOOK_APP_SECRET', default='')
FACEBOOK_REDIRECT_URI = config('FACEBOOK_REDIRECT_URI', default='')
FACEBOOK_LOGIN_CONFIG_ID = config('FACEBOOK_LOGIN_CONFIG_ID', default='')
FACEBOOK_GRAPH_VERSION = config('FACEBOOK_GRAPH_VERSION', default='v23.0')
FACEBOOK_METRICS_PERMISSIONS = config('FACEBOOK_METRICS_PERMISSIONS', default=False, cast=bool)
X_CLIENT_ID = config('X_CLIENT_ID', default='')
X_CLIENT_SECRET = config('X_CLIENT_SECRET', default='')
X_REDIRECT_URI = config('X_REDIRECT_URI', default='')
TIKTOK_CLIENT_KEY = config('TIKTOK_CLIENT_KEY', default='')
TIKTOK_CLIENT_SECRET = config('TIKTOK_CLIENT_SECRET', default='')
TIKTOK_REDIRECT_URI = config('TIKTOK_REDIRECT_URI', default='')
TIKTOK_MEDIA_BASE_URL = config('TIKTOK_MEDIA_BASE_URL', default='')
TIKTOK_MEDIA_VERIFIED = config('TIKTOK_MEDIA_VERIFIED', default=False, cast=bool)
TIKTOK_VERIFICATION_FILE = config('TIKTOK_VERIFICATION_FILE', default='')
TIKTOK_METRICS_PERMISSIONS = config('TIKTOK_METRICS_PERMISSIONS', default=False, cast=bool)
RECOVERY_EMAIL_COOLDOWN_SECONDS = 60
RECOVERY_EMAIL_HOURLY_LIMIT = 5
RECOVERY_IP_HOURLY_LIMIT = 20
PASSWORD_RESET_TIMEOUT = 1800
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', cast=int, default=587)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', cast=bool, default=True)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', cast=bool, default=False)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='NexoMark IA <noreply@localhost>')
