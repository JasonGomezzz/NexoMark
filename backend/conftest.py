"""
Fixtures compartidas para todos los tests de MarketMind IA.
"""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignPlataforma, CampaignStatus, CampaignTono


@pytest.fixture(autouse=True)
def clear_cache():
    """Limpia la cache antes de cada test para evitar contaminación de throttle."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user_marketero(db) -> User:
    user = User.objects.create_user(
        email="marketero@test.com",
        password="Test1234!",
        nombre="Marketero Test",
        rol=UserRole.MARKETERO,
    )
    user.tokens_disponibles = 10
    user.save(update_fields=["tokens_disponibles"])
    return user


@pytest.fixture
def superadmin(db) -> User:
    return User.objects.create_user(
        email="admin@test.com",
        password="Admin1234!",
        nombre="Super Admin",
        rol=UserRole.SUPERADMIN,
    )


@pytest.fixture
def cliente(db) -> User:
    return User.objects.create_user(
        email="cliente@test.com",
        password="Test1234!",
        nombre="Cliente Test",
        rol=UserRole.CLIENTE,
    )


@pytest.fixture
def api_client(user_marketero) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user_marketero)
    return client


@pytest.fixture
def superadmin_client(superadmin) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=superadmin)
    return client


@pytest.fixture
def campaign(db, user_marketero) -> Campaign:
    return Campaign.objects.create(
        titulo="Campaña Test",
        cliente_nombre="Cliente Test SA",
        industria="tecnología",
        tono=CampaignTono.PROFESIONAL,
        plataforma=CampaignPlataforma.INSTAGRAM,
        prompt="Crea una campaña para tecnología",
        estado=CampaignStatus.BORRADOR,
        marketero=user_marketero,
    )


@pytest.fixture
def campaign_generada(db, user_marketero) -> Campaign:
    return Campaign.objects.create(
        titulo="Campaña Generada",
        cliente_nombre="Cliente SA",
        industria="retail",
        tono=CampaignTono.CASUAL,
        plataforma=CampaignPlataforma.FACEBOOK,
        prompt="Campaña retail",
        estado=CampaignStatus.GENERADO,
        texto_generado="Copy generado de prueba.",
        marketero=user_marketero,
    )


@pytest.fixture
def campaign_pendiente_ia(db, user_marketero) -> Campaign:
    return Campaign.objects.create(
        titulo="Campaña Pendiente IA",
        cliente_nombre="Cliente SA",
        industria="salud",
        tono=CampaignTono.PROFESIONAL,
        plataforma=CampaignPlataforma.INSTAGRAM,
        prompt="Campaña salud",
        estado=CampaignStatus.PENDIENTE_IA,
        tokens_consumidos=1,
        marketero=user_marketero,
    )
