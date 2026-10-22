"""
Recuperación de contraseña por correo con enlace de un solo uso.

Adaptado de la rama de Piero (cd8483ba, 26d19738):

- La respuesta de la solicitud es idéntica exista o no la cuenta, y no delata
  por tiempo: la petición solo valida el formato, aplica los límites y agenda
  el trabajo. Buscar la cuenta, crear el token y enviar el correo ocurre en un
  hilo aparte, lanzado con `transaction.on_commit` (mismo patrón que el aviso
  HU16 de `signals.py`).
- El token es aleatorio (256 bits); en la BD solo queda su SHA-256, con
  caducidad (PASSWORD_RESET_TIMEOUT) y marca de uso.
- Restablecer la contraseña sube `token_version`: se invalidan todos los JWT
  (Django y Spring) y, con VersionedTokenRefreshSerializer, también el refresh.
- El correo sale por el backend de Django (`send_mail`): consola en desarrollo,
  locmem en tests y SMTP de Resend en producción (ver EMAIL_* en settings).
  No pasa por n8n: no hace falta tocar el workflow ni exponer el enlace en un
  webhook sin autenticación.
"""

import hashlib
import logging
import math
import secrets
import threading
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import connections, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import api_response

from .models import PasswordResetToken, User
from .recovery_throttles import RecoveryConfirmThrottle, RecoveryRequestThrottle

logger = logging.getLogger(__name__)

MENSAJE_SOLICITUD = (
    "Si el correo corresponde a una cuenta activa, recibirás un enlace para "
    "restablecer tu contraseña. Revisa también la carpeta de spam."
)
MENSAJE_ENLACE_INVALIDO = "El enlace no es válido o ya venció. Solicita uno nuevo."


class EnlaceInvalido(Exception):
    """Token inexistente, usado, vencido o de una cuenta inactiva."""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── Lógica ──────────────────────────────────────────────────


def crear_token(user: User) -> str:
    """Crea un enlace nuevo e invalida los anteriores sin usar. Devuelve el token en claro."""
    token = secrets.token_urlsafe(32)
    ahora = timezone.now()
    with transaction.atomic():
        PasswordResetToken.objects.filter(usuario=user, usado_en__isnull=True).delete()
        PasswordResetToken.objects.create(
            usuario=user,
            token_hash=_hash(token),
            fecha_creacion=ahora,
            expira_en=ahora + timedelta(seconds=settings.PASSWORD_RESET_TIMEOUT),
        )
    return token


