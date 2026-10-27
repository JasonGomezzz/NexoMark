from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone
from apps.authentication.models import InstagramAccount
from apps.campaigns.models import InstagramPublication, FacebookPublication, PublicationMetricSnapshot, PublicationAvailability, Campaign
from apps.campaigns.publication_statistics import count, read_counters

pytestmark = pytest.mark.django_db
BASE = '/api/campaigns/publication-statistics/'


@pytest.fixture
def publication(campaign, user_marketero):
    account = InstagramAccount.objects.create(owner=user_marketero, instagram_user_id='123',
        username='demo', encrypted_token='ciphertext', expires_at=timezone.now() + timedelta(days=1))
    return InstagramPublication.objects.create(campaign=campaign, account=account,
        instagram_user_id='123', username='demo', campaign_version=1, caption='ok', image_jpeg='',
        image_expires_at=timezone.now(), media_id='12345', status='published')


def test_unknown_metrics_are_not_zero_and_earlier_versions_count(api_client, publication):
    publication.campaign.version = 9
    publication.campaign.save()
    d = api_client.get(BASE).data['data']
    assert d['platforms']['instagram']['publications'] == 1
    assert d['platforms']['instagram']['metrics']['likes'] == {'value': None, 'covered': 0}
    assert sum(m['instagram'] for m in d['monthly']) == 1
    assert d['publications'][0]['version'] == 1


def test_latest_snapshot_not_double_counted(api_client, publication):
    for day, likes in [(timezone.localdate() - timedelta(days=1), 3), (timezone.localdate(), 5)]:
        PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
            publication_id=publication.pk, day=day, metrics={'likes': likes, 'comments': 0})
    metrics = api_client.get(BASE).data['data']['platforms']['instagram']['metrics']
    assert metrics['likes'] == {'value': 5, 'covered': 1}
    assert metrics['comments']['value'] == 0
    assert metrics['views']['value'] is None


def test_monthly_likes_uses_latest_counter_and_publication_month(api_client, publication):
    from datetime import date, datetime
    InstagramPublication.objects.filter(pk=publication.pk).update(created_at=timezone.make_aware(datetime(2026, 1, 10)))
    for day, likes in [(date(2026, 1, 20), 7), (date(2026, 2, 20), 5)]:
        PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
            publication_id=publication.pk, day=day, metrics={'likes': likes})
    values = api_client.get(BASE, {'year': '2026'}).data['data']['monthly_likes']
    assert values[0]['instagram'] == 5 and values[0]['instagram_covered'] == 1
    assert values[1]['instagram'] is None
    assert values[2]['instagram'] is None


def test_first_measurement_already_appears_in_monthly_likes(api_client, publication):
    PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
        publication_id=publication.pk, day=timezone.localdate(), metrics={'likes': 2})
    d = api_client.get(BASE).data['data']
    m = d['monthly_likes'][timezone.localtime(publication.created_at).month - 1]
    assert m['instagram'] == 2 and m['instagram_covered'] == 1
    assert d['monthly_likes_basis'] == 'latest_lifetime_likes_by_publication_month'


def test_selected_year_filters_top_totals_without_erasing_history(api_client, publication):
    from datetime import datetime
    InstagramPublication.objects.filter(pk=publication.pk).update(created_at=timezone.make_aware(datetime(2025, 6, 10)))
    PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
        publication_id=publication.pk, day=timezone.localdate(), metrics={'likes': 7, 'shares': 3})
    for year, publications, likes, shares in [('2025', 1, 7, 3), ('2026', 0, None, None)]:
        data = api_client.get(BASE, {'year': year}).data['data']
        group = data['platforms']['instagram']
        assert group['publications'] == publications
        assert group['metrics']['likes']['value'] == likes
        assert group['metrics']['shares']['value'] == shares
        assert len(data['publications']) == 1
        assert data['totals_basis'] == 'latest_lifetime_counters_by_publication_year'
        assert sum(m['instagram'] for m in data['monthly']) == publications


def test_annual_totals_respect_lima_year_boundary(api_client, publication):
    from datetime import datetime, timezone as tz
    InstagramPublication.objects.filter(pk=publication.pk).update(created_at=datetime(2026, 1, 1, 0, 30, tzinfo=tz.utc))
    with timezone.override('America/Lima'):
        assert api_client.get(BASE, {'year': '2025'}).data['data']['platforms']['instagram']['publications'] == 1
        assert api_client.get(BASE, {'year': '2026'}).data['data']['platforms']['instagram']['publications'] == 0


def test_monthly_likes_preserves_unknown_zero_and_partial_coverage():
    from apps.campaigns.publication_statistics import monthly_likes
    rows = [{'platform': 'instagram', 'registered_at': '2026-02-01T00:30:00+00:00', 'metrics': {'likes': v}}
            for v in [2, 0, None]]
    with timezone.override('America/Lima'):
        m = monthly_likes(rows, '2026')
    assert m[0]['instagram'] == 2 and m[0]['instagram_covered'] == 2
    assert m[0]['instagram_publications'] == 3
    assert m[1]['instagram'] is None
    rows[0]['metrics']['likes'] = 0
    with timezone.override('America/Lima'):
        assert monthly_likes(rows, '2026')[0]['instagram'] == 0


