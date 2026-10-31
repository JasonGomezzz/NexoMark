import base64
from datetime import timedelta
from io import BytesIO
from unittest.mock import Mock, patch

import pytest
import requests
from cryptography.fernet import Fernet
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.authentication.models import FacebookPage
from apps.campaigns.facebook_publication import jpeg_image, send_photo
from apps.campaigns.models import FacebookPublication

pytestmark = pytest.mark.django_db


@patch('apps.campaigns.facebook_publication.send_photo', return_value=('987654', '123456_987654'))
def test_same_content_cannot_be_republished_after_revision_change(send, api_client, fb_publication):
    from apps.campaigns.serializers import CampaignSerializer
    campaign, page = fb_publication
    assert publish(api_client, fb_publication).data['data']['status'] == 'published'
    original = FacebookPublication.objects.get()
    campaign.version += 1
    campaign.save()
    for response in [api_client.get(f'/api/campaigns/{campaign.pk}/publish-facebook/', {'page_id': page.pk}),
                     publish(api_client, fb_publication)]:
        assert response.data['data']['status'] == 'published'
        assert response.data['data']['publication_id'] == original.pk
        assert response.data['data']['previous_version'] is True
    assert CampaignSerializer(campaign).data['publication_status']['facebook'] == 'published'
    assert FacebookPublication.objects.count() == 1
    send.assert_called_once()


@patch('apps.campaigns.facebook_publication.send_photo', return_value=('987654', '123456_987654'))
def test_new_approved_content_warns_and_requires_new_explicit_post(send, api_client, fb_publication):
    campaign, page = fb_publication
    publish(api_client, fb_publication)
    campaign.version += 1
    campaign.texto_generado = 'Otro contenido aprobado'
    campaign.save()
    response = api_client.get(f'/api/campaigns/{campaign.pk}/publish-facebook/', {'page_id': page.pk})
    assert response.data['data'] == {'status': 'not_published', 'has_previous_publication': True}
    assert FacebookPublication.objects.count() == 1
    assert publish(api_client, fb_publication).data['data']['status'] == 'published'
    assert send.call_count == 2


@pytest.fixture
def fb_publication(settings, campaign, user_marketero):
    key = Fernet.generate_key()
    settings.SOCIAL_TOKEN_ENCRYPTION_KEY = key.decode()
    settings.FACEBOOK_APP_ID = '123'
    settings.FACEBOOK_APP_SECRET = 'private-secret'
    settings.FACEBOOK_REDIRECT_URI = 'https://demo.example/api/auth/facebook/callback/'
    settings.FACEBOOK_GRAPH_VERSION = 'v23.0'
    output = BytesIO()
    Image.new('RGB', (400, 400), 'blue').save(output, 'PNG')
    campaign.imagen_b64 = base64.b64encode(output.getvalue()).decode()
    campaign.texto_generado = 'Copy aprobado'
    campaign.estado = 'aprobado'
    campaign.plataformas = ['facebook', 'instagram']
    campaign.save()
    page = FacebookPage.objects.create(owner=user_marketero, facebook_page_id='123456', name='Aroma Andino',
        encrypted_token=Fernet(key).encrypt(b'private-token').decode(), expires_at=timezone.now() + timedelta(days=10))
    return campaign, page


def publish(client, setup, **extra):
    campaign, page = setup
    return client.post(f'/api/campaigns/{campaign.pk}/publish-facebook/',
        {'page_id': page.pk, 'version': campaign.version, 'confirm': True, **extra}, format='json')


@patch('apps.campaigns.facebook_publication.send_photo', return_value=('987654', '123456_987654'))
def test_facebook_uses_platform_copy(send, api_client, fb_publication):
    campaign, page = fb_publication
    campaign.textos_por_plataforma = {'facebook': 'Versión aprobada para Facebook', 'instagram': 'Otra versión'}
    campaign.save()
    assert publish(api_client, fb_publication).status_code == 200
    assert FacebookPublication.objects.get().caption == 'Versión aprobada para Facebook'