def enviar_correo(user: User, token: str) -> None:
    # Fragmento (#): el token no llega a logs del servidor web ni al Referer.
    url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password#{urlencode({'token': token})}"
    minutos = max(1, settings.PASSWORD_RESET_TIMEOUT // 60)
    send_mail(
        subject="Restablece tu contraseña — NexoMark IA",
        message=(
            f"Hola {user.nombre}:\n\n"
            f"Abre este enlace para elegir una nueva contraseña:\n\n{url}\n\n"
            f"Vence en {minutos} minutos y solo sirve una vez. Al cambiarla se "
            "cerrarán tus sesiones abiertas.\n\n"
            "Si no lo solicitaste, ignora este correo: tu contraseña no cambia."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def procesar_solicitud(email: str) -> bool:
    """Envía el enlace si el correo es de una cuenta activa. Devuelve si se envió."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    # Las cuentas creadas con Google no tienen contraseña: este enlace es su "Crear contraseña".
    if user is None or not (user.has_usable_password() or user.google_subject):
        return False
    enviar_correo(user, crear_token(user))
    return True


def _procesar_en_hilo(email: str) -> None:
    try:
        procesar_solicitud(email)
    except Exception:  # noqa: BLE001 — el usuario ya recibió la respuesta genérica
        logger.exception("No se pudo enviar el correo de recuperación; revisa EMAIL_* y la clave de Resend.")
    finally:
        connections.close_all()


def _iniciar_hilo(email: str) -> None:
    threading.Thread(
        target=_procesar_en_hilo, args=(email,), name="recuperacion-contrasena", daemon=True
    ).start()


def programar_solicitud(email: str) -> None:
    """Agenda el trabajo fuera de la petición para que la respuesta no dependa de la cuenta."""
    transaction.on_commit(lambda: _iniciar_hilo(email))


def restablecer(token: str, nueva_password: str) -> User:
    """
    Cambia la contraseña con un token vigente y lo consume.

    Raises:
        EnlaceInvalido: token desconocido, usado, vencido o cuenta inactiva.
        ValidationError: la contraseña no cumple AUTH_PASSWORD_VALIDATORS
            (el token no se consume y puede reintentarse).
    """
    with transaction.atomic():
        registro = (
            PasswordResetToken.objects.select_for_update()
            .filter(token_hash=_hash(token))
            .first()
        )
        ahora = timezone.now()
        if registro is None or registro.usado_en is not None or registro.expira_en <= ahora:
            raise EnlaceInvalido()
        user = User.objects.select_for_update().filter(pk=registro.usuario_id, is_active=True).first()
        if user is None:
            raise EnlaceInvalido()

        validate_password(nueva_password, user=user)

        user.set_password(nueva_password)
        user.token_version += 1  # cierra todas las sesiones (access y refresh)
        user.save(update_fields=["password", "token_version", "fecha_actualizacion"])
        registro.usado_en = ahora
        registro.save(update_fields=["usado_en"])
        PasswordResetToken.objects.filter(usuario=user, usado_en__isnull=True).delete()
    return user


# ── API ─────────────────────────────────────────────────────


class SolicitudSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class ConfirmacionSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)
    new_password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)


class _RecoveryAPIView(APIView):
    """Vistas públicas: sin JWT y con límites propios en vez de los globales."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def handle_exception(self, exc: Exception) -> Response:
        response = super().handle_exception(exc)
        if isinstance(exc, Throttled):
            seconds = max(1, math.ceil(exc.wait or 60))
            minutes = math.ceil(seconds / 60)
            if seconds < 60:
                duracion = f"{seconds} {'segundo' if seconds == 1 else 'segundos'}"
            else:
                duracion = f"{minutes} {'minuto' if minutes == 1 else 'minutos'}"
            response.data = api_response(
                success=False,
                message=f"Demasiados intentos. Intenta nuevamente en {duracion}.",
                data={"retry_after": seconds},
            )
            response["Retry-After"] = str(seconds)
        return response


class PasswordResetRequestView(_RecoveryAPIView):
    """
    POST /api/auth/password-reset/  {email}

    Siempre 200 con el mismo mensaje (exista o no la cuenta); 400 si el correo
    no tiene formato válido; 429 al superar los límites; 503 si la caché falla.
    """

    throttle_classes = [RecoveryRequestThrottle]

    def post(self, request: Request) -> Response:
        serializer = SolicitudSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                api_response(success=False, message="Ingresa un correo válido.", data={"errors": serializer.errors}),
                status=status.HTTP_400_BAD_REQUEST,
            )
        programar_solicitud(serializer.validated_data["email"].strip().lower())
        return Response(
            api_response(
                success=True,
                message=MENSAJE_SOLICITUD,
                data={"resend_after": settings.RECOVERY_EMAIL_COOLDOWN_SECONDS},
            ),
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(_RecoveryAPIView):
    """
    POST /api/auth/password-reset/confirm/  {token, new_password}

    200 si cambió la contraseña (y se cerraron las sesiones); 400 si el enlace
    no sirve o la contraseña es débil; 429 al superar el límite por IP.
    """

    throttle_classes = [RecoveryConfirmThrottle]

    def post(self, request: Request) -> Response:
        serializer = ConfirmacionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                api_response(success=False, message="Datos incompletos.", data={"errors": serializer.errors}),
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            restablecer(serializer.validated_data["token"], serializer.validated_data["new_password"])
        except EnlaceInvalido:
            return Response(
                api_response(success=False, message=MENSAJE_ENLACE_INVALIDO, data={}),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValidationError as exc:
            return Response(
                api_response(
                    success=False,
                    message=" ".join(exc.messages),
                    data={"errors": {"new_password": exc.messages}},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            api_response(
                success=True,
                message="Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
                data={},
            ),
            status=status.HTTP_200_OK,
        )
