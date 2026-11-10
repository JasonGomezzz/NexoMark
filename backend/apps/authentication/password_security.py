"""
Cambio de contraseña con la sesión iniciada: límites contra abuso y aviso por correo.

Portado de la rama de Piero (70b3f60d, `password_security.py`) sobre los
contadores atómicos de `recovery_throttles`. Los intentos cuentan por cuenta
(PASSWORD_CHANGE_ACCOUNT_HOURLY_LIMIT) y por IP (PASSWORD_CHANGE_IP_HOURLY_LIMIT)
aunque fallen: así no sirve para adivinar la contraseña actual con una sesión
robada. Si la caché falla se responde 503 sin cambiar nada (falla cerrado).
"""

import logging
import time

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.exceptions import APIException

from .recovery_throttles import RecoveryRequestThrottle

logger = logging.getLogger(__name__)


class PasswordChangeUnavailable(APIException):
    status_code = 503
    default_detail = "No se pudo comprobar el límite de intentos. Intenta más tarde."
    default_code = "password_change_unavailable"


class PasswordChangeThrottle(RecoveryRequestThrottle):
    """Contadores atómicos compartidos; nunca deja pasar si la caché falla."""

    def allow_request(self, request, view) -> bool:
        self.retry_after = 60
        if request.method != "POST":
            return True
        try:
            now = time.time()
            ip = request.META.get("REMOTE_ADDR") or "unknown"
            if not self.hourly_limit("password-change:ip", ip, settings.PASSWORD_CHANGE_IP_HOURLY_LIMIT, now):
                return False
            if request.user.is_authenticated:
                return self.hourly_limit(
                    "password-change:account",
                    str(request.user.pk),
                    settings.PASSWORD_CHANGE_ACCOUNT_HOURLY_LIMIT,
                    now,
                )
            return True
        except APIException:
            raise
        except Exception:
            logger.error("No se pudo comprobar el límite de cambio de contraseña; revisa la conexión con la caché.")
            raise PasswordChangeUnavailable() from None


def notify_password_changed(email: str) -> bool:
    """
    Avisa al correo de la cuenta. El mensaje no lleva contraseña ni enlaces.
    Si el correo falla, devuelve False: la contraseña ya quedó cambiada y no se deshace.
    """
    try:
        return (
            send_mail(
                "Tu contraseña fue cambiada — NexoMark",
                "Se cambió la contraseña de tu cuenta NexoMark y se cerraron todas tus sesiones.\n\n"
                "Si fuiste tú, inicia sesión con tu nueva contraseña. Si no reconoces el cambio, "
                "abre NexoMark directamente, usa «¿Olvidaste tu contraseña?» y escribe a "
                "nexomarkia@gmail.com.\n\n"
                "Nunca compartas tus contraseñas ni códigos de acceso.",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
            == 1
        )
    except Exception:
        logger.error("No se pudo enviar el aviso de cambio de contraseña; revisa el correo saliente.")
        return False
