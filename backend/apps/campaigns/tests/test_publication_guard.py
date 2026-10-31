import base64
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image
from django.utils import timezone

from apps.campaigns.models import (FacebookPublication, InstagramPublication, XPublication,
                                  TikTokUpload, PublicationAvailability)
from apps.campaigns.publication_guard import existing_content, publication_feedback, instagram_permalink
from apps.campaigns.facebook_publication import jpeg_image as facebook_image
from apps.campaigns.instagram_publication import jpeg_image as instagram_image
from apps.campaigns.tiktok_publication import tiktok_jpeg

pytestmark = pytest.mark.django_db


def picture(color):
    output = BytesIO()
    Image.new('RGB', (400, 400), color).save(output, 'PNG')
    return base64.b64encode(output.getvalue()).decode()


@pytest.fixture(params=['facebook', 'instagram', 'twitter', 'tiktok'])
def guard(request, campaign):
    platform = request.param
    model, identity, attributes, prepare = {
        'facebook': (FacebookPublication, 'facebook_page_id', {'page_name': 'Demo'}, facebook_image),
        'instagram': (InstagramPublication, 'instagram_user_id', {'username': 'demo', 'image_expires_at': timezone.now()}, instagram_image),
        'twitter': (XPublication, 'x_user_id', {'username': 'demo'}, facebook_image),
        'tiktok': (TikTokUpload, 'open_id', {'display_name': 'Demo', 'image_expires_at': timezone.now()}, tiktok_jpeg),
    }[platform]
    campaign.imagen_b64 = picture('blue')
    campaign.version = 2
    campaign.save()
    original = model.objects.create(campaign=campaign, **{identity: '123'}, **attributes,
        campaign_version=1, caption='Aprobado', image_jpeg=prepare(campaign.imagen_b64), status='published')
    def find(caption='Aprobado', destination='123'):
        return existing_content(model.objects.filter(campaign=campaign, **{identity: destination}),
                                campaign, platform, caption, prepare)
    return campaign, original, find, platform, model, identity, attributes, prepare


def test_identical_content_reuses_prior_version_without_network(guard):
    campaign, original, find, platform, *_ = guard
    with patch('requests.post') as send, patch('requests.get') as read:
        assert find().pk == original.pk
        send.assert_not_called()
        read.assert_not_called()
    feedback = publication_feedback(original, platform, campaign)
    assert feedback['status'] == 'published'
    assert feedback['previous_version'] is True
    assert feedback['publication_version'] == 1


def test_new_content_or_new_destination_is_not_mistaken_for_existing_post(guard):
    campaign, original, find, *_ = guard
    assert find(caption='Contenido nuevo aprobado') is None
    assert find(destination='456') is None
    campaign.imagen_b64 = picture('red')
    assert find() is None


def test_prior_success_wins_over_failed_or_removed_current_duplicate(guard):
    campaign, original, find, platform, model, identity, attrs, _ = guard
    duplicate = model.objects.create(campaign=campaign, **{identity: '123'}, **attrs,
        campaign_version=2, caption=original.caption, image_jpeg=original.image_jpeg, status='failed')
    assert find().pk == original.pk
    duplicate.status = 'published'
    duplicate.save()
    PublicationAvailability.objects.create(campaign=campaign, platform=platform,
        publication_id=duplicate.pk, state='removed', note='Eliminación informada por el propietario.')
    assert find().pk == original.pk
    assert model.objects.count() == 2


def test_missing_post_never_becomes_permission_to_resend(guard):
    campaign, original, find, platform, *_ = guard
    PublicationAvailability.objects.create(campaign=campaign, platform=platform,
        publication_id=original.pk, state='unavailable')
    assert find().pk == original.pk
    assert publication_feedback(find(), platform, campaign)['status'] == 'unavailable'


def test_unresolved_previous_attempt_blocks_even_changed_content(guard):
    campaign, original, find, platform, *_ = guard
    original.status = 'uncertain'
    original.save()
    campaign.imagen_b64 = picture('red')
    assert find(caption='Texto nuevo').pk == original.pk
    assert publication_feedback(original, platform, campaign)['status'] == 'pending_previous'


@pytest.mark.parametrize('value', ['http://www.instagram.com/p/abc/', 'https://evil.example/p/abc/',
    'https://www.instagram.com.evil/p/abc/', 'https://user:pass@www.instagram.com/p/abc/', None])
def test_permalink_only_accepts_exact_instagram_destination(value):
    assert instagram_permalink(value) == ''


def test_permalink_ignores_tracking_parameters():
    assert instagram_permalink('https://www.instagram.com/p/abc_12/?utm_source=x') == 'https://www.instagram.com/p/abc_12/'
