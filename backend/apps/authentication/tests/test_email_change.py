import re
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import EmailChangeRequest, User

pytestmark = pytest.mark.django_db
REQUEST = '/api/auth/me/change-email/'
CONFIRM = '/api/auth/email-change/confirm/'


@pytest.fixture(autouse=True)
def local_mail(settings):
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'


def start(api_client):
    response = api_client.post(REQUEST, {'new_email': 'new@example.com', 'current_password': 'Test1234!'}, format='json')
    assert response.status_code == 202
    return [{key: values[0] for key, values in parse_qs(urlsplit(re.search(r'http[^\s]+', message.body).group()).fragment).items()}
            for message in mail.outbox[-2:]]


@pytest.mark.parametrize('order', [(0, 1), (1, 0)])
def test_both_mailboxes_required_single_use_and_sessions_revoked(api_client, user_marketero, order):
    original = user_marketero.email
    refresh = RefreshToken.for_user(user_marketero)
    refresh['token_version'] = user_marketero.token_version
    access = str(refresh.access_token)
    links = start(api_client)
    pending = EmailChangeRequest.objects.get(owner=user_marketero)
    assert links[0]['token'] not in pending.old_token_hash
    assert links[1]['token'] not in pending.new_token_hash
    assert mail.outbox[-2].to == [original]
    assert mail.outbox[-1].to == ['new@example.com']
    public = APIClient()
    # Opening/prefetching is not a confirmation.
    assert public.get(CONFIRM, links[0]).status_code == 405
    first = public.post(CONFIRM, links[order[0]], format='json')
    assert first.status_code == 200 and not first.data['completed']
    user_marketero.refresh_from_db()
    assert user_marketero.email == original
    assert public.post(CONFIRM, links[order[0]], format='json').status_code == 400
    second = public.post(CONFIRM, links[order[1]], format='json')
    assert second.status_code == 200 and second.data['completed']
    user_marketero.refresh_from_db()
    assert user_marketero.email == 'new@example.com'
    assert user_marketero.check_password('Test1234!')
    assert not EmailChangeRequest.objects.exists()
    assert public.post(CONFIRM, links[order[1]], format='json').status_code == 400
    assert public.post('/api/auth/token/refresh/', {'refresh': str(refresh)}, format='json').status_code == 401
    public.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    assert public.get('/api/auth/me/').status_code == 401
    login = APIClient().post('/api/auth/token/', {'email': 'new@example.com', 'password': 'Test1234!'}, format='json')
    assert login.status_code == 200
    assert APIClient().post('/api/auth/token/', {'email': original, 'password': 'Test1234!'}, format='json').status_code == 401


def test_requires_auth_password_and_valid_available_email(api_client, user_marketero, cliente):
    assert APIClient().post(REQUEST, {}, format='json').status_code == 401
    assert APIClient().delete(REQUEST).status_code == 401
    assert APIClient().get(REQUEST).status_code == 401
    for target, password in [('bad', 'Test1234!'), ('new@example.com', 'wrong'),
                             (user_marketero.email.upper(), 'Test1234!'), (cliente.email.upper(), 'Test1234!')]:
        assert api_client.post(REQUEST, {'new_email': target, 'current_password': password}, format='json').status_code == 400
    assert not EmailChangeRequest.objects.exists()
    assert not mail.outbox


@pytest.mark.parametrize('change', ['expired', 'password', 'version', 'email', 'inactive'])
def test_invalidates_after_security_changes(api_client, user_marketero, change):
    links = start(api_client)
    if change == 'expired':
        EmailChangeRequest.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    else:
        updates = {'password': {'password': 'changed'}, 'version': {'token_version': 1},
                   'email': {'email': 'other@example.com'}, 'inactive': {'is_active': False}}
        User.objects.filter(pk=user_marketero.pk).update(**updates[change])
    assert APIClient().post(CONFIRM, links[0], format='json').status_code == 400


def test_cancel_replace_tamper_and_status(api_client, user_marketero):
    links = start(api_client)
    assert api_client.get(REQUEST).data['data']['pending']['new_email'] == 'new@example.com'
    forged = {**links[0], 'side': 'new'}
    assert APIClient().post(CONFIRM, forged, format='json').status_code == 400
    assert APIClient().post(CONFIRM, {**links[0], 'token': 'x' * 43}, format='json').status_code == 400
    assert api_client.delete(REQUEST).status_code == 200
    assert api_client.get(REQUEST).data['data']['pending'] is None
    assert APIClient().post(CONFIRM, links[0], format='json').status_code == 400
    links = start(api_client)
    start(api_client)
    assert APIClient().post(CONFIRM, links[0], format='json').status_code == 400
    assert EmailChangeRequest.objects.count() == 1


def test_smtp_failure_rolls_back_even_if_one_message_sent(api_client):
    start(api_client)
    original_pk = EmailChangeRequest.objects.get().pk
    with patch('apps.authentication.email_change.send_mail', side_effect=[1, RuntimeError('smtp')]):
        response = api_client.post(REQUEST, {'new_email': 'another@example.com', 'current_password': 'Test1234!'}, format='json')
    assert response.status_code == 503
    assert EmailChangeRequest.objects.get().pk == original_pk


def test_occupied_target_at_completion_does_not_change_account(api_client, user_marketero):
    original = user_marketero.email
    links = start(api_client)
    User.objects.create_user('NEW@example.com', 'SomePassword1!', 'Other')
    public = APIClient()
    assert public.post(CONFIRM, links[0], format='json').status_code == 200
    assert public.post(CONFIRM, links[1], format='json').status_code == 409
    user_marketero.refresh_from_db()
    assert user_marketero.email == original


def test_request_and_confirmation_limits_and_cache_failure(api_client):
    for _ in range(5):
        api_client.post(REQUEST, {'new_email': 'new@example.com', 'current_password': 'wrong'}, format='json')
    assert api_client.post(REQUEST, {}, format='json').status_code == 429
    public = APIClient()
    for _ in range(30):
        assert public.post(CONFIRM, {}, format='json').status_code == 400
    assert public.post(CONFIRM, {}, format='json').status_code == 429
    with patch('apps.authentication.email_change.EmailChangeThrottle.hourly_limit', side_effect=ConnectionError), patch('apps.authentication.email_change.send_mail') as send:
        assert api_client.post(REQUEST, {}, format='json').status_code == 503
        send.assert_not_called()


def test_another_account_cannot_cancel_or_view_pending(api_client, user_marketero, cliente):
    start(api_client)
    other = APIClient()
    other.force_authenticate(user=cliente)
    assert other.get(REQUEST).data['data']['pending'] is None
    assert other.delete(REQUEST).status_code == 200
    assert EmailChangeRequest.objects.filter(owner=user_marketero).exists()
