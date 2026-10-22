"""
Entrar y registrarse con Google (ID token firmado), para la web y la app.

Portado de la rama de Piero (google_login.py) con dos cambios:

1. Sobre {success, message, data} en todo salvo `complete/` cuando funciona,
   que responde igual que /api/auth/token/ (access, refresh, role, nombre,
   email) para reutilizar el mismo código de sesión en los clientes.
2. App nativa: una app de Android o iOS no envía la cabecera `Origin`. Se
   acepta su ausencia; un `Origin` presente que no sea de NexoMark sigue en
   403. La protección real es el ticket de un solo uso (10 minutos) con su
   `proof` y el `nonce` que Google firma dentro del ID token.

    GET  /api/auth/google/config/      {configured, client_id}
    POST /api/auth/google/challenge/   {purpose: login|register, role?} → {ticket, proof, nonce, client_id}
    POST /api/auth/google/complete/    {ticket, proof, credential, current_password?}
    POST /api/auth/google/disconnect/  {current_password} (con JWT)

El ID token se verifica con las claves públicas de Google (RS256): audiencia
= alguno de nuestros client ID (web, Android, iOS), emisor de Google, correo
verificado, `sub` y `nonce`. Nunca se guardan tokens de Google.

Reglas de cuenta (ver backend/GOOGLE_LOGIN_SETUP.md en la rama de Piero):
- El `sub` de Google identifica la cuenta, no el correo.
- Correo ya registrado sin vincular → 409 `link_required`: hay que confirmar
  la contraseña de NexoMark (máximo 5 intentos por hora y cuenta).
- Sin cuenta → solo se crea desde "Registrarse con Google", con rol
  marketero o cliente elegido antes, y solo para Gmail o Google Workspace.
- Las cuentas creadas así no tienen contraseña local: la crean con el enlace
  de "Olvidé mi contraseña".
"""

import hashlib
import logging
import secrets
import time
from datetime import timedelta
from urllib.parse import urlsplit

import jwt
from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.settings import api_settings

from core.exceptions import api_response

from .models import GoogleLoginTicket, User, UserRole
from .password_reset import _RecoveryAPIView
from .recovery_throttles import RecoveryRequestThrottle
from .serializers import CustomTokenObtainPairSerializer

logger = logging.getLogger(__name__)

google_keys = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", lifespan=3600, timeout=5)
VIGENCIA_TICKET = timedelta(minutes=10)
EMISORES = ("accounts.google.com", "https://accounts.google.com")


class GoogleNoDisponible(APIException):
    status_code = 503
    default_detail = "No se pudo verificar el límite de intentos. Intenta más tarde."
    default_code = "google_unavailable"


def _hash(valor: str) -> str:
    return hashlib.sha256(valor.encode()).hexdigest()


def audiencias() -> list[str]:
    """Client ID web (Android lo usa como serverClientId) más los nativos, si están."""
    ids = [settings.GOOGLE_CLIENT_ID, *settings.GOOGLE_CLIENT_IDS_NATIVOS]
    return [valor for valor in ids if valor]


def origen_permitido(request: Request) -> bool:
    """Sin Origin: app nativa. Con Origin: debe ser la web de NexoMark."""
    origen = request.headers.get("Origin")
    if origen is None:
        return True
    raiz = urlsplit(settings.FRONTEND_URL)
    permitidos = {f"{raiz.scheme}://{raiz.netloc}", *settings.CORS_ALLOWED_ORIGINS}
    return origen in permitidos


def verificar_token_google(credential: str) -> dict:
    """
    Valida firma y claims del ID token. Devuelve los claims.

    Raises:
        jwt.PyJWTError, ValueError, ValidationError: token inválido.
        Otras excepciones (red): no se pudo consultar a Google.
    """
    clave = google_keys.get_signing_key_from_jwt(credential).key
    claims = jwt.decode(
        credential,
        clave,
        algorithms=["RS256"],
        audience=audiencias(),
        options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce", "email", "email_verified"]},
    )
    if claims.get("iss") not in EMISORES:
        raise ValueError("emisor")
    if claims.get("email_verified") is not True:
        raise ValueError("correo sin verificar")
    if not isinstance(claims.get("sub"), str) or not 1 <= len(claims["sub"]) <= 255:
        raise ValueError("sub")
    if not isinstance(claims.get("nonce"), str) or not 20 <= len(claims["nonce"]) <= 128:
        raise ValueError("nonce")
    email = claims.get("email")
    if not isinstance(email, str) or len(email) > 255:
        raise ValueError("correo")
    validate_email(email)
    return claims


class GoogleThrottle(RecoveryRequestThrottle):
    """30 POST por IP y hora; falla cerrado si la caché no responde."""

    scope = "google-login"

    def allow_request(self, request, view) -> bool:
        self.retry_after = 60
        if request.method != "POST":
            return True
        try:
            return self.hourly_limit(self.scope, request.META.get("REMOTE_ADDR") or "unknown", 30, time.time())
        except Exception:
            logger.error("No se pudo comprobar el límite del acceso con Google; revisa la caché.")
            raise GoogleNoDisponible() from None


class ChallengeSerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=["login", "register"])
    role = serializers.ChoiceField(choices=[UserRole.MARKETERO.value, UserRole.CLIENTE.value], required=False)


class CompleteSerializer(serializers.Serializer):
    ticket = serializers.UUIDField()
    proof = serializers.CharField(min_length=40, max_length=128, trim_whitespace=False)
    credential = serializers.CharField(max_length=8192, trim_whitespace=False)
    current_password = serializers.CharField(max_length=128, trim_whitespace=False, required=False, write_only=True)


def _error(mensaje: str, codigo: int, **datos) -> Response:
    response = Response(api_response(False, mensaje, datos), status=codigo)
    response["Cache-Control"] = "no-store"
    return response


class _GooglePublicView(_RecoveryAPIView):
    throttle_classes = [GoogleThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class GoogleConfigView(_GooglePublicView):
    """Si el servidor no tiene Client ID, los clientes ocultan el botón."""

    def get(self, request: Request) -> Response:
        return Response(api_response(
            success=True,
            message="Configuración del acceso con Google.",
            data={"configured": bool(settings.GOOGLE_CLIENT_ID), "client_id": settings.GOOGLE_CLIENT_ID or None},
        ))


class GoogleChallengeView(_GooglePublicView):
    def post(self, request: Request) -> Response:
        if not origen_permitido(request):
            return _error("Inicia el acceso desde la web o la app de NexoMark.", status.HTTP_403_FORBIDDEN)
        if not settings.GOOGLE_CLIENT_ID:
            return _error("El acceso con Google todavía no está configurado en el servidor.", 503)
        serializer = ChallengeSerializer(data=request.data)
        if not serializer.is_valid():
            return _error(
                "Elige Marketero o Cliente para crear tu cuenta.", status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )
        datos = serializer.validated_data
        if datos["purpose"] == "register" and not datos.get("role"):
            return _error("Elige Marketero o Cliente para crear tu cuenta.", status.HTTP_400_BAD_REQUEST)
        nonce, proof = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        ahora = timezone.now()
        GoogleLoginTicket.objects.filter(expira_en__lt=ahora).delete()
        ticket = GoogleLoginTicket.objects.create(
            nonce_hash=_hash(nonce),
            proof_hash=_hash(proof),
            proposito=datos["purpose"],
            rol=datos.get("role", ""),
            expira_en=ahora + VIGENCIA_TICKET,
        )
        return Response(api_response(
            success=True,
            message="Continúa con Google.",
            data={"ticket": str(ticket.pk), "proof": proof, "nonce": nonce, "client_id": settings.GOOGLE_CLIENT_ID},
        ))


class GoogleCompleteView(_GooglePublicView):
    def post(self, request: Request) -> Response:
        if not origen_permitido(request):
            return _error("Solicitud de acceso no autorizada.", status.HTTP_403_FORBIDDEN)
        if not settings.GOOGLE_CLIENT_ID:
            return _error("El acceso con Google todavía no está configurado en el servidor.", 503)
        serializer = CompleteSerializer(data=request.data)
        if not serializer.is_valid():
            return _error("Faltan datos del acceso con Google. Vuelve a intentarlo.", status.HTTP_400_BAD_REQUEST)
        datos = serializer.validated_data
        vencido = "El intento venció o ya se usó. Vuelve a tocar «Continuar con Google»."
        ticket = GoogleLoginTicket.objects.filter(pk=datos["ticket"], usado=False, expira_en__gt=timezone.now()).first()
        if ticket is None or not constant_time_compare(ticket.proof_hash, _hash(datos["proof"])):
            return _error(vencido, status.HTTP_400_BAD_REQUEST, expired=True)
        try:
            claims = verificar_token_google(datos["credential"])
        except (jwt.PyJWTError, ValueError, ValidationError):
            return _error("No se pudo verificar tu identidad de Google. Vuelve a intentarlo.", 400)
        except Exception:
            logger.warning("No se pudo consultar las claves de Google para verificar el ID token.")
            return _error("No se pudo consultar a Google. Revisa tu conexión e intenta más tarde.", 503)
        if not constant_time_compare(ticket.nonce_hash, _hash(claims["nonce"])):
            return _error("La respuesta de Google no corresponde a este intento.", status.HTTP_400_BAD_REQUEST)

        email = claims["email"].strip().lower()
        try:
            with transaction.atomic():
                ticket = (
                    GoogleLoginTicket.objects.select_for_update()
                    .filter(pk=ticket.pk, usado=False, expira_en__gt=timezone.now())
                    .first()
                )
                if ticket is None:
                    return _error(vencido, status.HTTP_400_BAD_REQUEST, expired=True)
                user = User.objects.select_for_update().filter(google_subject=claims["sub"]).first()
                if user is None:
                    user = User.objects.select_for_update().filter(email__iexact=email).first()
                    if user is not None:
                        respuesta = self._vincular(user, claims, datos.get("current_password"))
                        if respuesta is not None:
                            return respuesta
                    else:
                        respuesta, user = self._registrar(ticket, claims, email)
                        if respuesta is not None:
                            return respuesta
                if not user.is_active:
                    return _error("Tu cuenta está suspendida. Contacta al administrador.", 403, suspended=True)
                ticket.usado = True
                ticket.save(update_fields=["usado"])
                refresh = CustomTokenObtainPairSerializer.get_token(user)
                update_last_login(None, user)
                resultado = {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "role": user.rol,
                    "nombre": user.nombre,
                    "email": user.email,
                }
        except IntegrityError:
            return _error("La cuenta cambió durante el acceso. Vuelve a intentarlo.", status.HTTP_409_CONFLICT)
        return Response(resultado)

    @staticmethod
    def _vincular(user: User, claims: dict, password: str | None) -> Response | None:
        """Correo ya registrado: solo se vincula con la contraseña de NexoMark."""
        if not user.is_active:
            return _error("Tu cuenta está suspendida. Contacta al administrador.", 403, suspended=True)
        if user.google_subject:
            return _error("Ese correo ya está vinculado a otra cuenta de Google.", 403)
        if not password:
            return _error(
                "Ya existe una cuenta con ese correo. Confirma tu contraseña de NexoMark para vincular "
                "Google por primera vez.",
                status.HTTP_409_CONFLICT,
                link_required=True,
            )
        try:
            permitido = GoogleThrottle().hourly_limit("google-vincular:cuenta", str(user.pk), 5, time.time())
        except Exception:
            raise GoogleNoDisponible() from None
        if not permitido:
            return _error("Demasiados intentos de vinculación. Intenta más tarde.", 429)
        if not user.check_password(password):
            return _error("La contraseña de NexoMark no es correcta.", status.HTTP_400_BAD_REQUEST, link_required=True)
        user.google_subject = claims["sub"]
        user.save(update_fields=["google_subject", "fecha_actualizacion"])
        return None

    @staticmethod
    def _registrar(ticket: GoogleLoginTicket, claims: dict, email: str) -> tuple[Response | None, User | None]:
        if ticket.proposito != "register":
            return _error(
                "Aún no tienes cuenta. Toca «Registrarse con Google» y elige cómo usarás NexoMark.",
                status.HTTP_409_CONFLICT,
                registration_required=True,
            ), None
        # Google responde por los correos Gmail y los de Google Workspace verificados.
        if not (email.endswith("@gmail.com") or (isinstance(claims.get("hd"), str) and claims["hd"])):
            return _error(
                "Con este correo regístrate con contraseña; después podrás vincular Google.",
                status.HTTP_400_BAD_REQUEST,
            ), None
        if ticket.rol not in (UserRole.MARKETERO, UserRole.CLIENTE):
            return _error("Rol de registro no válido.", status.HTTP_400_BAD_REQUEST), None
        nombre = claims.get("name")
        nombre = nombre.strip()[:150] if isinstance(nombre, str) else ""
        user = User.objects.create_user(
            email=email,
            password=None,
            nombre=nombre if len(nombre) >= 2 else "Usuario de Google",
            rol=ticket.rol,
            google_subject=claims["sub"],
        )
        return None, user


class GoogleDisconnectView(_RecoveryAPIView):
    """Desvincular exige contraseña local y cierra las sesiones."""

    permission_classes = [IsAuthenticated]
    authentication_classes = api_settings.DEFAULT_AUTHENTICATION_CLASSES
    throttle_classes = [GoogleThrottle]

    def post(self, request: Request) -> Response:
        password = request.data.get("current_password")
        if not isinstance(password, str) or not password or len(password) > 128:
            return _error("Confirma tu contraseña de NexoMark.", status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.is_active or user.token_version != request.user.token_version:
                return _error("La sesión ya no es válida. Inicia sesión nuevamente.", status.HTTP_403_FORBIDDEN)
            if not user.has_usable_password():
                return _error(
                    "Primero crea una contraseña con «Olvidé mi contraseña»; sin ella no podrías volver a entrar.",
                    status.HTTP_400_BAD_REQUEST,
                    password_required=True,
                )
            if not user.check_password(password):
                return _error("La contraseña no es correcta.", status.HTTP_400_BAD_REQUEST)
            user.google_subject = None
            user.token_version += 1
            user.save(update_fields=["google_subject", "token_version", "fecha_actualizacion"])
        response = Response(api_response(
            success=True, message="Google desvinculado. Entra con tu correo y contraseña.", data={}
        ))
        response["Cache-Control"] = "no-store"
        return response
