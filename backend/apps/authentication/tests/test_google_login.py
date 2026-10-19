import re
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import GoogleLoginTicket, User

pytestmark = pytest.mark.django_db
CHALLENGE = '/api/auth/google/challenge/'
COMPLETE = '/api/auth/google/complete/'
ORIGIN = {'HTTP_ORIGIN': 'http://localhost:5173'}


@pytest.fixture(scope='module')
def private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_settings(settings, private_key):
    settings.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com'
    settings.FRONTEND_BASE_URL = 'http://localhost:5173'
    settings.CORS_ALLOWED_ORIGINS = ['http://localhost:5173']
    with patch('apps.authentication.google_login.google_keys.get_signing_key_from_jwt', return_value=SimpleNamespace(key=private_key.public_key())):
        yield


def challenge(purpose='login', role=None):
    data = {'purpose': purpose}
    if role is not None:
        data['role'] = role
    response = APIClient().post(CHALLENGE, data, format='json', **ORIGIN)
    assert response.status_code == 200
    return response.data['data']


def credential(ticket, key, **changes):
    claims = {'iss': 'https://accounts.google.com', 'sub': 'google-id-123',
              'aud': 'test-client.apps.googleusercontent.com', 'exp': int(time.time()) + 300,
              'iat': int(time.time()), 'email': 'newuser@gmail.com', 'email_verified': True,
              'nonce': ticket['nonce'], 'name': 'Nombre Google'}
    claims.update(changes)
    return jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'key1'})


def complete(ticket, key, claims=None, password=None):
    data = {'ticket': ticket['ticket'], 'proof': ticket['proof'], 'credential': credential(ticket, key, **(claims or {}))}
    if password:
        data['current_password'] = password
    return APIClient().post(COMPLETE, data, format='json', **ORIGIN)


@pytest.mark.parametrize('role', ['marketero', 'cliente'])
def test_register_then_login_preserves_role_and_local_email(private_key, role):
    ticket = challenge('register', role)
    response = complete(ticket, private_key)
    assert response.status_code == 200
    assert response.data['role'] == role
    user = User.objects.get(google_subject='google-id-123')
    assert not user.has_usable_password()
    assert user.tokens_disponibles == 100
    assert response.data['nombre'] == 'Nombre Google'
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    me = client.get('/api/auth/me/').data['data']['user']
    assert me['google_connected'] is True and me['has_password'] is False
    assert 'google_subject' not in me
    # Google account identifier, not mutable email, owns future logins.
    user.email = 'new-local-email@example.com'
    user.save(update_fields=['email'])
    returning = complete(challenge(), private_key, {'email': 'changed-google@gmail.com'})
    assert returning.status_code == 200
    assert returning.data['email'] == user.email
    assert returning.data['role'] == role
    assert User.objects.count() == 1


def test_existing_email_requires_password_and_never_changes_role(private_key, user_marketero):
    ticket = challenge('register', 'cliente')
    claims = {'email': user_marketero.email.upper()}
    first = complete(ticket, private_key, claims)
    assert first.status_code == 409 and first.data['link_required']
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None
    assert complete(ticket, private_key, claims, 'wrong').status_code == 400
    response = complete(ticket, private_key, claims, 'Test1234!')
    assert response.status_code == 200 and response.data['role'] == 'marketero'
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject == 'google-id-123'
    assert user_marketero.nombre == 'Marketero Test'
    assert user_marketero.check_password('Test1234!')


def test_login_does_not_silently_create_accounts(private_key):
    response = complete(challenge(), private_key)
    assert response.status_code == 409 and response.data['registration_required']
    assert not User.objects.exists()


def test_role_must_be_explicit_and_cannot_be_admin():
    for role in [None, 'superadmin', 'invalid']:
        data = {'purpose': 'register'}
        if role:
            data['role'] = role
        assert APIClient().post(CHALLENGE, data, format='json', **ORIGIN).status_code == 400
    assert not User.objects.exists()


@pytest.mark.parametrize('claims', [
    {'aud': 'other-client'}, {'iss': 'https://evil.example'}, {'exp': 1},
    {'email_verified': False}, {'email_verified': 'true'}, {'email': 'invalid'},
    {'nonce': 'not-the-challenge-nonce-12345'}, {'sub': ''}, {'iat': 9999999999},
])
def test_real_signature_claim_validation_rejects_invalid_tokens(private_key, claims):
    assert complete(challenge('register', 'cliente'), private_key, claims).status_code == 400
    assert not User.objects.exists()


