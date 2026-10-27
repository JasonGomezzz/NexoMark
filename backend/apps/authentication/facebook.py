"""Facebook Page authorization, isolated by marketer; no publication on connect."""
import hashlib
import logging
import re
import secrets
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import api_response
from .instagram import cipher
from .models import FacebookAuthorization, FacebookPage
from .permissions import IsMarketero

SCOPES = {'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'}
CALLBACK_PATH = '/api/auth/facebook/callback/'
logger = logging.getLogger(__name__)
FAILURES = {
    'code': 'Facebook no aceptó la autorización. Revisa la clave de la app y la URL de retorno en Meta.',
    'permissions': 'Autoriza los permisos para listar, leer y publicar en tus Páginas de Facebook.',
    'identity': 'No se pudo verificar la cuenta de Facebook que concedió la autorización.',
    'expiry': 'Facebook devolvió una autorización con vencimiento inválido.',
    'pages': 'No se encontraron Páginas autorizadas donde puedas crear contenido. Autoriza Aroma Andino y revisa tu acceso a la Página.',
}


class FacebookError(Exception):
    def __init__(self, stage):
        self.stage = stage
        super().__init__('Facebook authorization failed')


def allowed_origins():
    origins = set()
    redirect = urlsplit(settings.FACEBOOK_REDIRECT_URI)
    public_origin = f'{redirect.scheme}://{redirect.netloc}' if redirect.netloc else ''
    for value in (settings.FRONTEND_BASE_URL, public_origin):
        parsed = urlsplit(value)
        if (parsed.netloc and not parsed.username and not parsed.password
                and not parsed.query and not parsed.fragment and parsed.path in ('', '/')
                and (parsed.scheme == 'https' or parsed.scheme == 'http'
                     and parsed.hostname in ('localhost', '127.0.0.1'))):
            origins.add(f'{parsed.scheme}://{parsed.netloc}')
    return origins


def configured():
    redirect = urlsplit(settings.FACEBOOK_REDIRECT_URI)
    try:
        cipher()
    except (ValueError, TypeError):
        return False
    return bool(settings.FACEBOOK_APP_ID and settings.FACEBOOK_APP_SECRET
                and re.fullmatch(r'v\d+\.\d+', settings.FACEBOOK_GRAPH_VERSION)
                and redirect.scheme == 'https' and redirect.netloc
                and not redirect.username and not redirect.password
                and redirect.path == CALLBACK_PATH and not redirect.query and not redirect.fragment)


def graph(path, stage, token=None, **params):
    """Fixed host/path; never forward upstream pagination URLs or exception details."""
    try:
        response = requests.get(
            f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/{path}',
            params=params, headers={'Authorization': f'Bearer {token}'} if token else {}, timeout=20, allow_redirects=False)
        response.raise_for_status()
        data = response.json()
        if 300 <= response.status_code < 400 or not isinstance(data, dict) or 'error' in data:
            raise FacebookError(stage)
        return data
    except (requests.RequestException, ValueError, TypeError):
        raise FacebookError(stage) from None


def identity(token):
    user_id = graph('me', 'identity', token, fields='id').get('id')
    if not isinstance(user_id, str) or not user_id.isdigit() or len(user_id) > 64:
        raise FacebookError('identity')
    return user_id


def token_lifetime(extended, token, user_id):
    """Use provider expiry, never guess a lifetime for an exchanged token."""
    if 'expires_in' in extended:
        value = extended['expires_in']
        if type(value) is int and 0 < value <= 90 * 86400:
            return value
        if isinstance(value, str) and len(value) <= 9 and value.isascii() and value.isdigit() and 0 < int(value) <= 90 * 86400:
            return int(value)
        raise FacebookError('expiry')
    # An exchange of an already extended token can omit expires_in. Validate
    # the exact token against this app and user before trusting debug expiry.
    details = graph('debug_token', 'expiry',
                    settings.FACEBOOK_APP_ID + '|' + settings.FACEBOOK_APP_SECRET,
                    input_token=token).get('data')
    if (not isinstance(details, dict) or details.get('is_valid') is not True
            or details.get('app_id') != settings.FACEBOOK_APP_ID
            or details.get('user_id') != user_id):
        raise FacebookError('expiry')
    expires = details.get('expires_at')
    access_expires = details.get('data_access_expires_at', 0)
    if (type(expires) is not int or expires < 0
            or type(access_expires) is not int or access_expires < 0):
        raise FacebookError('expiry')
    deadlines = [value for value in (expires, access_expires) if value > 0]
    if not deadlines:
        # No invented expiry for tokens reported without a finite deadline.
        raise FacebookError('expiry')
    lifetime = min(deadlines) - int(timezone.now().timestamp())
    if lifetime <= 0:
        raise FacebookError('expiry')
    return min(lifetime, 90 * 86400)


