import base64
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

import pytest
import requests
from cryptography.fernet import Fernet
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.authentication.models import InstagramAccount
from apps.campaigns.models import InstagramPublication
from apps.campaigns.instagram_publication import jpeg_image

pytestmark = pytest.mark.django_db


@patch('apps.campaigns.instagram_publication.graph')
def test_previous_success_overrides_current_failed_duplicate_without_new_write(graph, api_client, publication_setup):
    from apps.campaigns.serializers import CampaignSerializer
    campaign, account = publication_setup
    graph.side_effect = [{'id': 'container'}, {'status_code': 'FINISHED'}, {'id': '67890'}]
    publish(api_client, publication_setup)
    original = InstagramPublication.objects.get()
    campaign.version += 1
    campaign.save()
    InstagramPublication.objects.create(campaign=campaign, account=account, instagram_user_id=account.instagram_user_id,
        username=account.username, campaign_version=campaign.version, caption=original.caption,
        image_jpeg=original.image_jpeg, status='failed', image_expires_at=timezone.now())
    response = api_client.get(f'/api/campaigns/{campaign.pk}/publish-instagram/', {'account_id': account.pk})
    assert response.data['data']['status'] == 'published'
    assert publish(api_client, publication_setup).data['data']['publication_id'] == original.pk
    assert CampaignSerializer(campaign).data['publication_status']['instagram'] == 'published'
    assert graph.call_count == 3


@pytest.fixture
def publication_setup(settings, campaign, user_marketero):
    key = Fernet.generate_key()
    settings.SOCIAL_TOKEN_ENCRYPTION_KEY = key.decode()
    settings.INSTAGRAM_FRONTEND_ORIGIN = 'https://demo.example'
    output = BytesIO()
    Image.new('RGB', (400, 400), 'blue').save(output, 'PNG')
    campaign.imagen_b64 = base64.b64encode(output.getvalue()).decode()
    campaign.texto_generado = 'Copy aprobado'
    campaign.estado = 'aprobado'
    campaign.save()
    account = InstagramAccount.objects.create(owner=user_marketero, instagram_user_id='12345',
        username='demo', encrypted_token=Fernet(key).encrypt(b'test-token').decode(),
        expires_at=timezone.now() + timedelta(days=10))
    return campaign, account


def publish(client, setup, **kwargs):
    campaign, account = setup
    return client.post(f'/api/campaigns/{campaign.pk}/publish-instagram/',
        {'account_id': account.pk, 'version': campaign.version, 'confirm': True, **kwargs}, format='json')


@patch('apps.campaigns.instagram_publication.graph')
def test_instagram_uses_platform_copy(graph, api_client, publication_setup):
    campaign, account = publication_setup
    campaign.textos_por_plataforma = {'instagram': 'Versión aprobada para Instagram'}
    campaign.save()
    graph.side_effect = [{'id': 'container'}, {'status_code': 'FINISHED'}, {'id': '67890'}]
    assert publish(api_client, publication_setup).status_code == 200
    assert InstagramPublication.objects.get().caption == 'Versión aprobada para Instagram'


@patch('apps.campaigns.instagram_publication.graph')
def test_publishes_approved_snapshot_once(graph, api_client, publication_setup):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'FINISHED'}, {'id': '67890'}]
    response = publish(api_client, publication_setup)
    assert response.status_code == 200
    assert response.data['data']['status'] == 'published'
    assert publish(api_client, publication_setup).data['data']['media_id'] == '67890'
    assert graph.call_count == 3
    row = InstagramPublication.objects.get()
    assert row.caption == 'Copy aprobado'
    assert base64.b64decode(row.image_jpeg).startswith(b'\xff\xd8')
    assert 'test-token' not in str(response.data)
    status = api_client.get(f'/api/campaigns/{row.campaign_id}/publish-instagram/',
        {'account_id': publication_setup[1].pk})
    assert status.data['data']['status'] == 'published'
    assert graph.call_count == 3


@patch('apps.campaigns.instagram_publication.graph')
def test_waits_for_container_and_resumes_without_recreation(graph, api_client, publication_setup):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'IN_PROGRESS'},
                         {'status_code': 'FINISHED'}, {'id': '67890'}]
    assert publish(api_client, publication_setup).status_code == 202
    assert publish(api_client, publication_setup).data['data']['status'] == 'published'
    assert sum(call.args[1:] == ('POST', '12345/media') for call in graph.call_args_list) == 1


