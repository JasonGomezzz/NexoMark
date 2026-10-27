from unittest.mock import Mock, patch
import requests
import pytest
from apps.campaigns.facebook_insights import lifetime_value, optional_insight


@pytest.mark.parametrize('body', [{}, {'data': []}, {'data': [{'name': 'other', 'period': 'lifetime', 'values': [{'value': 99}]}]},
    {'data': [{'name': 'post_media_view', 'period': 'day', 'values': [{'value': 99}]}]}])
def test_insights_missing_wrong_metric_or_daily_data_never_becomes_zero(body):
    assert lifetime_value(body, 'post_media_view') is None


@pytest.mark.parametrize('value', [0, 10])
def test_exact_lifetime_counter(value):
    response = Mock()
    response.json.return_value = {'data': [{'name': 'post_media_view', 'period': 'lifetime', 'values': [{'value': value}]}]}
    with patch('apps.campaigns.facebook_insights.requests.get', return_value=response) as get:
        assert optional_insight('https://graph.facebook.com/v24.0/123', 'private', 'post_media_view') == value
        assert get.call_args.kwargs['allow_redirects'] is False


def test_optional_insight_failure_does_not_remove_primary_like_measurement():
    with patch('apps.campaigns.facebook_insights.requests.get', side_effect=requests.Timeout('private')):
        assert optional_insight('https://graph.facebook.com/v24.0/123', 'private', 'post_media_view') is None