def test_scope_and_input_validation(api_client, publication, superadmin, cliente):
    other = Campaign.objects.create(titulo='private', cliente_nombre='x', industria='x', prompt='x', marketero=superadmin)
    assert api_client.get(f'/api/campaigns/{other.pk}/publication-statistics/').status_code == 404
    assert api_client.get(BASE, {'year': 'bad'}).status_code == 400
    api_client.force_authenticate(cliente)
    assert api_client.get(BASE).status_code == 403
    api_client.force_authenticate(None)
    assert api_client.get(BASE).status_code == 401


def test_only_confirmed_publications(api_client, publication):
    publication.status = 'publishing'
    publication.save()
    assert not api_client.get(BASE).data['data']['publications']
    assert api_client.get(BASE).data['data']['platforms']['instagram']['pending'] == 1


def test_tiktok_inbox_does_not_count_as_published(api_client, campaign):
    from apps.campaigns.models import TikTokUpload
    TikTokUpload.objects.create(campaign=campaign, open_id='open', display_name='Demo',
        campaign_version=1, caption='x', image_jpeg='', image_expires_at=timezone.now(), status='inbox')
    d = api_client.get(BASE).data['data']['platforms']['tiktok']
    assert d['publications'] == 0 and d['pending'] == 1


def test_refresh_preserves_snapshot_on_failure(api_client, publication):
    url = f'/api/campaigns/{publication.campaign_id}/publication-statistics/refresh/'
    payload = {'platform': 'instagram', 'publication_id': publication.pk}
    with patch('apps.campaigns.publication_statistics.read_counters', return_value={'likes': 5, 'comments': 0, 'shares': None, 'views': None}) as fetch:
        assert api_client.post(url, payload, format='json').status_code == 200
        assert api_client.post(url, payload, format='json').status_code == 200
        assert fetch.call_count == 1
    PublicationMetricSnapshot.objects.update(measured_at=timezone.now() - timedelta(minutes=6))
    PublicationAvailability.objects.update(checked_at=timezone.now() - timedelta(minutes=6))
    with patch('apps.campaigns.publication_statistics.read_counters', side_effect=ValueError('secret')):
        r = api_client.post(url, payload, format='json')
        assert r.status_code == 503 and 'secret' not in str(r.data)
    assert PublicationMetricSnapshot.objects.get().metrics['likes'] == 5
    publication.refresh_from_db()
    assert publication.status == 'published'


def test_refresh_invalid_and_admin_cannot_use_other_credentials(api_client, publication, superadmin_client):
    url = f'/api/campaigns/{publication.campaign_id}/publication-statistics/refresh/'
    assert api_client.post(url, {'platform': 'unsupported', 'publication_id': 1}).status_code == 400
    assert api_client.post(url, {'platform': 'instagram', 'publication_id': True}).status_code == 400
    assert superadmin_client.post(url, {'platform': 'instagram', 'publication_id': publication.pk}).status_code == 404
    assert superadmin_client.get(BASE).status_code == 200


def test_provider_uses_read_only_fixed_host_and_header(publication):
    response = Mock(status_code=200)
    response.json.return_value = {'like_count': 0, 'comments_count': 2}
    with patch('apps.campaigns.publication_statistics.cipher') as crypto, patch('apps.campaigns.publication_statistics.requests.get', return_value=response) as get:
        crypto.return_value.decrypt.return_value = b'private-token'
        assert read_counters('instagram', publication) == {'likes': 0, 'comments': 2, 'shares': None, 'views': None}
        args, kwargs = get.call_args
        assert args == ('https://graph.instagram.com/12345',)
        assert kwargs['headers']['Authorization'] == 'Bearer private-token'
        assert kwargs['allow_redirects'] is False
        assert 'private-token' not in str(kwargs['params'])


def test_disconnected_or_expired_account_is_not_read(publication):
    publication.account.expires_at = timezone.now() - timedelta(days=1)
    publication.account.save()
    with pytest.raises(ValueError):
        read_counters('instagram', publication)
    publication.account.delete()
    publication.account = None
    with pytest.raises(ValueError):
        read_counters('instagram', publication)


def test_reconnected_same_owner_and_destination_can_read(publication):
    publication.account = None
    response = Mock()
    response.json.return_value = {'like_count': 2, 'comments_count': 1}
    with patch('apps.campaigns.publication_statistics.cipher') as crypto, patch('apps.campaigns.publication_statistics.requests.get', return_value=response):
        crypto.return_value.decrypt.return_value = b'token'
        assert read_counters('instagram', publication)['likes'] == 2


