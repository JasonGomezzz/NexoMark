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
    "apps.social",
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
        "intent_interpret": "30/hour",  # interpretar un brief cuesta cuota del proveedor
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
    # El refresh también valida token_version e is_active contra la BD.
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
DJANGO_BASE_URL = config("DJANGO_BASE_URL", default="http://localhost:8000")
# Dirección pública solo para las imágenes que descarga Meta (p. ej. un túnel
# HTTPS en local). Vacía = DJANGO_BASE_URL. Los callbacks de n8n siguen usando
# DJANGO_BASE_URL para no depender del túnel.
PUBLIC_BASE_URL = config("PUBLIC_BASE_URL", default="")
SPRINGBOOT_INTERNAL_URL = config("SPRINGBOOT_INTERNAL_URL", default="http://localhost:8080")
INTERNAL_EVENT_TOKEN = config("INTERNAL_EVENT_TOKEN", default="dev-internal-event-token")
# Secreto compartido Django ↔ n8n (encabezado X-NexoMark-Token): Django lo envía
# al disparar los webhooks de n8n y lo exige en los callbacks; n8n hace lo mismo
# al revés. El valor por defecto solo sirve en desarrollo: prod.py exige uno propio.
N8N_WEBHOOK_TOKEN = config("N8N_WEBHOOK_TOKEN", default="dev-n8n-webhook-token")

GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT = 10                 # segundos — manejo de timeout según HU4

USE_MOCK_AI = config("USE_MOCK_AI", cast=bool, default=False)

# Resend (activo en Sprint 4)
RESEND_API_KEY = config("RESEND_API_KEY", default="")
RESEND_FROM_EMAIL = config("RESEND_FROM_EMAIL", default="noreply@marketmind.ai")

# ─────────────────────────────────────────────
# CORREO DE DJANGO — recuperación de contraseña
# ─────────────────────────────────────────────
# SMTP de Resend (https://resend.com/docs/send-with-smtp): host smtp.resend.com,
# STARTTLS en 587, usuario "resend" y la API key como contraseña. dev.py usa la
# consola y los tests locmem, así que en local no se gasta cuota del proveedor.
EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="smtp.resend.com")
EMAIL_PORT = config("EMAIL_PORT", cast=int, default=587)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="resend")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default=RESEND_API_KEY)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", cast=bool, default=True)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default=f"NexoMark IA <{RESEND_FROM_EMAIL}>")

# Enlace de recuperación: 30 min y de un solo uso. Límites por correo e IP.
PASSWORD_RESET_TIMEOUT = 1800
RECOVERY_EMAIL_COOLDOWN_SECONDS = 60
RECOVERY_EMAIL_HOURLY_LIMIT = 5
RECOVERY_IP_HOURLY_LIMIT = 20

# ─────────────────────────────────────────────
# META — publicación en Instagram y Facebook (Fase 3)
# ─────────────────────────────────────────────
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")

# ── Acceso con Google (ID token). Sin GOOGLE_CLIENT_ID el botón no aparece ──
# GOOGLE_CLIENT_ID es el cliente web (Android lo usa como serverClientId);
# GOOGLE_CLIENT_IDS_NATIVOS, los de Android e iOS, también válidos como audiencia.
GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_IDS_NATIVOS = config("GOOGLE_CLIENT_IDS_NATIVOS", cast=Csv(), default="")
META_APP_ID = config("META_APP_ID", default="")
META_APP_SECRET = config("META_APP_SECRET", default="")
META_GRAPH_VERSION = config("META_GRAPH_VERSION", default="v25.0")
# Solo con Facebook Login for Business: ID de la configuración creada en la app.
META_LOGIN_CONFIG_ID = config("META_LOGIN_CONFIG_ID", default="")
META_REDIRECT_URI = config(
    "META_REDIRECT_URI",
    default=f"{DJANGO_BASE_URL}/api/social/meta/callback/",
)
# Con META_LOGIN_CONFIG_ID los permisos los fija la configuración de Facebook
# Login para empresas en el panel de Meta: mantenerla igual a esta lista.
META_OAUTH_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    # /{post-id}/insights de Facebook (alcance, vistas, clics) pide read_insights + pages_read_engagement.
    "read_insights",
    # Comentarios de usuarios en la página y /{page-id}/feed (comprobar un post dudoso antes de reintentar).
    "pages_read_user_content",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "business_management",
]
# Clave Fernet para cifrar tokens de página. Obligatoria fuera de DEBUG;
# en desarrollo y tests se deriva de SECRET_KEY.
SOCIAL_TOKEN_KEY = config("SOCIAL_TOKEN_KEY", default="")
# Meta descarga la imagen desde una URL pública firmada que caduca.
PUBLIC_MEDIA_MAX_AGE = 3600

# ─────────────────────────────────────────────
# X (Twitter) — red OPCIONAL, apagada por defecto
# ─────────────────────────────────────────────
# Decisión del 16/10: X no entra en la publicación automática al aprobar. Su
# texto es una variante que el cliente aprueba aparte y el marketero publica
# confirmando el costo. La API de X es de pago por uso (sin plan gratis para
# desarrolladores nuevos): https://docs.x.com/x-api/getting-started/pricing
# (17/10/2026: Post: Create US$0.015; con URL US$0.200; User: Read US$0.010).
X_HABILITADO = config("X_HABILITADO", cast=bool, default=False)
# Credenciales OAuth 2.0 (cliente confidencial) de la app en console.x.com.
X_CLIENT_ID = config("X_CLIENT_ID", default="")
X_CLIENT_SECRET = config("X_CLIENT_SECRET", default="")
# Debe coincidir exactamente con una callback URL registrada en la app de X.
X_REDIRECT_URI = config("X_REDIRECT_URI", default=f"{DJANGO_BASE_URL}/api/social/x/callback/")
X_API_BASE_URL = "https://api.x.com"
# https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
X_OAUTH_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"]
# Costos estimados (USD) y tope de gasto mensual que se aplica en el servidor.
# 0.30 / 0.015 = 20 publicaciones al mes. Conviene fijar además un "spending
# limit" en la consola de X: este tope protege a NexoMark, el de X a la tarjeta.
X_COSTO_POST_USD = config("X_COSTO_POST_USD", default="0.015")
X_COSTO_LECTURA_USD = config("X_COSTO_LECTURA_USD", default="0.010")
X_TOPE_MENSUAL_USD = config("X_TOPE_MENSUAL_USD", default="0.30")
