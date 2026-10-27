from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
import requests
from django.utils import timezone

from apps.authentication.models import XAccount, TikTokAccount
from apps.campaigns.models import XPublication, TikTokUpload, XMetricReadBudget, PublicationAvailability
from apps.campaigns.publication_statistics import read_counters
from apps.campaigns.social_metric_readers import MetricReadUnavailable

pytestmark = pytest.mark.django_db


@pytest.fixture
def x_post(campaign, user_marketero):
    a = XAccount.objects.create(owner=user_marketero, x_user_id='42', username='test',
        encrypted_access_token='unused', encrypted_refresh_token='unused', expires_at=timezone.now() + timedelta(days=1))
    return XPublication.objects.create(campaign=campaign, account=a, x_user_id='42', username='test',
        campaign_version=1, status='published', post_id='123', caption='test', image_jpeg='')


@pytest.fixture
def allowance(user_marketero):
    return XMetricReadBudget.objects.create(owner=user_marketero, request_limit=2)


def x_response(**changes):
    data = {'id': '123', 'author_id': '42', 'public_metrics': {
        'like_count': 2, 'reply_count': 0, 'retweet_count': 1, 'quote_count': 3, 'impression_count': 9}}
    data.update(changes)
    response = Mock(status_code=200)
    response.json.return_value = {'data': data}
    return response


def test_x_exact_post_budget_and_semantics(x_post, allowance):
    with patch('apps.campaigns.social_metric_readers.x_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.get', return_value=x_response()) as get:
        assert read_counters('twitter', x_post) == {'likes': 2, 'comments': 0, 'shares': 1, 'views': 9}
        assert get.call_args.args[0] == 'https://api.x.com/2/tweets/123'
        assert get.call_args.kwargs['allow_redirects'] is False
        assert 'private' not in str(get.call_args.kwargs['params'])
    allowance.refresh_from_db()
    assert allowance.requests_reserved == 1


def test_x_no_allowance_does_not_call_paid_endpoint(x_post):
    with patch('apps.campaigns.social_metric_readers.x_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.get') as get:
        with pytest.raises(MetricReadUnavailable):
            read_counters('twitter', x_post)
        get.assert_not_called()


@pytest.mark.parametrize('status, resource, missing', [(404, '123', True), (200, '123', True), (403, '123', False), (404, '999', False)])
def test_x_requires_exact_resource_absence_not_permission_error(x_post, allowance, status, resource, missing):
    from apps.campaigns.social_metric_readers import PublicationNotFound
    response = Mock(status_code=status)
    response.json.return_value = {'errors': [{'type': 'https://api.x.com/2/problems/resource-not-found', 'resource_id': resource}]}
    if status >= 400:
        response.raise_for_status.side_effect = requests.HTTPError()
    with patch('apps.campaigns.social_metric_readers.x_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.get', return_value=response):
        with pytest.raises(PublicationNotFound if missing else requests.HTTPError):
            read_counters('twitter', x_post)


@pytest.mark.parametrize('response', [x_response(id='999'), x_response(author_id='999'), x_response(public_metrics={})])
def test_x_never_accepts_other_post_owner_or_missing_counters(x_post, allowance, response):
    with patch('apps.campaigns.social_metric_readers.x_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.get', return_value=response):
        with pytest.raises(MetricReadUnavailable):
            read_counters('twitter', x_post)
    allowance.refresh_from_db()
    assert allowance.requests_reserved == 1


def test_x_timeout_reservation_survives_and_limit_blocks_retry(api_client, x_post, allowance):
    url = f'/api/campaigns/{x_post.campaign_id}/publication-statistics/refresh/'
    with patch('apps.campaigns.social_metric_readers.x_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.get', side_effect=requests.Timeout('secret')) as get:
        for _ in range(3):
            PublicationAvailability.objects.update(checked_at=timezone.now() - timedelta(minutes=6))
            response = api_client.post(url, {'platform': 'twitter', 'publication_id': x_post.pk}, format='json')
            assert response.status_code == 503 and 'secret' not in str(response.data)
        assert get.call_count == 2
    allowance.refresh_from_db()
    assert allowance.requests_reserved == 2
    x_post.refresh_from_db()
    assert x_post.status == 'published'


def test_x_wrong_connected_identity_never_spends(x_post, allowance):
    x_post.account.x_user_id = '99'
    with patch('apps.campaigns.social_metric_readers.requests.get') as get:
        with pytest.raises(MetricReadUnavailable):
            read_counters('twitter', x_post)
        get.assert_not_called()
    allowance.refresh_from_db()
    assert allowance.requests_reserved == 0