@patch('apps.campaigns.instagram_publication.graph')
def test_ambiguous_publish_is_never_repeated(graph, api_client, publication_setup):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'FINISHED'}, requests.Timeout()]
    assert publish(api_client, publication_setup).data['data']['status'] == 'uncertain'
    assert publish(api_client, publication_setup).data['data']['status'] == 'uncertain'
    assert graph.call_count == 3


@patch('apps.campaigns.instagram_publication.graph')
def test_validation_and_ownership_before_any_network(graph, api_client, publication_setup, cliente):
    campaign, account = publication_setup
    assert publish(api_client, publication_setup, confirm=False).status_code == 400
    assert publish(api_client, publication_setup, account_id='invalid').status_code == 400
    assert publish(api_client, publication_setup, account_id=True).status_code == 400
    assert publish(api_client, publication_setup, version=999).status_code == 409
    account.owner = cliente
    account.save()
    assert publish(api_client, publication_setup).status_code == 404
    account.owner = campaign.marketero
    account.expires_at = timezone.now() - timedelta(seconds=1)
    account.save()
    assert publish(api_client, publication_setup).status_code == 400
    campaign.estado = 'generado'
    campaign.save()
    assert publish(api_client, publication_setup).status_code == 400
    campaign.estado = 'aprobado'
    campaign.plataformas = ['facebook']
    campaign.save()
    assert publish(api_client, publication_setup).status_code == 400
    graph.assert_not_called()


def test_role_and_campaign_ownership(publication_setup, cliente):
    client = APIClient()
    assert publish(client, publication_setup).status_code == 401
    client.force_authenticate(cliente)
    assert publish(client, publication_setup).status_code == 403
    campaign, _ = publication_setup
    campaign.marketero = cliente
    campaign.save()
    client.force_authenticate(publication_setup[1].owner)
    assert publish(client, publication_setup).status_code == 404


@patch('apps.campaigns.instagram_publication.graph')
def test_rejected_container_does_not_publish(graph, api_client, publication_setup):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'ERROR'}]
    assert publish(api_client, publication_setup).data['data']['status'] == 'failed'
    assert graph.call_count == 2


@patch('apps.campaigns.instagram_publication.graph')
def test_public_image_is_only_accessible_with_unexpired_ticket(graph, api_client, publication_setup, settings):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'IN_PROGRESS'}]
    publish(api_client, publication_setup)
    row = InstagramPublication.objects.get()
    settings.ROOT_URLCONF = 'core.instagram_preview_urls'
    client = APIClient()
    url = f'/api/instagram/media/{row.image_ticket}/'
    response = client.get(url)
    assert response.status_code == 200
    assert response['Content-Type'] == 'image/jpeg'
    assert response['Cache-Control'] == 'no-store'
    assert client.get('/api/campaigns/').status_code == 404
    row.image_expires_at = timezone.now() - timedelta(seconds=1)
    row.save()
    assert client.get(url).status_code == 404


def test_bad_and_incompatible_images_are_rejected():
    with pytest.raises(ValueError):
        jpeg_image('not base64')
    output = BytesIO()
    Image.new('RGB', (100, 1000)).save(output, 'PNG')
    with pytest.raises(ValueError, match='proporción'):
        jpeg_image(base64.b64encode(output.getvalue()).decode())


@patch('apps.campaigns.instagram_publication.graph')
def test_disconnect_reconnect_does_not_allow_duplicate(graph, api_client, publication_setup):
    graph.side_effect = [{'id': 'container'}, {'status_code': 'FINISHED'}, {'id': '67890'}]
    publish(api_client, publication_setup)
    campaign, account = publication_setup
    account_id, username, encrypted = account.instagram_user_id, account.username, account.encrypted_token
    assert api_client.delete(f'/api/auth/instagram/accounts/{account.pk}/').status_code == 200
    replacement = InstagramAccount.objects.create(owner=campaign.marketero, instagram_user_id=account_id,
        username=username, encrypted_token=encrypted, expires_at=timezone.now() + timedelta(days=1))
    assert publish(api_client, (campaign, replacement)).data['data']['status'] == 'published'
    assert graph.call_count == 3
