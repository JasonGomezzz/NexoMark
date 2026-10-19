"""Two-mailbox confirmation with atomic completion and JWT revocation.

GET never consumes a token. Secrets travel in URL fragments, not HTTP query logs.
All mutation paths lock the owner first, then its single pending request.
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
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import EmailChangeRequest, User
from .password_reset import RecoveryAPIView
from .recovery_throttles import RecoveryRequestThrottle

logger = logging.getLogger(__name__)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def fingerprint(user):
    return salted_hmac('email-change-password', user.password, algorithm='sha256').hexdigest()


def valid_pending(pending, user):
    return (pending.expires_at > timezone.now() and user.is_active
            and pending.old_email == user.email and pending.token_version == user.token_version
            and constant_time_compare(pending.password_fingerprint, fingerprint(user)))


class EmailChangeUnavailable(APIException):
    status_code = 503
    default_detail = 'No se pudo enviar la solicitud. Intenta más tarde.'


class EmailChangeThrottle(RecoveryRequestThrottle):
    scope = 'email-change-request'

    def allow_request(self, request, view):
        if request.method != 'POST':
            return True
        self.retry_after = 60
        try:
            now = time.time()
            if not self.hourly_limit(f'{self.scope}:ip', request.META.get('REMOTE_ADDR') or 'unknown', 30, now):
                return False
            # Both account and target limits prevent one account/address being spammed.
            if request.user.is_authenticated:
                if not self.hourly_limit(self.scope, str(request.user.pk), 5, now):
                    return False
                target = request.data.get('new_email', '') if isinstance(request.data, dict) else ''
                if isinstance(target, str) and len(target) <= 255:
                    return self.hourly_limit(f'{self.scope}:target', target.strip().lower(), 5, now)
            return True
        except Exception:
            raise EmailChangeUnavailable() from None


class EmailConfirmThrottle(EmailChangeThrottle):
    scope = 'email-change-confirm'


class ChangeInput(serializers.Serializer):
    new_email = serializers.EmailField(max_length=255)
    current_password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)


class ConfirmInput(serializers.Serializer):
    request_id = serializers.IntegerField(min_value=1)
    side = serializers.ChoiceField(choices=['old', 'new'])
    token = serializers.CharField(min_length=40, max_length=128, trim_whitespace=False)


class EmailChangeView(RecoveryAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [EmailChangeThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def get(self, request):
        pending = EmailChangeRequest.objects.filter(owner=request.user).first()
        data = None
        if pending and valid_pending(pending, request.user):
            data = {'new_email': pending.new_email, 'old_confirmed': pending.old_confirmed,
                    'new_confirmed': pending.new_confirmed, 'expires_at': pending.expires_at.isoformat()}
        return Response({'data': {'pending': data}})

    def delete(self, request):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            EmailChangeRequest.objects.filter(owner=user).delete()
        return Response({'message': 'Solicitud cancelada. Tu correo no cambió.'})

    def post(self, request):
        serializer = ChangeInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.is_active or user.token_version != request.user.token_version:
                return Response({'message': 'La sesión ya no es válida.'}, status=403)
            if not user.check_password(data['current_password']):
                return Response({'message': 'La contraseña actual no es correcta.'}, status=400)
            target = data['new_email'].strip().lower()
            if target == user.email.lower() or User.objects.filter(email__iexact=target).exists():
                return Response({'message': 'No puedes utilizar ese correo. Revisa la dirección.'}, status=400)
            old_token, new_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            EmailChangeRequest.objects.filter(owner=user).delete()
            pending = EmailChangeRequest.objects.create(
                owner=user, old_email=user.email, new_email=target,
                old_token_hash=digest(old_token), new_token_hash=digest(new_token),
                token_version=user.token_version, password_fingerprint=fingerprint(user),
                expires_at=timezone.now() + timedelta(minutes=30))
            try:
                for side, token, recipient in [('old', old_token, user.email), ('new', new_token, target)]:
                    fragment = urlencode({'request_id': pending.pk, 'side': side, 'token': token})
                    url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/confirm-email-change#{fragment}"
                    sent = send_mail('Confirma el cambio de correo — NexoMark',
                                    f'Se solicitó cambiar el correo de tu cuenta NexoMark.\n\n'
                                    f'Abre el enlace y pulsa Confirmar:\n{url}\n\n'
                                    'Vence en 30 minutos. El cambio requiere confirmar ambos correos. '
                                    'Si no lo solicitaste, no confirmes y cancela la solicitud desde Configuración; '
                                    'revisa también la seguridad de tu cuenta.',
                                    settings.DEFAULT_FROM_EMAIL, [recipient], fail_silently=False)
                    if sent != 1:
                        raise RuntimeError('Mail not accepted')
            except Exception:
                # Raising out of atomic rolls back pending changes, even after partial delivery.
                logger.error('No se pudo enviar el cambio de correo; revisa SMTP. No se modificó la cuenta.')
                raise EmailChangeUnavailable() from None
        return Response({'message': 'Revisa ambos correos. Debes confirmar los dos enlaces antes de 30 minutos.'}, status=202)


class EmailChangeConfirmView(RecoveryAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [EmailConfirmThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def post(self, request):
        serializer = ConfirmInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invalid = {'message': 'El enlace no es válido, ya fue utilizado o ha vencido.'}
        owner_id = EmailChangeRequest.objects.filter(pk=data['request_id']).values_list('owner_id', flat=True).first()
        if owner_id is None:
            return Response(invalid, status=400)
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().filter(pk=owner_id).first()
                if user is None:
                    return Response(invalid, status=400)
                pending = EmailChangeRequest.objects.select_for_update().filter(pk=data['request_id'], owner=user).first()
                if not pending or not valid_pending(pending, user):
                    return Response(invalid, status=400)
                side = data['side']
                if not constant_time_compare(getattr(pending, f'{side}_token_hash'), digest(data['token'])):
                    return Response(invalid, status=400)
                setattr(pending, f'{side}_confirmed', True)
                setattr(pending, f'{side}_token_hash', '')
                if not (pending.old_confirmed and pending.new_confirmed):
                    pending.save(update_fields=[f'{side}_confirmed', f'{side}_token_hash'])
                    return Response({'message': 'Confirmación registrada. Falta confirmar el enlace del otro correo.', 'completed': False})
                if User.objects.exclude(pk=user.pk).filter(email__iexact=pending.new_email).exists():
                    pending.delete()
                    return Response({'message': 'Ese correo ya no está disponible. Solicita otro cambio.'}, status=409)
                user.email = pending.new_email
                user.token_version += 1
                user.save(update_fields=['email', 'token_version', 'fecha_actualizacion'])
                pending.delete()
        except IntegrityError:
            return Response({'message': 'No se pudo completar el cambio. Solicita otro cambio.'}, status=409)
        return Response({'message': 'Correo actualizado. Se cerraron las sesiones anteriores. Inicia sesión con el nuevo correo.', 'completed': True})
