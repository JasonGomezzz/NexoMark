"""Read-only social counters. No publishing or fabricated zeroes for missing data."""
import re
from datetime import timedelta

import requests
from cryptography.fernet import InvalidToken
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.instagram import cipher
from apps.authentication.models import InstagramAccount, FacebookPage
from apps.authentication.permissions import IsMarketeroOrSuperAdmin
from core.exceptions import api_response
from .models import (Campaign, InstagramPublication, FacebookPublication,
                     PublicationMetricSnapshot, PublicationAvailability, XPublication, TikTokUpload, XMetricReadBudget)
from .social_metric_readers import (x_counters, tiktok_counters, MetricReadUnavailable,
                                   PublicationNotFound, PublicationUnverifiable)
from .tiktok_post_ids import effective_public_post_ids
from .facebook_insights import optional_insight

MODELS = {'facebook': FacebookPublication, 'instagram': InstagramPublication,
          'twitter': XPublication, 'tiktok': TikTokUpload}
PLATFORMS = tuple(MODELS)
METRICS = ('likes', 'comments', 'shares', 'views')


def campaigns_for(user):
    qs = Campaign.objects.all()
    return qs if user.rol == 'superadmin' else qs.filter(marketero=user)


def count(value):
    return value if type(value) is int and 0 <= value <= 2**63 - 1 else None


def read_counters(platform, publication):
    if platform == 'twitter':
        return x_counters(publication, count)
    if platform == 'tiktok':
        return tiktok_counters(publication, count)
    account = publication.page if platform == 'facebook' else publication.account
    if account is None:
        # Reconnection creates a new credential row; match immutable destination
        # and owner, never borrow another marketer's account or change history.
        account = (FacebookPage.objects.filter(owner_id=publication.campaign.marketero_id,
                   facebook_page_id=publication.facebook_page_id).first() if platform == 'facebook' else
                   InstagramAccount.objects.filter(owner_id=publication.campaign.marketero_id,
                   instagram_user_id=publication.instagram_user_id).first())
    identity_field = 'facebook_page_id' if platform == 'facebook' else 'instagram_user_id'
    if (not account or account.owner_id != publication.campaign.marketero_id
            or getattr(account, identity_field) != getattr(publication, identity_field)):
        raise ValueError('Cuenta desconectada.')
    if account.expires_at <= timezone.now():
        raise ValueError('Autorización vencida.')
    token = cipher().decrypt(account.encrypted_token.encode()).decode()
    identifier = publication.post_id if platform == 'facebook' else publication.media_id
    if not re.fullmatch(r'[0-9_]{1,140}', identifier):
        raise ValueError('No hay identificador confirmado.')
    host = 'graph.facebook.com' if platform == 'facebook' else 'graph.instagram.com'
    version = settings.FACEBOOK_GRAPH_VERSION if platform == 'facebook' else ''
    path = f'{version}/{identifier}' if version else identifier
    fields = ('reactions.type(LIKE).limit(0).summary(true),comments.limit(0).summary(true),shares'
              if platform == 'facebook' else 'like_count,comments_count')
    response = requests.get(f'https://{host}/{path}', params={'fields': fields},
                            headers={'Authorization': f'Bearer {token}'},
                            timeout=20, allow_redirects=False)
    data = response.json()
    if (isinstance(data, dict) and isinstance(data.get('error'), dict)
            and data['error'].get('code') == 100 and data['error'].get('error_subcode') == 33):
        raise PublicationUnverifiable('Meta no permite acceder a esta publicación. Revisa su existencia, privacidad y permisos; no se confirma su eliminación.')
    if platform == 'facebook' and isinstance(data, dict) and isinstance(data.get('error'), dict) and data['error'].get('code') == 10:
        raise MetricReadUnavailable('Facebook requiere pages_read_user_content. Añade ese permiso en Meta y reconecta la Página; se conservan las mediciones anteriores.')
    response.raise_for_status()
    if not isinstance(data, dict) or 'error' in data:
        raise ValueError('No se obtuvieron métricas.')
    values = dict.fromkeys(METRICS)
    if platform == 'instagram':
        values.update(likes=count(data.get('like_count')), comments=count(data.get('comments_count')))
    else:
        for metric, field in [('likes', 'reactions'), ('comments', 'comments')]:
            edge = data.get(field)
            if isinstance(edge, dict) and isinstance(edge.get('summary'), dict):
                values[metric] = count(edge['summary'].get('total_count'))
        if isinstance(data.get('shares'), dict):
            values['shares'] = count(data['shares'].get('count'))
        insights_url = f'https://{host}/{path}'
        values['views'] = count(optional_insight(insights_url, token, 'post_media_view'))
        if values['shares'] is None:
            activity = optional_insight(insights_url, token, 'post_activity_by_action_type')
            if isinstance(activity, dict):
                values['shares'] = count(activity.get('share'))
    if all(v is None for v in values.values()):
        raise ValueError('Meta no devolvió contadores disponibles.')
    return values


