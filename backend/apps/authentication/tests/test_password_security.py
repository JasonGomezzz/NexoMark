from unittest.mock import patch
from types import SimpleNamespace

import pytest
from django.core import mail
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import User
from apps.authentication.serializers import ChangePasswordSerializer

pytestmark = pytest.mark.django_db
URL = '/api/auth/me/change-password/'
PAYLOAD = {'current_password': 'Test1234!', 'new_password': 'NuevaClave2026!'}


def test_change_revokes_all_access_and_refresh_tokens(api_client, user_marketero):
    sessions = []
    for _ in range(2):
        refresh = RefreshToken.for_user(user_marketero)
        refresh['token_version'] = user_marketero.token_version
        sessions.append((str(refresh), str(refresh.access_token)))
    response = api_client.post(URL, PAYLOAD, format='json')
    assert response.status_code == 200
    assert response.data['data']['reauthentication_required']
    assert response.data['data']['notification_sent']
    assert response['Cache-Control'] == 'no-store'
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 1
    assert user_marketero.check_password(PAYLOAD['new_password'])
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user_marketero.email]
    assert PAYLOAD['current_password'] not in mail.outbox[0].body
    assert PAYLOAD['new_password'] not in mail.outbox[0].body
    for refresh, access in sessions:
        public = APIClient()
        assert public.post('/api/auth/token/refresh/', {'refresh': refresh}, format='json').status_code == 401
        public.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        assert public.get('/api/auth/me/').status_code == 401
    assert APIClient().post('/api/auth/token/', {'email': user_marketero.email, 'password': PAYLOAD['new_password']}, format='json').status_code == 200


def test_validation_does_not_mutate_or_notify(api_client, user_marketero):
    for current, new in [('wrong', 'NuevaClave2026!'), ('Test1234!', 'Test1234!'), ('Test1234!', 'x'),
                         ('Test1234!', 'x' * 129)]:
        assert api_client.post(URL, {'current_password': current, 'new_password': new}, format='json').status_code == 400
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 0
    assert user_marketero.check_password('Test1234!')
    assert not mail.outbox


def test_atomic_recheck_rejects_a_session_changed_after_validation(user_marketero):
    serializer = ChangePasswordSerializer(data=PAYLOAD, context={'request': SimpleNamespace(user=user_marketero)})
    assert serializer.is_valid()
    User.objects.filter(pk=user_marketero.pk).update(token_version=1)
    from rest_framework.exceptions import AuthenticationFailed
    with pytest.raises(AuthenticationFailed):
        serializer.save()
    user_marketero.refresh_from_db()
    assert user_marketero.check_password('Test1234!')


def test_password_whitespace_is_preserved(api_client, user_marketero):
    current = '  ExistingPassword7!  '
    new = '  ReplacementPassword8!  '
    user_marketero.set_password(current)
    user_marketero.save(update_fields=['password'])
    response = api_client.post(URL, {'current_password': current, 'new_password': new}, format='json')
    assert response.status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.check_password(new)
    assert not user_marketero.check_password(new.strip())


@pytest.mark.parametrize('mail_result', [0, RuntimeError('smtp unavailable')])
def test_mail_failure_does_not_undo_password_or_prompt_retry(api_client, user_marketero, mail_result):
    kwargs = {'side_effect': mail_result} if isinstance(mail_result, Exception) else {'return_value': mail_result}
    with patch('apps.authentication.password_security.send_mail', **kwargs):
        response = api_client.post(URL, PAYLOAD, format='json')
    assert response.status_code == 200
    assert not response.data['data']['notification_sent']
    assert 'la contraseña sí se cambió' in response.data['message']
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 1
    assert user_marketero.check_password(PAYLOAD['new_password'])


def test_rate_limit_survives_ip_changes_and_fails_closed(api_client, user_marketero):
    for i in range(5):
        assert api_client.post(URL, {**PAYLOAD, 'current_password': 'bad'}, format='json', REMOTE_ADDR=f'10.0.0.{i+1}').status_code == 400
    response = api_client.post(URL, PAYLOAD, format='json', REMOTE_ADDR='10.0.0.99')
    assert response.status_code == 429
    assert response.data['data']['retry_after'] > 0
    assert 'Demasiados intentos' in response.data['message']
    with patch('apps.authentication.password_security.PasswordChangeThrottle.hourly_limit', side_effect=ConnectionError):
        assert api_client.post(URL, PAYLOAD, format='json').status_code == 503
    user_marketero.refresh_from_db()
    assert user_marketero.check_password('Test1234!')
    assert not mail.outbox


def test_password_change_cancels_pending_email_change(api_client, user_marketero):
    from apps.authentication.models import EmailChangeRequest
    assert api_client.post('/api/auth/me/change-email/', {'new_email': 'new@example.com', 'current_password': 'Test1234!'}, format='json').status_code == 202
    assert EmailChangeRequest.objects.filter(owner=user_marketero).exists()
    assert api_client.post(URL, PAYLOAD, format='json').status_code == 200
    assert not EmailChangeRequest.objects.filter(owner=user_marketero).exists()
