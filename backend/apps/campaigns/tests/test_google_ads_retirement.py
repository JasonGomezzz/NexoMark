from unittest.mock import patch

import pytest

from apps.campaigns.models import Campaign
from services.n8n_service import trigger_ia_generation
from services.platform_copy_service import adapt_platform_copies

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize('selection', [
    {'plataforma': 'google_ads'},
    {'plataformas': ['facebook', 'google_ads']},
    {'plataforma': 'google_ads', 'plataformas': ['instagram']},
])
def test_creation_rejects_retired_channel_without_charging(api_client, user_marketero, selection):
    payload = dict(titulo='Nueva campaña', cliente_nombre='Negocio', cliente_email='cliente@test.com',
                   industria='retail', tono='profesional', prompt='Dar a conocer el negocio', **selection)
    before = Campaign.objects.count()
    credits = user_marketero.tokens_disponibles
    response = api_client.post('/api/campaigns/', payload, format='json')
    assert response.status_code == 400
    assert 'plataformas' in response.data['data']['errors']
    assert Campaign.objects.count() == before
    user_marketero.refresh_from_db()
    assert user_marketero.tokens_disponibles == credits


@pytest.mark.parametrize('action,state', [('generate', 'borrador'), ('regenerate', 'rechazado')])
def test_historical_generation_is_blocked_without_mutation(api_client, campaign, action, state):
    campaign.plataforma = 'google_ads'
    campaign.plataformas = ['google_ads']
    campaign.estado = state
    campaign.texto_generado = 'Contenido histórico'
    campaign.save()
    credits = campaign.marketero.tokens_disponibles
    assert api_client.get(f'/api/campaigns/{campaign.pk}/').status_code == 200
    with patch('services.n8n_service.requests.post') as network:
        response = api_client.post(f'/api/campaigns/{campaign.pk}/{action}/')
        assert response.status_code == 400
        assert trigger_ia_generation(campaign)['dispatched'] is False
        with pytest.raises(ValueError, match='retirado'):
            adapt_platform_copies(campaign)
        network.assert_not_called()
    campaign.refresh_from_db()
    campaign.marketero.refresh_from_db()
    assert campaign.estado == state
    assert campaign.texto_generado == 'Contenido histórico'
    assert campaign.marketero.tokens_disponibles == credits
    assert campaign.intentos_generacion == 0


def test_statistics_only_include_the_four_active_social_platforms(api_client):
    data = api_client.get('/api/campaigns/publication-statistics/').data['data']
    assert set(data['platforms']) == {'facebook', 'instagram', 'twitter', 'tiktok'}
    assert 'Google Ads' not in data['note']
    for row in [*data['monthly'], *data['monthly_likes']]:
        assert 'google_ads' not in row
