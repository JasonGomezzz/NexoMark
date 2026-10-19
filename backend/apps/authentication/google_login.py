"""Google Identity Services: signed ID token + browser challenge, not publication OAuth."""
import hashlib
import secrets
import time
from datetime import timedelta
from urllib.parse import urlsplit

import jwt
from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import GoogleLoginTicket, User
from .password_reset import RecoveryAPIView
from .password_security import PasswordChangeUnavailable
from .recovery_throttles import RecoveryRequestThrottle
from .serializers import CustomTokenObtainPairSerializer

google_keys = jwt.PyJWKClient('https://www.googleapis.com/oauth2/v3/certs', lifespan=3600, timeout=5)


def hashed(value):
    return hashlib.sha256(value.encode()).hexdigest()


def origin_allowed(request):
    root = urlsplit(settings.FRONTEND_BASE_URL)
    allowed = {f'{root.scheme}://{root.netloc}', *settings.CORS_ALLOWED_ORIGINS}
    return request.headers.get('Origin') in allowed


def verify_google_token(credential):
    key = google_keys.get_signing_key_from_jwt(credential).key
    claims = jwt.decode(credential, key, algorithms=['RS256'], audience=settings.GOOGLE_CLIENT_ID,
                        options={'require': ['exp', 'iat', 'iss', 'aud', 'sub', 'nonce', 'email', 'email_verified']})
    if claims.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise ValueError('issuer')
    if claims.get('email_verified') is not True:
        raise ValueError('email')
    if not isinstance(claims.get('sub'), str) or not 1 <= len(claims['sub']) <= 255:
        raise ValueError('subject')
    if not isinstance(claims.get('nonce'), str) or not 20 <= len(claims['nonce']) <= 128:
        raise ValueError('nonce')
    email = claims.get('email')
    if not isinstance(email, str) or len(email) > 255:
        raise ValueError('email')
    validate_email(email)
    return claims


class GoogleThrottle(RecoveryRequestThrottle):
    scope = 'google-login'

    def allow_request(self, request, view):
        self.retry_after = 60
        if request.method != 'POST':
            return True
        try:
            now = time.time()
            return self.hourly_limit(self.scope, request.META.get('REMOTE_ADDR') or 'unknown', 30, now)
        except Exception:
            raise PasswordChangeUnavailable() from None


class GoogleChallengeInput(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=['login', 'register'])
    role = serializers.ChoiceField(choices=['marketero', 'cliente'], required=False)


class GoogleCompleteInput(serializers.Serializer):
    ticket = serializers.UUIDField()
    proof = serializers.CharField(min_length=40, max_length=128, trim_whitespace=False)
    credential = serializers.CharField(max_length=8192, trim_whitespace=False)
    current_password = serializers.CharField(max_length=128, trim_whitespace=False, required=False, write_only=True)


