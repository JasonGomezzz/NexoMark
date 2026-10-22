"""
Cambio de correo con doble confirmación y cierre de sesiones.

Portado de la rama de Piero (email_change.py), con el sobre
{success, message, data} y los nombres de `remejora`:

    GET    /api/auth/me/change-email/           solicitud pendiente (o null)
    POST   /api/auth/me/change-email/           {new_email, current_password}
    DELETE /api/auth/me/change-email/           cancelar la solicitud
    POST   /api/auth/email-change/confirm/      {request_id, side, token} (sin JWT)

- Se envía un enlace al correo actual y otro al nuevo; el cambio ocurre solo
  cuando ambos se confirman antes de 30 minutos.
- Los enlaces llevan el token en el fragmento (#): no llega a los logs del
  servidor web. En la BD solo queda su SHA-256.
- La solicitud deja de valer si cambia el token_version, el correo actual o la
  contraseña. Al completarse sube token_version: se cierran todas las sesiones.
- Si el correo no se puede enviar, la transacción se revierte (503) y no queda
  ninguna solicitud a medias.
"""

import hashlib
import logging
import secrets
import time
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.settings import api_settings

from core.exceptions import api_response

from .models import EmailChangeRequest, User
from .password_reset import _RecoveryAPIView
from .recovery_throttles import RecoveryRequestThrottle

logger = logging.getLogger(__name__)

VIGENCIA = timedelta(minutes=30)
RUTA_CONFIRMAR = "/confirm-email-change"
MENSAJE_ENLACE_INVALIDO = "El enlace no es válido, ya se usó o venció. Si aún quieres cambiar tu correo, solicítalo otra vez."


def _hash(valor: str) -> str:
    return hashlib.sha256(valor.encode()).hexdigest()


def huella_password(user: User) -> str:
    """HMAC del hash de la contraseña: cambiarla invalida la solicitud sin guardar el hash."""
    return salted_hmac("cambio-correo-password", user.password, algorithm="sha256").hexdigest()


def vigente(pendiente: EmailChangeRequest, user: User) -> bool:
    return (
        pendiente.expira_en > timezone.now()
        and user.is_active
        and pendiente.correo_actual == user.email
        and pendiente.token_version == user.token_version
        and constant_time_compare(pendiente.huella_password, huella_password(user))
    )


def datos_pendiente(pendiente: EmailChangeRequest | None, user: User) -> dict | None:
    if pendiente is None or not vigente(pendiente, user):
        return None
    return {
        "new_email": pendiente.correo_nuevo,
        "old_confirmed": pendiente.actual_confirmado,
        "new_confirmed": pendiente.nuevo_confirmado,
        "expires_at": pendiente.expira_en.isoformat(),
    }


class CambioCorreoNoDisponible(APIException):
    status_code = 503
    default_detail = "No se pudo enviar la solicitud. Intenta más tarde."
    default_code = "email_change_unavailable"


class EmailChangeThrottle(RecoveryRequestThrottle):
    """5 solicitudes por cuenta y por correo destino cada hora; 30 por IP."""

    scope = "email-change-request"

    def allow_request(self, request, view) -> bool:
        if request.method != "POST":
            return True
        self.retry_after = 60
        try:
            ahora = time.time()
            ip = request.META.get("REMOTE_ADDR") or "unknown"
            if not self.hourly_limit(f"{self.scope}:ip", ip, 30, ahora):
                return False
            if request.user and request.user.is_authenticated:
                if not self.hourly_limit(self.scope, str(request.user.pk), 5, ahora):
                    return False
                destino = request.data.get("new_email", "") if hasattr(request.data, "get") else ""
                if isinstance(destino, str) and 0 < len(destino) <= 255:
                    return self.hourly_limit(f"{self.scope}:destino", destino.strip().lower(), 5, ahora)
            return True
        except Exception:
            logger.error("No se pudo comprobar el límite del cambio de correo; revisa la caché.")
            raise CambioCorreoNoDisponible() from None


class EmailConfirmThrottle(EmailChangeThrottle):
    scope = "email-change-confirm"


class SolicitudSerializer(serializers.Serializer):
    new_email = serializers.EmailField(max_length=255)
    current_password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)


