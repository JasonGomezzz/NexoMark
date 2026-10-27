import logging
from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import pytest
import requests
from cryptography.fernet import Fernet
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.facebook import FacebookError, SCOPES, cipher, exchange_code
from apps.authentication.models import FacebookAuthorization, FacebookPage, User
from core.logging_filters import RedactOAuthQueryFilter

pytestmark = pytest.mark.django_db


@pytest.fixture
def fb_settings(settings):
    settings.FACEBOOK_APP_ID = '123'
    settings.FACEBOOK_APP_SECRET = 'test-secret'
    settings.FACEBOOK_REDIRECT_URI = 'https://demo.example/api/auth/facebook/callback/'
    settings.FACEBOOK_GRAPH_VERSION = 'v23.0'
    settings.FACEBOOK_LOGIN_CONFIG_ID = ''
    settings.FACEBOOK_METRICS_PERMISSIONS = False
    settings.FRONTEND_BASE_URL = 'http://localhost:5173'
    settings.SOCIAL_TOKEN_ENCRYPTION_KEY = Fernet.generate_key().decode()
    return settings


def begin(client):
    result = client.post('/api/auth/facebook/connect/', HTTP_ORIGIN='http://localhost:5173')
    assert result.status_code == 200
    return parse_qs(urlsplit(result.data['data']['authorization_url']).query)['state'][0]


def complete(client, state):
    return client.post('/api/auth/facebook/complete/', {'code': 'code', 'state': state}, format='json')


def test_disabled_until_configured(api_client, settings):
    settings.FACEBOOK_APP_SECRET = ''
    assert api_client.get('/api/auth/facebook/pages/').data['data']['configured'] is False
    assert api_client.post('/api/auth/facebook/connect/').status_code == 503


def test_metrics_permission_is_opt_in_and_business_config_remains_authoritative(api_client, fb_settings):
    fb_settings.FACEBOOK_METRICS_PERMISSIONS = True
    query = parse_qs(urlsplit(api_client.post('/api/auth/facebook/connect/').data['data']['authorization_url']).query)
    assert set(query['scope'][0].split(',')) == SCOPES | {'pages_read_user_content', 'read_insights'}
    fb_settings.FACEBOOK_LOGIN_CONFIG_ID = 'test-config'
    query = parse_qs(urlsplit(api_client.post('/api/auth/facebook/connect/').data['data']['authorization_url']).query)
    assert query['config_id'] == ['test-config'] and 'scope' not in query


@pytest.mark.parametrize('uri', ['http://localhost:5173/settings', 'https://demo.example/wrong',
                                  'https://demo.example/api/auth/facebook/callback/?extra=true'])
def test_invalid_callback_configuration(api_client, fb_settings, uri):
    fb_settings.FACEBOOK_REDIRECT_URI = uri
    assert api_client.post('/api/auth/facebook/connect/').status_code == 503


def test_local_start_scopes_state_and_optional_business_config(api_client, fb_settings):
    state = begin(api_client)
    ticket = FacebookAuthorization.objects.get()
    assert ticket.return_origin == 'http://localhost:5173' and ticket.state_hash != state
    response = api_client.post('/api/auth/facebook/connect/')
    query = parse_qs(urlsplit(response.data['data']['authorization_url']).query)
    assert set(query['scope'][0].split(',')) == SCOPES
    assert query['redirect_uri'] == [fb_settings.FACEBOOK_REDIRECT_URI]
    assert 'client_secret' not in query
    assert api_client.post('/api/auth/facebook/connect/', HTTP_ORIGIN='https://evil.example').status_code == 403
    fb_settings.FACEBOOK_LOGIN_CONFIG_ID = 'test-config'
    query = parse_qs(urlsplit(api_client.post('/api/auth/facebook/connect/').data['data']['authorization_url']).query)
    assert query['config_id'] == ['test-config'] and 'scope' not in query