def exchange_code(code):
    short = graph('oauth/access_token', 'code', client_id=settings.FACEBOOK_APP_ID,
                  client_secret=settings.FACEBOOK_APP_SECRET,
                  redirect_uri=settings.FACEBOOK_REDIRECT_URI, code=code)
    short_token = short.get('access_token')
    if not isinstance(short_token, str) or not short_token:
        raise FacebookError('code')
    user_id = identity(short_token)
    extended = graph('oauth/access_token', 'code', grant_type='fb_exchange_token',
                     client_id=settings.FACEBOOK_APP_ID, client_secret=settings.FACEBOOK_APP_SECRET,
                     fb_exchange_token=short_token)
    token = extended.get('access_token')
    if not isinstance(token, str) or not token or identity(token) != user_id:
        raise FacebookError('identity')
    lifetime = token_lifetime(extended, token, user_id)
    permissions = graph('me/permissions', 'permissions', token).get('data')
    if not isinstance(permissions, list):
        raise FacebookError('permissions')
    granted = {item.get('permission') for item in permissions
               if isinstance(item, dict) and isinstance(item.get('permission'), str) and item.get('status') == 'granted'}
    if not SCOPES.issubset(granted):
        raise FacebookError('permissions')
    pages, seen_cursors = {}, set()
    cursor = None
    for _ in range(20):
        params = {'fields': 'id,name,access_token,tasks', 'limit': 100}
        if cursor:
            params['after'] = cursor
        result = graph('me/accounts', 'pages', token, **params)
        if not isinstance(result.get('data'), list):
            raise FacebookError('pages')
        for item in result['data']:
            if not isinstance(item, dict):
                raise FacebookError('pages')
            page_id, name, page_token = item.get('id'), item.get('name'), item.get('access_token')
            tasks = item.get('tasks', [])
            if not isinstance(tasks, list) or not all(isinstance(task, str) for task in tasks) or not {'CREATE_CONTENT', 'MANAGE'}.intersection(tasks):
                continue
            if (not isinstance(page_id, str) or not page_id.isdigit() or len(page_id) > 64
                    or not isinstance(name, str) or not name.strip() or len(name) > 255
                    or not isinstance(page_token, str) or not page_token):
                raise FacebookError('pages')
            pages[page_id] = {'page_id': page_id, 'name': name, 'token': page_token}
        paging = result.get('paging', {})
        if not isinstance(paging, dict):
            raise FacebookError('pages')
        if not paging.get('next'):
            break
        cursors = paging.get('cursors', {})
        cursor = cursors.get('after') if isinstance(cursors, dict) else None
        if not isinstance(cursor, str) or not cursor or len(cursor) > 4096 or cursor in seen_cursors:
            raise FacebookError('pages')
        seen_cursors.add(cursor)
    else:
        raise FacebookError('pages')
    if not pages:
        raise FacebookError('pages')
    return list(pages.values()), lifetime


class FacebookPagesView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def get(self, request):
        pages = [{'id': page.pk, 'name': page.name, 'page_id': page.facebook_page_id,
                  'expired': page.expires_at <= timezone.now(), 'expires_at': page.expires_at.isoformat()}
                 for page in FacebookPage.objects.filter(owner=request.user).order_by('name')]
        return Response(api_response(True, 'Páginas de Facebook.', {'pages': pages, 'configured': configured()}))


class FacebookDisconnectView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def delete(self, request, pk):
        deleted, _ = FacebookPage.objects.filter(owner=request.user, pk=pk).delete()
        if not deleted:
            return Response(api_response(False, 'Página no encontrada.'), status=404)
        return Response(api_response(True, 'Conexión eliminada de NexoMark.'))