@patch('apps.campaigns.facebook_publication.send_photo')
def test_browser_detail_provides_read_only_version_for_publication(send, api_client, fb_publication):
    from apps.campaigns.serializers import CampaignSerializer
    campaign, page = fb_publication
    campaign.version = 2
    campaign.save()
    detail = api_client.get(f'/api/campaigns/{campaign.pk}/')
    assert detail.status_code == 200
    serialized = detail.data['data']['campaign']
    assert serialized['version'] == 2 and isinstance(serialized['version'], int)
    assert CampaignSerializer().fields['version'].read_only
    send.return_value = ('987654', '')
    response = api_client.post(f'/api/campaigns/{campaign.pk}/publish-facebook/',
        {'page_id': page.pk, 'version': serialized['version'], 'confirm': True}, format='json')
    assert response.status_code == 200 and response.data['data']['status'] == 'published'
    send.assert_called_once()


@patch('apps.campaigns.facebook_publication.send_photo')
def test_saved_approved_content_only_and_duplicate_protection(send, api_client, fb_publication):
    def once(publication, token):
        assert FacebookPublication.objects.get(pk=publication.pk).status == 'publishing'
        assert publication.caption == 'Copy aprobado' and token == 'private-token'
        assert base64.b64decode(publication.image_jpeg).startswith(b'\xff\xd8')
        return '987654', '123456_987654'
    send.side_effect = once
    response = publish(api_client, fb_publication, caption='Unapproved draft', imagen_b64='bad')
    assert response.status_code == 200 and response.data['data']['status'] == 'published'
    assert response.data['data']['publication_url'] == 'https://www.facebook.com/photo.php?fbid=987654'
    assert 'private-token' not in str(response.data)
    assert publish(api_client, fb_publication).data['data']['status'] == 'published'
    campaign, page = fb_publication
    status = api_client.get(f'/api/campaigns/{campaign.pk}/publish-facebook/', {'page_id': page.pk})
    assert status.data['data']['photo_id'] == '987654'
    assert send.call_count == 1


@patch('apps.campaigns.facebook_publication.send_photo')
def test_uncertain_result_is_never_resent(send, api_client, fb_publication):
    send.side_effect = requests.Timeout('secret-bearing-error')
    result = publish(api_client, fb_publication)
    assert result.data['data']['status'] == 'uncertain'
    assert 'secret-bearing-error' not in str(result.data)
    assert publish(api_client, fb_publication).data['data']['status'] == 'uncertain'
    assert send.call_count == 1


@patch('apps.campaigns.facebook_publication.send_photo')
def test_inflight_or_crashed_attempt_not_sent_again(send, api_client, fb_publication):
    campaign, page = fb_publication
    FacebookPublication.objects.create(campaign=campaign, page=page, facebook_page_id=page.facebook_page_id,
        page_name=page.name, campaign_version=campaign.version, caption='Snapshot', image_jpeg='snapshot')
    assert publish(api_client, fb_publication).status_code == 202
    assert publish(api_client, fb_publication).data['data']['status'] == 'publishing'
    send.assert_not_called()


@patch('apps.campaigns.facebook_publication.send_photo')
def test_validation_before_external_write(send, api_client, fb_publication, cliente, settings):
    campaign, page = fb_publication
    assert publish(api_client, fb_publication, confirm=False).status_code == 400
    assert publish(api_client, fb_publication, page_id=True).status_code == 400
    assert publish(api_client, fb_publication, page_id='invalid').status_code == 400
    assert publish(api_client, fb_publication, version=True).status_code == 409
    assert publish(api_client, fb_publication, version=999).status_code == 409
    page.owner = cliente
    page.save()
    assert publish(api_client, fb_publication).status_code == 404
    page.owner = campaign.marketero
    page.expires_at = timezone.now() - timedelta(seconds=1)
    page.save()
    assert publish(api_client, fb_publication).status_code == 400
    page.expires_at = timezone.now() + timedelta(days=1)
    page.encrypted_token = 'invalid'
    page.save()
    assert publish(api_client, fb_publication).status_code == 400
    campaign.estado = 'generado'
    campaign.save()
    assert publish(api_client, fb_publication).status_code == 400
    campaign.estado = 'aprobado'
    campaign.plataformas = ['instagram']
    campaign.save()
    assert publish(api_client, fb_publication).status_code == 400
    campaign.plataformas = ['facebook']
    campaign.save()
    settings.FACEBOOK_APP_SECRET = ''
    assert publish(api_client, fb_publication).status_code == 503
    assert not FacebookPublication.objects.exists()
    send.assert_not_called()