@pytest.fixture
def tk_post(campaign, user_marketero):
    a = TikTokAccount.objects.create(owner=user_marketero, open_id='open', display_name='test',
        encrypted_access_token='unused', encrypted_refresh_token='unused', scopes=['video.list', 'video.upload'],
        expires_at=timezone.now() + timedelta(days=1), refresh_expires_at=timezone.now() + timedelta(days=30))
    return TikTokUpload.objects.create(campaign=campaign, account=a, open_id='open', display_name='test',
        campaign_version=1, status='published', publish_id='p', public_post_ids=['123'],
        caption='test', image_jpeg='', image_expires_at=timezone.now())


def test_tiktok_exact_public_id_and_zeroes(tk_post):
    response = Mock(status_code=200)
    response.json.return_value = {'error': {'code': 'ok'}, 'data': {'videos': [
        {'id': '123', 'like_count': 2, 'comment_count': 0, 'share_count': 0, 'view_count': 9}]}}
    with patch('apps.campaigns.social_metric_readers.tiktok_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.post', return_value=response) as post:
        assert read_counters('tiktok', tk_post) == {'likes': 2, 'comments': 0, 'shares': 0, 'views': 9, '_public_post_ids': ['123']}
        assert post.call_args.args[0] == 'https://open.tiktokapis.com/v2/video/query/'
        assert post.call_args.kwargs['json'] == {'filters': {'video_ids': ['123']}}
        assert post.call_args.kwargs['allow_redirects'] is False


@pytest.mark.parametrize('ids', [[], ['p'], [123], ['123', '123']])
def test_tiktok_unconfirmed_ids_never_query(tk_post, ids):
    tk_post.public_post_ids = ids
    with patch('apps.campaigns.social_metric_readers.requests.post') as post:
        with pytest.raises(MetricReadUnavailable):
            read_counters('tiktok', tk_post)
        post.assert_not_called()


def test_tiktok_missing_scope_never_queries(tk_post):
    tk_post.account.scopes = ['video.upload']
    with patch('apps.campaigns.social_metric_readers.requests.post') as post:
        with pytest.raises(MetricReadUnavailable):
            read_counters('tiktok', tk_post)
        post.assert_not_called()


@pytest.mark.parametrize('videos', [[], [{'id': '999'}], [{'id': '123', 'like_count': '2'}]])
def test_tiktok_missing_content_or_invalid_counters_are_not_zero(tk_post, videos):
    response = Mock(status_code=200)
    response.json.return_value = {'error': {'code': 'ok'}, 'data': {'videos': videos}}
    with patch('apps.campaigns.social_metric_readers.tiktok_token', return_value='private'), patch(
            'apps.campaigns.social_metric_readers.requests.post', return_value=response):
        with pytest.raises(MetricReadUnavailable):
            read_counters('tiktok', tk_post)


def test_multiple_tiktok_posts_have_correct_count_and_coverage(api_client, tk_post):
    from apps.campaigns.models import PublicationMetricSnapshot
    tk_post.public_post_ids = ['123', '456']
    tk_post.save(update_fields=['public_post_ids'])
    PublicationMetricSnapshot.objects.create(campaign=tk_post.campaign, platform='tiktok',
        publication_id=tk_post.pk, day=timezone.localdate(), metrics={'likes': 5, '_public_post_ids': ['123', '456']})
    data = api_client.get('/api/campaigns/publication-statistics/').data['data']
    assert data['platforms']['tiktok']['publications'] == 2
    assert data['platforms']['tiktok']['metrics']['likes'] == {'value': 5, 'covered': 2}
    month = timezone.localtime(tk_post.created_at).month - 1
    assert data['monthly'][month]['tiktok'] == 2
    assert data['monthly_likes'][month]['tiktok_covered'] == 2


def test_tiktok_old_snapshot_does_not_cover_a_new_public_post(api_client, tk_post):
    from apps.campaigns.models import PublicationMetricSnapshot
    PublicationMetricSnapshot.objects.create(campaign=tk_post.campaign, platform='tiktok',
        publication_id=tk_post.pk, day=timezone.localdate(), metrics={'likes': 2, '_public_post_ids': ['123']})
    tk_post.public_post_ids = ['123', '456']
    tk_post.save(update_fields=['public_post_ids'])
    data = api_client.get('/api/campaigns/publication-statistics/').data['data']['platforms']['tiktok']
    assert data['publications'] == 2 and data['metrics']['likes'] == {'value': None, 'covered': 0}
