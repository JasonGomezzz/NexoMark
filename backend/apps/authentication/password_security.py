"""Password-change abuse protection and best-effort security notification."""
import logging
import time

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.exceptions import APIException
from .recovery_throttles import RecoveryRequestThrottle

logger = logging.getLogger(__name__)


class PasswordChangeUnavailable(APIException):
    status_code = 503
    default_detail = 'No se pudo verificar el límite de intentos. Intenta más tarde.'


class PasswordChangeThrottle(RecoveryRequestThrottle):
    """Shared atomic cache counters; never bypass limits on cache failure."""
    def allow_request(self, request, view):
        self.retry_after = 60
        if request.method != 'POST':
            return True
        try:
            now = time.time()
            if not self.hourly_limit('password-change:ip', request.META.get('REMOTE_ADDR') or 'unknown', 20, now):
                return False
            if request.user.is_authenticated:
                return self.hourly_limit('password-change:account', str(request.user.pk), 5, now)
            return True
        except Exception:
            raise PasswordChangeUnavailable() from None


def notify_password_changed(email):
    """No password/token in the message. Mail failure must not undo a saved password."""
    try:
        return send_mail(
            'Tu contraseña fue cambiada — NexoMark',
            'Se cambió la contraseña de tu cuenta NexoMark y se invalidaron las sesiones anteriores.\n\n'
            'Si fuiste tú, inicia sesión con tu nueva contraseña. Si no reconoces el cambio, '
            'abre NexoMark directamente, utiliza «¿Olvidaste tu contraseña?» y contacta al administrador.\n\n'
            'Nunca compartas contraseñas ni códigos de acceso.',
            settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False,
        ) == 1
    except Exception:
        logger.error('No se pudo enviar el aviso de cambio de contraseña; revisa SMTP.')
        return False