def test_invalid_signature_proof_and_expiration(private_key):
    ticket = challenge('register', 'cliente')
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert complete(ticket, wrong_key).status_code == 400
    data = {'ticket': ticket['ticket'], 'proof': 'x' * 43, 'credential': credential(ticket, private_key)}
    assert APIClient().post(COMPLETE, data, format='json', **ORIGIN).status_code == 400
    GoogleLoginTicket.objects.filter(pk=ticket['ticket']).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert complete(ticket, private_key).status_code == 400


def test_single_use_nonce_cannot_be_replayed_in_new_challenge(private_key):
    ticket = challenge('register', 'cliente')
    assert complete(ticket, private_key).status_code == 200
    assert complete(ticket, private_key).status_code == 400
    other = challenge()
    data = {'ticket': other['ticket'], 'proof': other['proof'], 'credential': credential(ticket, private_key)}
    assert APIClient().post(COMPLETE, data, format='json', **ORIGIN).status_code == 400


def test_origin_and_configuration_fail_closed(private_key, settings):
    assert APIClient().post(CHALLENGE, {'purpose': 'login'}, format='json').status_code == 403
    assert APIClient().post(CHALLENGE, {'purpose': 'login'}, format='json', HTTP_ORIGIN='https://evil.example').status_code == 403
    settings.GOOGLE_CLIENT_ID = ''
    assert APIClient().get('/api/auth/google/config/').data['data']['configured'] is False
    assert APIClient().post(CHALLENGE, {'purpose': 'login'}, format='json', **ORIGIN).status_code == 503
    assert APIClient().post(COMPLETE, {}, format='json', **ORIGIN).status_code == 503


def test_suspend_conflict_and_third_party_mail(private_key, user_marketero):
    user_marketero.is_active = False
    user_marketero.save(update_fields=['is_active'])
    assert complete(challenge(), private_key, {'email': user_marketero.email}).status_code == 403
    assert complete(challenge('register', 'cliente'), private_key, {'email': 'new@example.com'}).status_code == 400
    assert complete(challenge('register', 'cliente'), private_key, {'email': 'new@example.com', 'hd': 'example.com'}).status_code == 200


def test_google_only_user_can_create_local_password_via_recovery(private_key):
    assert complete(challenge('register', 'cliente'), private_key).status_code == 200
    user = User.objects.get()
    assert APIClient().post('/api/auth/password-reset/', {'email': user.email}, format='json').status_code == 200
    url = re.search(r'http[^\s]+', mail.outbox[-1].body).group()
    params = {key: values[0] for key, values in parse_qs(urlsplit(url).fragment).items()}
    assert APIClient().post('/api/auth/password-reset/confirm/', {**params, 'new_password': 'LocalPassword2026!'}, format='json').status_code == 200
    user.refresh_from_db()
    assert user.has_usable_password() and user.google_subject


def test_disconnect_requires_local_password_and_revokes_session(private_key, api_client, user_marketero):
    user_marketero.google_subject = 'google-id-123'
    user_marketero.save(update_fields=['google_subject'])
    response = complete(challenge(), private_key)
    assert response.status_code == 200
    url = '/api/auth/google/disconnect/'
    assert APIClient().post(url, {}, format='json').status_code == 401
    assert api_client.post(url, {'current_password': 'wrong'}, format='json').status_code == 400
    assert api_client.post(url, {'current_password': 'Test1234!'}, format='json').status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None
    assert APIClient().post('/api/auth/token/refresh/', {'refresh': response.data['refresh']}, format='json').status_code == 401


def test_link_attempts_limited_per_account(private_key, user_marketero):
    ticket = challenge()
    for _ in range(5):
        assert complete(ticket, private_key, {'email': user_marketero.email}, 'bad').status_code == 400
    assert complete(ticket, private_key, {'email': user_marketero.email}, 'Test1234!').status_code == 429
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None


def test_google_failure_and_rate_limit_do_not_create_users(private_key):
    ticket = challenge('register', 'cliente')
    with patch('apps.authentication.google_login.verify_google_token', side_effect=ConnectionError):
        assert complete(ticket, private_key).status_code == 503
    with patch('apps.authentication.google_login.GoogleThrottle.hourly_limit', side_effect=ConnectionError):
        assert complete(ticket, private_key).status_code == 503
    assert not User.objects.exists()