class FacebookConnectView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def post(self, request):
        if not configured():
            return Response(api_response(False, 'Falta configurar la conexión segura de Facebook en el servidor.'), status=503)
        origin = request.headers.get('Origin') or settings.FRONTEND_BASE_URL.rstrip('/')
        if origin not in allowed_origins():
            return Response(api_response(False, 'Inicia la conexión desde la web configurada de NexoMark.'), status=403)
        FacebookAuthorization.objects.filter(owner=request.user, expires_at__lt=timezone.now()).delete()
        state = secrets.token_urlsafe(32)
        FacebookAuthorization.objects.create(owner=request.user,
            state_hash=hashlib.sha256(state.encode()).hexdigest(), token_version=request.user.token_version,
            return_origin=origin, expires_at=timezone.now() + timedelta(minutes=10))
        values = {'client_id': settings.FACEBOOK_APP_ID, 'redirect_uri': settings.FACEBOOK_REDIRECT_URI,
                  'response_type': 'code', 'state': state}
        if settings.FACEBOOK_LOGIN_CONFIG_ID:
            values['config_id'] = settings.FACEBOOK_LOGIN_CONFIG_ID
        else:
            scopes = SCOPES | ({'pages_read_user_content', 'read_insights'} if settings.FACEBOOK_METRICS_PERMISSIONS else set())
            values['scope'] = ','.join(sorted(scopes))
        return Response(api_response(True, 'Autoriza tus Páginas en Facebook.', {
            'authorization_url': f'https://www.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/dialog/oauth?{urlencode(values)}'}))


class FacebookCallbackRelayView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        state, code = request.query_params.get('state', ''), request.query_params.get('code', '')
        denied = 'error' in request.query_params
        ticket = None
        if state and len(state) <= 128 and (denied or code and len(code) <= 4096):
            ticket = FacebookAuthorization.objects.select_related('owner').filter(
                state_hash=hashlib.sha256(state.encode()).hexdigest(),
                expires_at__gt=timezone.now(), used=False).first()
        if (not ticket or ticket.return_origin not in allowed_origins()
                or not ticket.owner.is_active or ticket.owner.rol != 'marketero'
                or ticket.owner.token_version != ticket.token_version):
            response = HttpResponse('Autorización inválida o vencida. Vuelve a Configuración y conecta Facebook.', status=400)
        else:
            values = {'provider': 'facebook', 'state': state}
            values.update({'error': 'access_denied'} if denied else {'code': code})
            response = HttpResponseRedirect(ticket.return_origin + '/settings#' + urlencode(values))
        response['Cache-Control'] = 'no-store'
        response['Referrer-Policy'] = 'no-referrer'
        return response


class FacebookCompleteView(APIView):
    permission_classes = [IsAuthenticated, IsMarketero]

    def post(self, request):
        if not configured():
            return Response(api_response(False, 'La conexión de Facebook no está configurada.'), status=503)
        state, code = request.data.get('state'), request.data.get('code')
        if (not isinstance(state, str) or not isinstance(code, str) or not state or not code
                or len(state) > 128 or len(code) > 4096):
            return Response(api_response(False, 'Autorización inválida.'), status=400)
        consumed = FacebookAuthorization.objects.filter(owner=request.user,
            state_hash=hashlib.sha256(state.encode()).hexdigest(), token_version=request.user.token_version,
            expires_at__gt=timezone.now(), used=False).update(used=True)
        if not consumed:
            return Response(api_response(False, 'Autorización vencida o inválida. Vuelve a conectar Facebook.'), status=400)
        try:
            pages, lifetime = exchange_code(code)
            encrypted = [(page, cipher().encrypt(page['token'].encode()).decode()) for page in pages]
        except FacebookError as error:
            logger.warning('Facebook authorization failed at stage=%s', error.stage)
            return Response(api_response(False, FAILURES.get(error.stage, 'No se pudo conectar Facebook.')), status=502)
        with transaction.atomic():
            owner = type(request.user).objects.select_for_update().get(pk=request.user.pk)
            if not owner.is_active or owner.rol != 'marketero' or owner.token_version != request.user.token_version:
                return Response(api_response(False, 'La sesión ya no es válida.'), status=403)
            for page, token in encrypted:
                FacebookPage.objects.update_or_create(owner=owner, facebook_page_id=page['page_id'], defaults={
                    'name': page['name'], 'encrypted_token': token,
                    'expires_at': timezone.now() + timedelta(seconds=lifetime)})
        return Response(api_response(True, 'Páginas de Facebook conectadas.', {'count': len(pages)}))