class GooglePublicView(RecoveryAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [GoogleThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class GoogleConfigView(GooglePublicView):
    def get(self, request):
        return Response({'data': {'configured': bool(settings.GOOGLE_CLIENT_ID)}})


class GoogleChallengeView(GooglePublicView):
    def post(self, request):
        if not origin_allowed(request):
            return Response({'message': 'Inicia el acceso desde la web configurada de NexoMark.'}, status=403)
        if not settings.GOOGLE_CLIENT_ID:
            return Response({'message': 'Falta configurar el Client ID de Google en el servidor.'}, status=503)
        serializer = GoogleChallengeInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data['purpose'] == 'register' and not data.get('role'):
            return Response({'message': 'Elige Marketero o Cliente para crear tu cuenta.'}, status=400)
        nonce, proof = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        GoogleLoginTicket.objects.filter(expires_at__lt=timezone.now()).delete()
        ticket = GoogleLoginTicket.objects.create(nonce_hash=hashed(nonce), proof_hash=hashed(proof),
            purpose=data['purpose'], role=data.get('role', ''), expires_at=timezone.now() + timedelta(minutes=10))
        return Response({'data': {'ticket': str(ticket.pk), 'proof': proof, 'nonce': nonce, 'client_id': settings.GOOGLE_CLIENT_ID}})


class GoogleCompleteView(GooglePublicView):
    def post(self, request):
        if not origin_allowed(request):
            return Response({'message': 'Solicitud de acceso no autorizada.'}, status=403)
        if not settings.GOOGLE_CLIENT_ID:
            return Response({'message': 'El acceso con Google aún no está configurado.'}, status=503)
        serializer = GoogleCompleteInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        ticket = GoogleLoginTicket.objects.filter(pk=data['ticket'], used=False, expires_at__gt=timezone.now()).first()
        if ticket is None or not constant_time_compare(ticket.proof_hash, hashed(data['proof'])):
            return Response({'message': 'El acceso venció o ya se utilizó. Vuelve a intentar con Google.'}, status=400)
        try:
            claims = verify_google_token(data['credential'])
        except (jwt.PyJWTError, ValueError, ValidationError):
            return Response({'message': 'No se pudo verificar tu identidad de Google. Vuelve a intentarlo.'}, status=400)
        except Exception:
            return Response({'message': 'No se pudo consultar la verificación de Google. Intenta más tarde.'}, status=503)
        if not constant_time_compare(ticket.nonce_hash, hashed(claims['nonce'])):
            return Response({'message': 'La respuesta no corresponde a este intento de acceso.'}, status=400)
        email = claims['email'].strip().lower()
        try:
            with transaction.atomic():
                # Serialize one Google attempt, then lock any affected account.
                ticket = GoogleLoginTicket.objects.select_for_update().filter(pk=ticket.pk, used=False, expires_at__gt=timezone.now()).first()
                if ticket is None:
                    return Response({'message': 'Este intento ya se utilizó o venció.'}, status=400)
                user = User.objects.select_for_update().filter(google_subject=claims['sub']).first()
                if user is None:
                    user = User.objects.select_for_update().filter(email__iexact=email).first()
                    if user is not None:
                        if not user.is_active or user.google_subject:
                            return Response({'message': 'No se puede vincular esa cuenta. Contacta al administrador.'}, status=403)
                        password = data.get('current_password')
                        if not password:
                            return Response({'message': 'Ya existe una cuenta con ese correo. Confirma tu contraseña de NexoMark para vincular Google por primera vez.', 'link_required': True}, status=409)
                        limiter = GoogleThrottle()
                        try:
                            allowed = limiter.hourly_limit('google-link:account', str(user.pk), 5, time.time())
                        except Exception:
                            raise PasswordChangeUnavailable() from None
                        if not allowed:
                            return Response({'message': 'Demasiados intentos de vinculación. Intenta más tarde.'}, status=429)
                        if not user.check_password(password):
                            return Response({'message': 'La contraseña de NexoMark no es correcta.', 'link_required': True}, status=400)
                        user.google_subject = claims['sub']
                        user.save(update_fields=['google_subject', 'fecha_actualizacion'])
                    else:
                        if ticket.purpose != 'register':
                            return Response({'message': 'Primero crea tu cuenta desde «Registrarse con Google» y elige cómo usarás NexoMark.', 'registration_required': True}, status=409)
                        # Google is authoritative for Gmail and verified Workspace accounts.
                        if not (email.endswith('@gmail.com') or isinstance(claims.get('hd'), str) and claims['hd']):
                            return Response({'message': 'Para este correo usa el registro con contraseña; después podrás vincular Google.'}, status=400)
                        if ticket.role not in ('marketero', 'cliente'):
                            return Response({'message': 'Rol de registro no válido.'}, status=400)
                        name = claims.get('name')
                        name = name.strip()[:150] if isinstance(name, str) else ''
                        user = User.objects.create_user(email=email, password=None, nombre=name if len(name) >= 2 else 'Usuario Google',
                            rol=ticket.role, google_subject=claims['sub'])
                if not user.is_active:
                    return Response({'message': 'La cuenta está suspendida. Contacta al administrador.'}, status=403)
                ticket.used = True
                ticket.save(update_fields=['used'])
                refresh = CustomTokenObtainPairSerializer.get_token(user)
                update_last_login(None, user)
                result = {'access': str(refresh.access_token), 'refresh': str(refresh), 'role': user.rol, 'nombre': user.nombre, 'email': user.email}
        except IntegrityError:
            return Response({'message': 'La cuenta cambió durante el acceso. Vuelve a intentarlo.'}, status=409)
        return Response(result)


class GoogleDisconnectView(RecoveryAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [GoogleThrottle]

    def post(self, request):
        password = request.data.get('current_password')
        if not isinstance(password, str) or len(password) > 128:
            return Response({'message': 'Confirma tu contraseña de NexoMark.'}, status=400)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.is_active or user.token_version != request.user.token_version:
                return Response({'message': 'La sesión ya no es válida.'}, status=403)
            if not user.has_usable_password() or not user.check_password(password):
                return Response({'message': 'Contraseña incorrecta. Necesitas una contraseña local antes de desvincular Google.'}, status=400)
            user.google_subject = None
            user.token_version += 1
            user.save(update_fields=['google_subject', 'token_version', 'fecha_actualizacion'])
        return Response({'message': 'Google desvinculado. Inicia sesión con tu correo y contraseña.'})
