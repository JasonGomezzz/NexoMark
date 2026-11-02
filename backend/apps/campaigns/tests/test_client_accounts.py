import pytest
from rest_framework.test import APIClient
from apps.authentication.models import User
from apps.campaigns.models import ClientRelationship


@pytest.mark.django_db
def test_freelance_quota_and_release(api_client, user_marketero):
    user_marketero.plan_key = 'basico'
    user_marketero.save()
    clients = [User.objects.create_user(email=f'client{i}@example.com', password='Test1234!', nombre=f'Cliente {i}', rol='cliente') for i in range(6)]
    for client in clients[:5]:
        assert api_client.post('/api/campaigns/clients/', {'email': client.email}).status_code == 201
    assert api_client.post('/api/campaigns/clients/', {'email': clients[5].email}).status_code == 400
    relation = ClientRelationship.objects.get(marketero=user_marketero, cliente=clients[0])
    assert api_client.patch(f'/api/campaigns/clients/{relation.pk}/', {'active': False}, format='json').status_code == 200
    clients[0].refresh_from_db()
    assert clients[0].is_active
    assert api_client.post('/api/campaigns/clients/', {'email': clients[5].email}).status_code == 201
    assert api_client.patch(f'/api/campaigns/clients/{relation.pk}/', {'active': True}, format='json').status_code == 400


@pytest.mark.django_db
def test_other_owner_cannot_modify(api_client, user_marketero, cliente, superadmin):
    relation = ClientRelationship.objects.create(marketero=superadmin, cliente=cliente)
    assert api_client.patch(f'/api/campaigns/clients/{relation.pk}/', {'active': False}, format='json').status_code == 404
    assert api_client.get('/api/campaigns/clients/').data['clients'] == []


@pytest.mark.django_db
def test_client_role_denied(cliente):
    client = APIClient()
    client.force_authenticate(cliente)
    assert client.get('/api/campaigns/clients/').status_code == 403


@pytest.mark.django_db
def test_duplicate_client_is_one_slot(api_client, user_marketero, cliente):
    for _ in range(2):
        assert api_client.post('/api/campaigns/clients/', {'email': cliente.email}).status_code == 201
    assert api_client.get('/api/campaigns/clients/').data['active_count'] == 1