@pytest.mark.parametrize('updates', [{'texto_generado': ''}, {'texto_generado': 'x' * 60001}, {'imagen_b64': 'invalid'}])
@patch('apps.campaigns.facebook_publication.send_photo')
def test_invalid_copy_or_image_blocked(send, api_client, fb_publication, updates):
    campaign, _ = fb_publication
    for key, value in updates.items():
        setattr(campaign, key, value)
    campaign.save()
    assert publish(api_client, fb_publication).status_code == 400
    assert not FacebookPublication.objects.exists()
    send.assert_not_called()


def test_role_and_campaign_owner_and_read_only_get(api_client, fb_publication, cliente):
    assert publish(APIClient(), fb_publication).status_code == 401
    client = APIClient()
    client.force_authenticate(cliente)
    assert publish(client, fb_publication).status_code == 403
    campaign, page = fb_publication
    assert api_client.get(f'/api/campaigns/{campaign.pk}/publish-facebook/', {'page_id': page.pk}).data['data']['status'] == 'not_published'
    assert not FacebookPublication.objects.exists()
    campaign.marketero = cliente
    campaign.save()
    assert publish(api_client, fb_publication).status_code == 404


@patch('apps.campaigns.facebook_publication.send_photo')
def test_disconnect_reconnect_same_page_cannot_duplicate(send, api_client, fb_publication):
    send.return_value = ('987654', '')
    publish(api_client, fb_publication)
    campaign, page = fb_publication
    page_id, name, encrypted = page.facebook_page_id, page.name, page.encrypted_token
    assert api_client.delete(f'/api/auth/facebook/pages/{page.pk}/').status_code == 200
    replacement = FacebookPage.objects.create(owner=campaign.marketero, facebook_page_id=page_id,
        name=name, encrypted_token=encrypted, expires_at=timezone.now() + timedelta(days=1))
    assert publish(api_client, (campaign, replacement)).data['data']['status'] == 'published'
    assert send.call_count == 1


@patch('apps.campaigns.facebook_publication.requests.post')
def test_multipart_photo_and_caption_sent_to_page_with_bearer(post, api_client, fb_publication):
    post.return_value = Mock(status_code=200, json=lambda: {'id': '987654', 'post_id': '123456_987654'})
    assert publish(api_client, fb_publication).data['data']['status'] == 'published'
    call = post.call_args
    assert call.args[0] == 'https://graph.facebook.com/v23.0/123456/photos'
    assert call.kwargs['headers'] == {'Authorization': 'Bearer private-token'}
    assert call.kwargs['data'] == {'caption': 'Copy aprobado', 'published': 'true'}
    assert call.kwargs['files']['source'][1].startswith(b'\xff\xd8')
    assert call.kwargs['allow_redirects'] is False


@pytest.mark.parametrize('response', [{}, {'error': {'message': 'private-token'}}, {'id': 'unsafe-id'}])
@patch('apps.campaigns.facebook_publication.requests.post')
def test_bad_upstream_result_is_not_retried(post, api_client, fb_publication, response):
    post.return_value = Mock(status_code=200, json=lambda: response)
    result = publish(api_client, fb_publication)
    assert result.data['data']['status'] == 'uncertain'
    assert 'private-token' not in str(result.data)
    assert publish(api_client, fb_publication).data['data']['status'] == 'uncertain'
    assert post.call_count == 1


def test_facebook_image_does_not_inherit_instagram_aspect_ratio_limit():
    output = BytesIO()
    Image.new('RGB', (100, 1000)).save(output, 'PNG')
    encoded = base64.b64encode(output.getvalue()).decode()
    with Image.open(BytesIO(base64.b64decode(jpeg_image(encoded)))) as image:
        assert image.width == 100 and image.height == 1000
    with pytest.raises(ValueError):
        jpeg_image('bad')
    with pytest.raises(ValueError):
        jpeg_image(None)


def test_public_bridge_does_not_expose_publish_endpoint(api_client, fb_publication, settings):
    settings.ROOT_URLCONF = 'core.instagram_preview_urls'
    assert publish(api_client, fb_publication).status_code == 404