@patch('apps.authentication.facebook.exchange_code')
def test_relay_local_session_encrypted_storage_single_use_and_owner(exchange, api_client, fb_settings, user_marketero):
    state = begin(api_client)
    callback = APIClient().get('/api/auth/facebook/callback/', {'code': 'secret-code', 'state': state})
    assert callback.status_code == 302
    target = urlsplit(callback['Location'])
    assert target.scheme == 'http' and target.netloc == 'localhost:5173' and not target.query
    assert parse_qs(target.fragment) == {'provider': ['facebook'], 'state': [state], 'code': ['secret-code']}
    assert callback['Cache-Control'] == 'no-store' and callback['Referrer-Policy'] == 'no-referrer'
    assert not FacebookAuthorization.objects.get().used
    other = User.objects.create_user(email='other@test.com', password='Test1234!', nombre='Other', rol='marketero')
    other_client = APIClient()
    other_client.force_authenticate(other)
    assert complete(other_client, state).status_code == 400
    assert complete(APIClient(), state).status_code == 401
    exchange.return_value = ([{'page_id': '456', 'name': 'Aroma Andino', 'token': 'private-page-token'}], 3600)
    response = complete(api_client, state)
    assert response.status_code == 200 and 'token' not in str(response.data)
    page = FacebookPage.objects.get()
    assert page.owner == user_marketero and page.encrypted_token != 'private-page-token'
    assert cipher().decrypt(page.encrypted_token.encode()) == b'private-page-token'
    assert complete(api_client, state).status_code == 400 and exchange.call_count == 1
    assert 'token' not in str(api_client.get('/api/auth/facebook/pages/').data)
    assert other_client.get('/api/auth/facebook/pages/').data['data']['pages'] == []
    assert other_client.delete(f'/api/auth/facebook/pages/{page.pk}/').status_code == 404
    assert api_client.delete(f'/api/auth/facebook/pages/{page.pk}/').status_code == 200


def test_expired_revoked_wrong_origin_and_denied_relay(api_client, fb_settings, user_marketero):
    state = begin(api_client)
    client = APIClient()
    path = '/api/auth/facebook/callback/'
    denied = client.get(path, {'state': state, 'error': 'unsafe-details', 'error_description': 'private'})
    assert denied.status_code == 302 and 'unsafe-details' not in denied['Location'] and 'private' not in denied['Location']
    assert client.get(path, {'state': 'invalid', 'code': 'secret'}).status_code == 400
    FacebookAuthorization.objects.update(return_origin='https://evil.example')
    assert client.get(path, {'state': state, 'code': 'code'}).status_code == 400
    FacebookAuthorization.objects.update(return_origin='http://localhost:5173')
    user_marketero.token_version += 1
    user_marketero.save()
    assert client.get(path, {'state': state, 'code': 'code'}).status_code == 400
    assert complete(api_client, state).status_code == 400
    user_marketero.token_version -= 1
    user_marketero.save()
    FacebookAuthorization.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert client.get(path, {'state': state, 'code': 'code'}).status_code == 400


@patch('apps.authentication.facebook.exchange_code')
def test_completion_suspension_mid_exchange_cannot_save(exchange, api_client, fb_settings, user_marketero):
    state = begin(api_client)
    def revoke(_):
        User.objects.filter(pk=user_marketero.pk).update(is_active=False)
        return ([{'page_id': '456', 'name': 'Test', 'token': 'private'}], 3600)
    exchange.side_effect = revoke
    assert complete(api_client, state).status_code == 403
    assert not FacebookPage.objects.exists()


@patch('apps.authentication.facebook.exchange_code')
def test_completion_error_validation_and_roles(exchange, api_client, fb_settings, cliente, superadmin_client):
    state = begin(api_client)
    exchange.side_effect = FacebookError('permissions')
    assert complete(api_client, state).status_code == 502
    assert not FacebookPage.objects.exists()
    assert api_client.post('/api/auth/facebook/complete/', {'code': 7, 'state': state}, format='json').status_code == 400
    client = APIClient()
    client.force_authenticate(cliente)
    for forbidden in (client, superadmin_client):
        assert forbidden.get('/api/auth/facebook/pages/').status_code == 403
        assert forbidden.post('/api/auth/facebook/connect/').status_code == 403


def graph_responses():
    return [
        {'access_token': 'short'}, {'id': '123'}, {'access_token': 'long', 'expires_in': 3600}, {'id': '123'},
        {'data': [{'permission': permission, 'status': 'granted'} for permission in SCOPES]},
        {'data': [{'id': '456', 'name': 'Aroma Andino', 'access_token': 'page-private', 'tasks': ['CREATE_CONTENT']}]},
    ]


@patch('apps.authentication.facebook.requests.get')
def test_exchange_uses_fixed_host_bearer_minimal_permissions_and_pages(get, fb_settings):
    get.side_effect = [Mock(status_code=200, json=lambda value=value: value) for value in graph_responses()]
    assert exchange_code('code') == ([{'page_id': '456', 'name': 'Aroma Andino', 'token': 'page-private'}], 3600)
    assert get.call_args.kwargs['headers'] == {'Authorization': 'Bearer long'}
    assert get.call_args.kwargs['params']['fields'] == 'id,name,access_token,tasks'
    assert all(call.args[0].startswith('https://graph.facebook.com/v23.0/') for call in get.call_args_list)
    assert get.call_args_list[0].kwargs['params']['redirect_uri'] == fb_settings.FACEBOOK_REDIRECT_URI