def refresh_availability(platform, publication):
    if platform == 'twitter':
        budget = XMetricReadBudget.objects.filter(owner_id=publication.campaign.marketero_id).first()
        return bool(budget and budget.requests_reserved < budget.request_limit), 'X requiere presupuesto de lectura autorizado.'
    if platform == 'tiktok':
        account = publication.account
        available = bool(effective_public_post_ids(publication) and account and 'video.list' in account.scopes)
        return available, 'TikTok requiere un ID público confirmado y permiso video.list; compatibilidad de fotos pendiente.'
    return True, ''


def publication_rows(campaigns):
    availability = {(a.platform, a.publication_id): a for a in PublicationAvailability.objects.filter(campaign__in=campaigns)}
    snapshots = {}
    for s in PublicationMetricSnapshot.objects.filter(campaign__in=campaigns).order_by('measured_at', 'id'):
        snapshots[(s.platform, s.publication_id)] = s
    rows = []
    for platform, model in MODELS.items():
        eligible = Q(status='published') | Q(publication_link__isnull=False) if platform == 'tiktok' else Q(status='published')
        records = model.objects.filter(eligible, campaign__in=campaigns).select_related('campaign')
        if platform == 'tiktok':
            records = records.select_related('account', 'publication_link')
        for p in records:
            check = availability.get((platform, p.pk))
            s = snapshots.get((platform, p.pk))
            post_ids = effective_public_post_ids(p) if platform == 'tiktok' else []
            link = getattr(p, 'publication_link', None) if platform == 'tiktok' else None
            # A second public post can appear later for the same TikTok upload.
            # Never present an old subset as complete coverage of the new set.
            if platform == 'tiktok' and s and s.metrics.get('_public_post_ids') != post_ids:
                s = None
            available, reason = refresh_availability(platform, p)
            cost_note = ''
            if platform == 'twitter':
                budget = XMetricReadBudget.objects.filter(owner_id=p.campaign.marketero_id).first()
                if budget:
                    cost_note = (f'Consulta de pago: US${budget.unit_cost_usd} estimados por intento; '
                                 f'{max(0, budget.request_limit - budget.requests_reserved)} consultas autorizadas restantes. '
                                 'Tarifa sujeta a cambios de X; sin compra ni recarga automática.')
            rows.append({'platform': platform, 'publication_id': p.pk, 'campaign_id': p.campaign_id,
                         'publication_count': max(1, len(post_ids)) if platform == 'tiktok' else 1,
                         'title': p.campaign.titulo, 'version': p.campaign_version,
                         'destination': p.page_name if platform == 'facebook' else
                                        p.display_name if platform == 'tiktok' else p.username,
                         'registered_at': ((link.provider_created_at if link and link.provider_created_at else None) or p.published_at or p.created_at).isoformat() if platform == 'tiktok' else p.created_at.isoformat(),
                         'confirmation_source': 'user_confirmed_display_api' if link else (p.confirmation_source if platform == 'tiktok' else 'provider'),
                         'delivery_status': p.status if platform == 'tiktok' else 'published',
                         'availability': check.state if check else 'unknown',
                         'availability_note': check.note if check else '',
                         'checked_at': check.checked_at.isoformat() if check else None,
                         'included_in_totals': not check or check.state != 'unavailable',
                         'can_refresh': available, 'refresh_note': reason if not available else '',
                         'refresh_cost_note': cost_note,
                         'metrics': {k: s.metrics.get(k) if s else None for k in METRICS},
                         'measured_at': s.measured_at.isoformat() if s else None})
    return sorted(rows, key=lambda r: r['registered_at'], reverse=True)