def test_facebook_counts_are_not_all_reactions(publication, settings):
    from apps.authentication.models import FacebookPage
    page = FacebookPage.objects.create(owner=publication.campaign.marketero, facebook_page_id='321',
        name='Demo', encrypted_token='ciphertext', expires_at=timezone.now() + timedelta(days=1))
    p = FacebookPublication.objects.create(campaign=publication.campaign, page=page, facebook_page_id='321',
        page_name='Demo', campaign_version=1, caption='ok', image_jpeg='', post_id='321_456', status='published')
    response = Mock()
    response.json.return_value = {'reactions': {'summary': {'total_count': 4}},
        'comments': {'summary': {'total_count': 2}}, 'shares': {'count': 1}}
    with patch('apps.campaigns.publication_statistics.cipher') as crypto, patch('apps.campaigns.publication_statistics.requests.get', return_value=response) as get:
        crypto.return_value.decrypt.return_value = b'token'
        assert read_counters('facebook', p) == {'likes': 4, 'comments': 2, 'shares': 1, 'views': None}
        assert 'reactions.type(LIKE)' in get.call_args_list[0].kwargs['params']['fields']
        response.json.return_value = {'error': {'message': 'secret'}}
        with pytest.raises(ValueError): read_counters('facebook', p)
        response.json.return_value = {}
        with pytest.raises(ValueError): read_counters('facebook', p)
        p.post_id = '../invalid'
        with pytest.raises(ValueError): read_counters('facebook', p)


@pytest.mark.parametrize('value', [None, True, -1, '3', 2**64])
def test_invalid_counter_is_unavailable(value):
    assert count(value) is None


def test_missing_post_excluded_everywhere_but_history_and_recovery_preserved(api_client, publication):
    from apps.campaigns.social_metric_readers import PublicationNotFound
    from apps.campaigns.serializers import CampaignSerializer
    PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
        publication_id=publication.pk, day=timezone.localdate(), metrics={'likes': 7},
        measured_at=timezone.now() - timedelta(minutes=6))
    url = f'/api/campaigns/{publication.campaign_id}/publication-statistics/refresh/'
    payload = {'platform': 'instagram', 'publication_id': publication.pk}
    with patch('apps.campaigns.publication_statistics.read_counters', side_effect=PublicationNotFound('No encontrada.')):
        assert api_client.post(url, payload, format='json').status_code == 200
    data = api_client.get(BASE).data['data']
    assert data['platforms']['instagram']['publications'] == 0
    assert data['platforms']['instagram']['metrics']['likes']['value'] is None
    assert sum(row['instagram'] for row in data['monthly']) == 0
    assert all(row['instagram'] is None for row in data['monthly_likes'])
    assert data['publications'][0]['metrics']['likes'] == 7
    assert data['publications'][0]['included_in_totals'] is False
    assert CampaignSerializer(publication.campaign).data['publication_status']['instagram'] == 'unavailable'
    publication.refresh_from_db()
    assert publication.status == 'published'  # historical delivery must not be erased
    PublicationAvailability.objects.update(checked_at=timezone.now() - timedelta(minutes=6))
    with patch('apps.campaigns.publication_statistics.read_counters', return_value={'likes': 8}):
        assert api_client.post(url, payload, format='json').status_code == 200
    assert api_client.get(BASE).data['data']['platforms']['instagram']['metrics']['likes']['value'] == 8


def test_ambiguous_absence_and_permission_failures_never_erase_totals(api_client, publication):
    from apps.campaigns.social_metric_readers import PublicationUnverifiable
    PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
        publication_id=publication.pk, day=timezone.localdate(), metrics={'likes': 7},
        measured_at=timezone.now() - timedelta(minutes=6))
    url = f'/api/campaigns/{publication.campaign_id}/publication-statistics/refresh/'
    payload = {'platform': 'instagram', 'publication_id': publication.pk}
    for failure, expected in [(PublicationUnverifiable('Privacidad o permisos.'), 200), (ValueError('secret'), 503)]:
        PublicationAvailability.objects.update(checked_at=timezone.now() - timedelta(minutes=6))
        with patch('apps.campaigns.publication_statistics.read_counters', side_effect=failure):
            assert api_client.post(url, payload, format='json').status_code == expected
        data = api_client.get(BASE).data['data']
        assert data['platforms']['instagram']['publications'] == 1
        assert data['platforms']['instagram']['metrics']['likes']['value'] == 7
        assert 'secret' not in str(data)


def test_campaign_deletion_removes_local_report_records_without_network_calls(api_client, publication):
    from apps.campaigns.models import CampaignStatus
    publication.campaign.estado = CampaignStatus.GENERADO
    publication.campaign.save()
    PublicationMetricSnapshot.objects.create(campaign=publication.campaign, platform='instagram',
        publication_id=publication.pk, day=timezone.localdate(), metrics={'likes': 7})
    PublicationAvailability.objects.create(campaign=publication.campaign, platform='instagram', publication_id=publication.pk)
    with patch('apps.campaigns.publication_statistics.requests.delete') as delete:
        assert api_client.delete(f'/api/campaigns/{publication.campaign_id}/').status_code == 204
        delete.assert_not_called()
    assert not PublicationAvailability.objects.exists()
    assert not PublicationMetricSnapshot.objects.exists()
    assert not api_client.get(BASE).data['data']['publications']