@patch('apps.authentication.facebook.requests.get')
def test_missing_exchange_expiry_uses_verified_debug_deadlines(get, fb_settings):
    now = int(timezone.now().timestamp())
    responses = graph_responses()
    responses[2] = {'access_token': 'long'}
    responses.insert(4, {'data': {'is_valid': True, 'app_id': fb_settings.FACEBOOK_APP_ID,
        'user_id': '123', 'expires_at': now + 7200, 'data_access_expires_at': now + 1800}})
    get.side_effect = [Mock(status_code=200, json=lambda value=value: value) for value in responses]
    pages, lifetime = exchange_code('code')
    assert pages[0]['page_id'] == '456' and 1795 <= lifetime <= 1800
    debug = get.call_args_list[4]
    assert debug.args[0] == 'https://graph.facebook.com/v23.0/debug_token'
    assert debug.kwargs['params'] == {'input_token': 'long'}
    assert debug.kwargs['headers']['Authorization'] == 'Bearer 123|test-secret'
    assert debug.kwargs['allow_redirects'] is False


@pytest.mark.parametrize('changes', [
    {'is_valid': False}, {'app_id': 'other'}, {'user_id': 'other'},
    {'expires_at': True}, {'expires_at': -1}, {'expires_at': 1},
    {'expires_at': 0, 'data_access_expires_at': 0}, {'data_access_expires_at': 'wrong'},
])
def test_debug_expiry_rejects_wrong_identity_or_invalid_deadlines(fb_settings, changes):
    from apps.authentication.facebook import token_lifetime
    details = {'is_valid': True, 'app_id': fb_settings.FACEBOOK_APP_ID, 'user_id': '123',
               'expires_at': int(timezone.now().timestamp()) + 3600, 'data_access_expires_at': 0}
    details.update(changes)
    with patch('apps.authentication.facebook.graph', return_value={'data': details}):
        with pytest.raises(FacebookError) as error:
            token_lifetime({}, 'private', '123')
        assert error.value.stage == 'expiry'


@pytest.mark.parametrize('value', [True, False, None, 1.5, '', '-1', 0, 90 * 86400 + 1])
def test_invalid_explicit_expiry_never_falls_back(fb_settings, value):
    from apps.authentication.facebook import token_lifetime
    with patch('apps.authentication.facebook.graph') as debug:
        with pytest.raises(FacebookError):
            token_lifetime({'expires_in': value}, 'private', '123')
        debug.assert_not_called()


@pytest.mark.parametrize('index,replacement,stage', [
    (0, {}, 'code'), (3, {'id': '999'}, 'identity'), (2, {'access_token': 'long', 'expires_in': -1}, 'expiry'),
    (4, {'data': []}, 'permissions'), (5, {'data': []}, 'pages'),
    (5, {'data': [{'id': '456', 'name': 'Read only', 'tasks': ['ANALYZE']}]}, 'pages'),
])
@patch('apps.authentication.facebook.requests.get')
def test_bad_meta_responses_fail_safely(get, fb_settings, index, replacement, stage):
    responses = graph_responses()
    responses[index] = replacement
    get.side_effect = [Mock(status_code=200, json=lambda value=value: value) for value in responses]
    with pytest.raises(FacebookError) as error:
        exchange_code('code')
    assert error.value.stage == stage


@patch('apps.authentication.facebook.requests.get')
def test_upstream_urls_not_logged_and_pagination_cannot_change_host(get, fb_settings):
    get.side_effect = requests.RequestException('secret-bearing-url')
    with pytest.raises(FacebookError) as error:
        exchange_code('code')
    assert 'secret-bearing-url' not in str(error.value)
    responses = graph_responses()
    responses[-1]['paging'] = {'next': 'https://evil.example/steal', 'cursors': {'after': 'safe-cursor'}}
    responses.append({'data': []})
    get.side_effect = [Mock(status_code=200, json=lambda value=value: value) for value in responses]
    assert exchange_code('code')[0][0]['name'] == 'Aroma Andino'
    assert get.call_args.args[0] == 'https://graph.facebook.com/v23.0/me/accounts'
    assert get.call_args.kwargs['params']['after'] == 'safe-cursor'
    record = logging.LogRecord('django.server', 20, '', 0, '%s %s', ('GET /api/auth/facebook/callback/?code=private HTTP/1.1', 302), None)
    RedactOAuthQueryFilter().filter(record)
    assert 'private' not in record.getMessage()


def test_public_bridge_exposes_only_social_endpoints(api_client, fb_settings, settings):
    settings.ROOT_URLCONF = 'core.instagram_preview_urls'
    assert api_client.get('/api/auth/facebook/pages/').status_code == 200
    assert api_client.post('/api/auth/facebook/connect/').status_code == 200
    assert api_client.get('/api/campaigns/').status_code == 404
    assert api_client.get('/admin/').status_code == 404
