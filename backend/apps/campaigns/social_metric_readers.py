"""Exact-publication readers. No timelines, reposts, or automatic paid retries."""
import re

import requests
from django.db import transaction

from apps.authentication.models import XAccount, TikTokAccount
from apps.authentication.x_oauth import access_token_for as x_token
from apps.authentication.tiktok import access_token_for as tiktok_token
from .models import XMetricReadBudget
from .tiktok_post_ids import effective_public_post_ids


class MetricReadUnavailable(ValueError):
    """Only locally authored, credential-free messages may reach the UI."""


class PublicationNotFound(MetricReadUnavailable):
    """Provider explicitly reports the exact resource missing; not proof of deletion."""


class PublicationUnverifiable(MetricReadUnavailable):
    """Missing content may also mean privacy, permissions or API incompatibility."""


def owned_account(publication, model, identity_field):
    identity = getattr(publication, identity_field)
    account = publication.account
    if account is None:
        account = model.objects.filter(owner_id=publication.campaign.marketero_id,
                                       **{identity_field: identity}).first()
    if (account is None or account.owner_id != publication.campaign.marketero_id
            or getattr(account, identity_field) != identity):
        raise MetricReadUnavailable('Reconecta la misma cuenta que publicó esta campaña.')
    return account


def reserve_x_read(owner_id):
    # Commit before network I/O. A timeout may still have consumed credits.
    # Callers must not enclose this function in a transaction that can roll back.
    with transaction.atomic(durable=True):
        budget = XMetricReadBudget.objects.select_for_update().filter(owner_id=owner_id).first()
        if not budget or budget.requests_reserved >= budget.request_limit:
            raise MetricReadUnavailable('X: presupuesto de consultas agotado o no autorizado. No se compraron créditos.')
        budget.requests_reserved += 1
        budget.save(update_fields=['requests_reserved'])


def x_counters(publication, count):
    account = owned_account(publication, XAccount, 'x_user_id')
    if not re.fullmatch(r'[0-9]{1,64}', publication.post_id):
        raise MetricReadUnavailable('X no tiene un identificador de publicación confirmado.')
    token = x_token(account)
    reserve_x_read(account.owner_id)
    response = requests.get(f'https://api.x.com/2/tweets/{publication.post_id}',
        params={'tweet.fields': 'author_id,public_metrics'},
        headers={'Authorization': f'Bearer {token}'}, timeout=20, allow_redirects=False)
    if response.status_code == 402:
        raise MetricReadUnavailable('X rechazó la consulta por falta de créditos. Se conservan los datos anteriores.')
    body = response.json()
    errors = body.get('errors', [body]) if isinstance(body, dict) else []
    if response.status_code in (200, 404) and any(
            isinstance(e, dict) and str(e.get('type', '')).endswith('/resource-not-found')
            and str(e.get('resource_id', '')) == publication.post_id for e in errors):
        raise PublicationNotFound('X no encuentra esta publicación. Puede haber sido eliminada o dejado de estar disponible; se conserva su historial.')
    response.raise_for_status()
    data = body.get('data') if isinstance(body, dict) and not body.get('errors') else None
    if (not isinstance(data, dict) or data.get('id') != publication.post_id
            or data.get('author_id') != publication.x_user_id
            or not isinstance(data.get('public_metrics'), dict)):
        raise MetricReadUnavailable('X no confirmó métricas de la publicación y cuenta esperadas.')
    metrics = data['public_metrics']
    values = {k: count(metrics.get(field)) for k, field in {
        'likes': 'like_count', 'comments': 'reply_count',
        'shares': 'retweet_count', 'views': 'impression_count'}.items()}
    if all(v is None for v in values.values()):
        raise MetricReadUnavailable('X no devolvió contadores disponibles.')
    return values


def query_tiktok_publications(account, identifiers, *, details=False):
    if 'video.list' not in account.scopes:
        raise MetricReadUnavailable('TikTok: añade video.list en Scopes del Sandbox y reconecta con ese permiso.')
    if (not isinstance(identifiers, list) or not 1 <= len(identifiers) <= 20
            or any(not isinstance(i, str) or not re.fullmatch(r'[0-9]{1,64}', i) for i in identifiers)
            or len(set(identifiers)) != len(identifiers)):
        raise MetricReadUnavailable('TikTok aún no confirmó el identificador público de este envío.')
    response = requests.post('https://open.tiktokapis.com/v2/video/query/',
        params={'fields': 'id,like_count,comment_count,share_count,view_count' +
                (',video_description,create_time,share_url' if details else '')},
        json={'filters': {'video_ids': identifiers}},
        headers={'Authorization': f'Bearer {tiktok_token(account)}'}, timeout=20, allow_redirects=False)
    response.raise_for_status()
    body = response.json()
    if (not isinstance(body, dict) or not isinstance(body.get('error'), dict)
            or body['error'].get('code') != 'ok' or not isinstance(body.get('data'), dict)):
        raise MetricReadUnavailable('TikTok no devolvió métricas. Revisa el permiso y la compatibilidad del contenido.')
    videos = body['data'].get('videos')
    if isinstance(videos, list) and not videos:
        raise PublicationUnverifiable('TikTok no devuelve este contenido. Puede ser privado, eliminado o incompatible con la API; no se confirma su eliminación.')
    if (not isinstance(videos, list) or len(videos) != len(identifiers)
            or any(not isinstance(v, dict) or v.get('id') not in identifiers for v in videos)
            or len({v['id'] for v in videos}) != len(identifiers)):
        raise MetricReadUnavailable('TikTok no devolvió todos los contenidos confirmados; las fotos pueden no ser compatibles con Display API.')
    return videos


def tiktok_values(videos, count):
    values = {}
    for metric, field in {'likes': 'like_count', 'comments': 'comment_count',
                          'shares': 'share_count', 'views': 'view_count'}.items():
        counters = [count(v.get(field)) for v in videos]
        values[metric] = sum(counters) if all(c is not None for c in counters) else None
    if all(v is None for v in values.values()):
        raise MetricReadUnavailable('TikTok no devolvió contadores disponibles.')
    values['_public_post_ids'] = sorted(v['id'] for v in videos)
    return values


def tiktok_counters(publication, count):
    account = owned_account(publication, TikTokAccount, 'open_id')
    return tiktok_values(query_tiktok_publications(account, effective_public_post_ids(publication)), count)