class ConfirmacionSerializer(serializers.Serializer):
    request_id = serializers.IntegerField(min_value=1)
    side = serializers.ChoiceField(choices=["old", "new"])
    token = serializers.CharField(min_length=40, max_length=128, trim_whitespace=False)


def _sin_cache(response: Response) -> Response:
    response["Cache-Control"] = "no-store"
    return response


def _enviar(destinatario: str, solicitud_id: int, lado: str, token: str, nombre: str) -> None:
    fragmento = urlencode({"request_id": solicitud_id, "side": lado, "token": token})
    url = f"{settings.FRONTEND_URL.rstrip('/')}{RUTA_CONFIRMAR}#{fragmento}"
    cual = "tu correo actual" if lado == "old" else "tu nuevo correo"
    enviados = send_mail(
        subject="Confirma el cambio de correo — NexoMark IA",
        message=(
            f"Hola {nombre}:\n\n"
            f"Se pidió cambiar el correo de tu cuenta de NexoMark IA. Este enlace confirma {cual}:\n\n"
            f"{url}\n\n"
            "Vence en 30 minutos. El cambio solo ocurre cuando se confirman los dos correos, "
            "y al completarse se cierran todas tus sesiones.\n\n"
            "Si no lo pediste, no abras el enlace, cancela la solicitud desde Cuenta → Seguridad "
            "y cambia tu contraseña."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[destinatario],
        fail_silently=False,
    )
    if enviados != 1:
        raise RuntimeError("El servidor de correo no aceptó el mensaje")


class EmailChangeView(_RecoveryAPIView):
    """Solicitar, consultar o cancelar el cambio de correo del usuario autenticado."""

    permission_classes = [IsAuthenticated]
    # _RecoveryAPIView es pública; esta vista vuelve a exigir el JWT.
    authentication_classes = api_settings.DEFAULT_AUTHENTICATION_CLASSES
    throttle_classes = [EmailChangeThrottle]

    def get(self, request: Request) -> Response:
        pendiente = EmailChangeRequest.objects.filter(usuario=request.user).first()
        return _sin_cache(Response(api_response(
            success=True,
            message="Estado del cambio de correo.",
            data={"pending": datos_pendiente(pendiente, request.user)},
        )))

    def delete(self, request: Request) -> Response:
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            EmailChangeRequest.objects.filter(usuario=user).delete()
        return _sin_cache(Response(api_response(
            success=True, message="Solicitud cancelada. Tu correo no cambió.", data={"pending": None}
        )))

    def post(self, request: Request) -> Response:
        serializer = SolicitudSerializer(data=request.data)
        if not serializer.is_valid():
            return _sin_cache(Response(
                api_response(False, "Revisa el correo nuevo y tu contraseña.", {"errors": serializer.errors}),
                status=status.HTTP_400_BAD_REQUEST,
            ))
        datos = serializer.validated_data
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.is_active or user.token_version != request.user.token_version:
                return _sin_cache(Response(
                    api_response(False, "La sesión ya no es válida. Inicia sesión nuevamente.", {}),
                    status=status.HTTP_403_FORBIDDEN,
                ))
            if not user.has_usable_password():
                return _sin_cache(Response(
                    api_response(
                        False,
                        "Tu cuenta entra con Google y aún no tiene contraseña. Crea una con «Olvidé mi "
                        "contraseña» y luego cambia el correo.",
                        {"password_required": True},
                    ),
                    status=status.HTTP_400_BAD_REQUEST,
                ))
            if not user.check_password(datos["current_password"]):
                return _sin_cache(Response(
                    api_response(False, "La contraseña actual no es correcta.", {}),
                    status=status.HTTP_400_BAD_REQUEST,
                ))
            destino = datos["new_email"].strip().lower()
            if destino == user.email.lower() or User.objects.filter(email__iexact=destino).exists():
                return _sin_cache(Response(
                    api_response(False, "No puedes usar ese correo. Revisa la dirección.", {}),
                    status=status.HTTP_400_BAD_REQUEST,
                ))
            token_actual, token_nuevo = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            EmailChangeRequest.objects.filter(usuario=user).delete()
            pendiente = EmailChangeRequest.objects.create(
                usuario=user,
                correo_actual=user.email,
                correo_nuevo=destino,
                hash_token_actual=_hash(token_actual),
                hash_token_nuevo=_hash(token_nuevo),
                token_version=user.token_version,
                huella_password=huella_password(user),
                expira_en=timezone.now() + VIGENCIA,
            )
            try:
                _enviar(user.email, pendiente.pk, "old", token_actual, user.nombre)
                _enviar(destino, pendiente.pk, "new", token_nuevo, user.nombre)
            except Exception:
                # Salir del atomic con excepción revierte la solicitud aunque un correo haya salido.
                logger.error("No se pudo enviar el cambio de correo; revisa EMAIL_*. La cuenta no cambió.")
                raise CambioCorreoNoDisponible() from None
        return _sin_cache(Response(
            api_response(
                success=True,
                message="Te enviamos un enlace a cada correo. Confirma los dos antes de 30 minutos.",
                data={"pending": datos_pendiente(pendiente, user)},
            ),
            status=status.HTTP_202_ACCEPTED,
        ))


class EmailChangeConfirmView(_RecoveryAPIView):
    """Confirma uno de los dos enlaces. Público: el token del correo es la prueba."""

    permission_classes = [AllowAny]
    throttle_classes = [EmailConfirmThrottle]

    def post(self, request: Request) -> Response:
        serializer = ConfirmacionSerializer(data=request.data)
        invalido = _sin_cache(Response(
            api_response(False, MENSAJE_ENLACE_INVALIDO, {}), status=status.HTTP_400_BAD_REQUEST
        ))
        if not serializer.is_valid():
            return invalido
        datos = serializer.validated_data
        usuario_id = (
            EmailChangeRequest.objects.filter(pk=datos["request_id"]).values_list("usuario_id", flat=True).first()
        )
        if usuario_id is None:
            return invalido
        try:
            with transaction.atomic():
                # Primero el usuario y luego su solicitud: el mismo orden que en POST y DELETE.
                user = User.objects.select_for_update().filter(pk=usuario_id).first()
                pendiente = (
                    EmailChangeRequest.objects.select_for_update()
                    .filter(pk=datos["request_id"], usuario_id=usuario_id)
                    .first()
                )
                if user is None or pendiente is None or not vigente(pendiente, user):
                    return invalido
                campo_hash = "hash_token_actual" if datos["side"] == "old" else "hash_token_nuevo"
                campo_ok = "actual_confirmado" if datos["side"] == "old" else "nuevo_confirmado"
                guardado = getattr(pendiente, campo_hash)
                if not guardado or not constant_time_compare(guardado, _hash(datos["token"])):
                    return invalido
                setattr(pendiente, campo_ok, True)
                setattr(pendiente, campo_hash, "")
                if not (pendiente.actual_confirmado and pendiente.nuevo_confirmado):
                    pendiente.save(update_fields=[campo_ok, campo_hash])
                    falta = "tu nuevo correo" if datos["side"] == "old" else "tu correo actual"
                    return _sin_cache(Response(api_response(
                        success=True,
                        message=f"Confirmación registrada. Falta abrir el enlace que enviamos a {falta}.",
                        data={"completed": False},
                    )))
                if User.objects.exclude(pk=user.pk).filter(email__iexact=pendiente.correo_nuevo).exists():
                    pendiente.delete()
                    return _sin_cache(Response(
                        api_response(False, "Ese correo ya no está disponible. Solicita otro cambio.", {}),
                        status=status.HTTP_409_CONFLICT,
                    ))
                user.email = pendiente.correo_nuevo
                user.token_version += 1  # cierra todas las sesiones (Django y Spring)
                user.save(update_fields=["email", "token_version", "fecha_actualizacion"])
                pendiente.delete()
        except IntegrityError:
            return _sin_cache(Response(
                api_response(False, "No se pudo completar el cambio. Solicita otro cambio.", {}),
                status=status.HTTP_409_CONFLICT,
            ))
        return _sin_cache(Response(api_response(
            success=True,
            message="Correo actualizado. Se cerraron tus sesiones: inicia sesión con el nuevo correo.",
            data={"completed": True},
        )))