def summary(rows):
    rows = [r for r in rows if r.get('included_in_totals', True)]
    return {platform: {'publications': sum(r.get('publication_count', 1) for r in group), 'metrics': {
        k: {'value': sum(r['metrics'][k] for r in group if r['metrics'][k] is not None)
                     if any(r['metrics'][k] is not None for r in group) else None,
            'covered': sum(r.get('publication_count', 1) for r in group if r['metrics'][k] is not None)} for k in METRICS}}
        for platform in PLATFORMS for group in [[r for r in rows if r['platform'] == platform]]}


def publication_month(row):
    return timezone.localtime(timezone.datetime.fromisoformat(row['registered_at'])).strftime('%Y-%m')


def monthly_likes(rows, year):
    """Latest lifetime likes grouped by publication month, not time of each like."""
    result = []
    for month in range(1, 13):
        key = f'{year}-{month:02d}'
        item = {'month': key}
        for platform in PLATFORMS:
            group = [row for row in rows if row.get('included_in_totals', True) and row['platform'] == platform and publication_month(row) == key]
            values = [count(row['metrics'].get('likes')) for row in group]
            known = [value for value in values if value is not None]
            item[platform] = sum(known) if known else None
            item[f'{platform}_covered'] = sum(row.get('publication_count', 1) for row, value in zip(group, values) if value is not None)
            item[f'{platform}_publications'] = sum(row.get('publication_count', 1) for row in group)
        result.append(item)
    return result


class PublicationStatisticsView(APIView):
    permission_classes = [IsAuthenticated, IsMarketeroOrSuperAdmin]

    def get(self, request, campaign_id=None):
        campaigns = campaigns_for(request.user)
        if campaign_id is not None:
            get_object_or_404(campaigns, pk=campaign_id)
            campaigns = campaigns.filter(pk=campaign_id)
        year = request.query_params.get('year', str(timezone.localdate().year))
        if not re.fullmatch(r'20[0-9]{2}', year):
            raise ValidationError('El año debe estar entre 2000 y 2099.')
        rows = publication_rows(campaigns)
        year_rows = [row for row in rows if publication_month(row).startswith(f'{year}-')]
        platforms = summary(year_rows)
        for platform, model in MODELS.items():
            pending = model.objects.filter(campaign__in=campaigns,
                created_at__year=int(year),
                status__in=['publishing', 'preparing', 'processing', 'inbox', 'uncertain', 'sending'])
            if platform == 'tiktok':
                pending = pending.filter(publication_link__isnull=True)
            platforms[platform]['pending'] = pending.count()
        if request.user.rol != 'marketero':
            for row in rows:
                row['can_refresh'] = False
        monthly = []
        for month in range(1, 13):
            key = f'{year}-{month:02d}'
            item = {'month': key}
            for platform in PLATFORMS:
                item[platform] = sum(r.get('publication_count', 1) for r in rows if r.get('included_in_totals', True) and r['platform'] == platform and
                                     publication_month(r) == key)
            monthly.append(item)
        return Response(api_response(True, 'Publicaciones confirmadas registradas por NexoMark.',
            {'platforms': platforms, 'publications': rows, 'monthly': monthly,
             'monthly_likes': monthly_likes(rows, year), 'year': int(year),
             'monthly_likes_basis': 'latest_lifetime_likes_by_publication_month',
             'totals_basis': 'latest_lifetime_counters_by_publication_year',
             'note': 'Contadores acumulados en la última medición; no interacciones ocurridas por mes. '
                     'Las publicaciones que la API identifica como no encontradas se excluyen de los totales, pero conservan su historial y últimas cifras. '
                     'Los problemas de permisos, privacidad o compatibilidad no demuestran una eliminación. '
                     'Los totales superiores suman las publicaciones registradas en el año seleccionado. '
                     'Los meses cuentan la fecha de registro del envío confirmado, incluyendo versiones anteriores. '
                     'Vistas y compartidos de Instagram requieren integración Insights adicional. '
                     'X: reposts (sin citas) e impresiones; consultas con presupuesto limitado. '
                     'TikTok incluye publicaciones confirmadas o vinculadas por el propietario y verificadas por API. '
                     'En vinculaciones se usa la fecha de publicación de TikTok cuando está disponible. '
                     'No incluye otros posts del perfil ni envíos sin confirmación o vinculación verificada.'}))


class RefreshPublicationStatisticsView(APIView):
    permission_classes = [IsAuthenticated, IsMarketeroOrSuperAdmin]

    def post(self, request, campaign_id):
        # Admin can inspect snapshots, not borrow another owner's credentials.
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        platform, identifier = request.data.get('platform'), request.data.get('publication_id')
        if platform not in MODELS or type(identifier) is not int or identifier <= 0:
            raise ValidationError('Selecciona una publicación confirmada y una plataforma válida.')
        # Paid reservations must survive provider failure, so network reads are
        # intentionally outside a surrounding database transaction.
        p = get_object_or_404(MODELS[platform].objects,
                             pk=identifier, campaign=campaign)
        if p.status != 'published' and not (platform == 'tiktok' and getattr(p, 'publication_link', None)):
            from django.http import Http404
            raise Http404
        check = PublicationAvailability.objects.filter(platform=platform, publication_id=p.pk).first()
        if check and timezone.now() - check.checked_at < timedelta(minutes=5):
            return Response(api_response(True, 'Se conserva la comprobación reciente; espera cinco minutos.',
                                         {'availability': check.state, 'checked_at': check.checked_at.isoformat()}))
        latest = PublicationMetricSnapshot.objects.filter(platform=platform, publication_id=p.pk).order_by('-measured_at').first()
        same_content = platform != 'tiktok' or latest and latest.metrics.get('_public_post_ids') == effective_public_post_ids(p)
        if latest and same_content and timezone.now() - latest.measured_at < timedelta(minutes=5):
            return Response(api_response(True, 'Se conserva la medición reciente; espera cinco minutos.',
                                         {'measured_at': latest.measured_at.isoformat()}))
        try:
            values = read_counters(platform, p)
        except (PublicationNotFound, PublicationUnverifiable) as error:
            state = 'unavailable' if isinstance(error, PublicationNotFound) else 'unverified'
            PublicationAvailability.objects.update_or_create(platform=platform, publication_id=p.pk,
                defaults={'campaign': campaign, 'state': state, 'note': str(error), 'checked_at': timezone.now()})
            return Response(api_response(True, str(error), {'availability': state}))
        except MetricReadUnavailable as error:
            self.record_failure(campaign, platform, p.pk, check, str(error))
            return Response(api_response(False, str(error)), status=503)
        except (requests.RequestException, InvalidToken, ValueError, UnicodeError, TypeError, KeyError, ObjectDoesNotExist):
            self.record_failure(campaign, platform, p.pk, check,
                                'No se pudo sincronizar. Se conserva la última medición; revisa la conexión y los permisos.')
            return Response(api_response(False, 'No se pudieron consultar las métricas. Revisa la cuenta y los permisos de lectura. '
                                         'Se conservan las mediciones anteriores; no se publicó contenido.'), status=503)
        now = timezone.now()
        with transaction.atomic():
            PublicationMetricSnapshot.objects.update_or_create(platform=platform, publication_id=p.pk,
                day=timezone.localdate(), defaults={'campaign': campaign, 'metrics': values, 'measured_at': now})
            PublicationAvailability.objects.update_or_create(platform=platform, publication_id=p.pk,
                defaults={'campaign': campaign, 'state': 'available', 'note': '', 'checked_at': now})
        return Response(api_response(True, 'Métricas consultadas en la plataforma.', {'measured_at': now.isoformat()}))

    @staticmethod
    def record_failure(campaign, platform, identifier, previous, note):
        # An auth error/timeout must never restore a missing post or erase counters.
        PublicationAvailability.objects.update_or_create(platform=platform, publication_id=identifier,
            defaults={'campaign': campaign, 'state': previous.state if previous else 'unknown',
                      'note': note, 'checked_at': timezone.now()})
