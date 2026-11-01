"""Tests de CampaignViewSet: create, list, retrieve, generate, submit, stats."""

import pytest
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.campaigns.models import (
    Campaign,
    CampaignPlataforma,
    CampaignStatus,
    CampaignTono,
    CampaignVersion,
)

CAMPAIGNS_URL = "/api/campaigns/"
STATS_URL = "/api/campaigns/stats/"
CREDITS_DETAIL_URL = "/api/campaigns/credits-detail/"
CREDITS_PURCHASE_URL = "/api/campaigns/credits/purchase/"
RECENT_APPROVED_URL = "/api/campaigns/recent-approved/"


def campaign_url(pk: int) -> str:
    return f"/api/campaigns/{pk}/"


def generate_url(pk: int) -> str:
    return f"/api/campaigns/{pk}/generate/"


def submit_url(pk: int) -> str:
    return f"/api/campaigns/{pk}/submit/"


def regenerate_url(pk: int) -> str:
    return f"/api/campaigns/{pk}/regenerate/"


VALID_PAYLOAD = {
    "titulo": "Nueva Campaña",
    "cliente_nombre": "Cliente Test",
    "cliente_email": "cliente@test.com",
    "industria": "tecnologia",
    "tono": "profesional",
    "plataforma": "instagram",
    "prompt": "Crea una campaña epica para tecnologia.",
}


@pytest.mark.django_db
class TestCampaignCreate:
    @pytest.fixture(autouse=True)
    def registered_cliente(self, cliente):
        self.cliente = cliente

    def test_marketero_creates_campaign_202(self, api_client, user_marketero):
        response = api_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 202
        assert response.data["success"] is True

    def test_create_requires_registered_cliente_email(self, api_client):
        payload = {**VALID_PAYLOAD, "cliente_email": "noexiste@test.com"}
        response = api_client.post(CAMPAIGNS_URL, payload, format="json")
        assert response.status_code == 400
        assert "cliente_email" in response.data["data"]["errors"]

    def test_create_allows_free_cliente_name(self, api_client):
        """El nombre del cliente es libre (nombre de negocio/marca); la
        identidad se valida solo por email. Un nombre distinto al de la cuenta
        registrada es válido mientras el email pertenezca a un cliente."""
        payload = {**VALID_PAYLOAD, "cliente_nombre": "Gimnasio Mega Force"}
        response = api_client.post(CAMPAIGNS_URL, payload, format="json")
        assert response.status_code == 202
        assert response.data["data"]["campaign"]["cliente_nombre"] == "Gimnasio Mega Force"

    def test_create_accepts_multiple_platforms(self, api_client):
        payload = {
            **VALID_PAYLOAD,
            "plataformas": ["instagram", "facebook", "twitter"],
        }
        payload.pop("plataforma")

        response = api_client.post(CAMPAIGNS_URL, payload, format="json")

        assert response.status_code == 202
        campaign = response.data["data"]["campaign"]
        assert campaign["plataformas"] == ["instagram", "facebook", "twitter"]
        assert campaign["plataforma"] == "instagram"

    @pytest.mark.parametrize("selection", [
        {"plataforma": "linkedin"},
        {"plataformas": ["instagram", "linkedin"]},
        {"plataforma": "linkedin", "plataformas": ["instagram"]},
    ])
    def test_create_rejects_retired_linkedin(self, api_client, selection):
        payload = {**VALID_PAYLOAD, **selection}
        before = Campaign.objects.count()
        response = api_client.post(CAMPAIGNS_URL, payload, format="json")
        assert response.status_code == 400
        assert "plataformas" in response.data["data"]["errors"]
        assert Campaign.objects.count() == before

    def test_legacy_linkedin_campaign_remains_readable(self, api_client, campaign):
        campaign.plataforma = CampaignPlataforma.LINKEDIN
        campaign.plataformas = ["linkedin"]
        campaign.save()
        response = api_client.get(campaign_url(campaign.pk))
        assert response.status_code == 200
        assert response.data["data"]["campaign"]["plataformas"] == ["linkedin"]

    def test_create_requires_at_least_one_platform(self, api_client):
        payload = {**VALID_PAYLOAD, "plataformas": []}
        payload.pop("plataforma")

        response = api_client.post(CAMPAIGNS_URL, payload, format="json")

        assert response.status_code == 400
        assert "plataformas" in response.data["data"]["errors"]

    def test_create_rejects_unregistered_cliente_email(self, api_client):
        """El email SÍ debe pertenecer a un cliente registrado."""
        payload = {**VALID_PAYLOAD, "cliente_email": "noexiste@ejemplo.com"}
        response = api_client.post(CAMPAIGNS_URL, payload, format="json")
        assert response.status_code == 400
        assert "cliente_email" in response.data["data"]["errors"]

    def test_create_with_mock_ai_saves_copy(self, api_client):
        response = api_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 202
        campaign_data = response.data["data"]["campaign"]
        assert campaign_data["texto_generado"] != ""
        assert "[MOCK]" in campaign_data["texto_generado"]

    def test_create_with_mock_ai_saves_initial_version(self, api_client):
        response = api_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 202
        campaign_id = response.data["data"]["campaign"]["id"]
        versions = CampaignVersion.objects.filter(campaign_id=campaign_id)
        assert versions.count() == 1
        assert "[MOCK]" in versions.first().texto_generado

    def test_create_decrements_tokens(self, api_client, user_marketero):
        initial_tokens = user_marketero.tokens_disponibles
        api_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == initial_tokens - 1

    def test_non_marketero_gets_403(self, cliente):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 403

    def test_superadmin_gets_403(self, superadmin_client):
        response = superadmin_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 403

    def test_no_tokens_returns_402(self, user_marketero, api_client):
        user_marketero.tokens_disponibles = 0
        user_marketero.save()
        response = api_client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 402
        assert response.data["success"] is False

    def test_missing_required_fields_400(self, api_client):
        response = api_client.post(CAMPAIGNS_URL, {}, format="json")
        assert response.status_code == 400

    def test_unauthenticated_gets_401(self):
        client = APIClient()
        response = client.post(CAMPAIGNS_URL, VALID_PAYLOAD, format="json")
        assert response.status_code == 401


@pytest.mark.django_db
class TestCampaignList:
    def test_marketero_sees_own_campaigns(self, api_client, campaign, db, user_marketero):
        response = api_client.get(CAMPAIGNS_URL)
        assert response.status_code == 200
        ids = [c["id"] for c in response.data["results"]]
        assert campaign.id in ids

    def test_marketero_does_not_see_others(self, api_client, db):
        other_user = User.objects.create_user(
            email="other@test.com",
            password="Test1234!",
            nombre="Other",
            rol=UserRole.MARKETERO,
        )
        other_campaign = Campaign.objects.create(
            titulo="Other Campaign",
            cliente_nombre="Other",
            industria="tech",
            tono=CampaignTono.PROFESIONAL,
            plataforma=CampaignPlataforma.INSTAGRAM,
            prompt="other",
            marketero=other_user,
        )
        response = api_client.get(CAMPAIGNS_URL)
        ids = [c["id"] for c in response.data["results"]]
        assert other_campaign.id not in ids


@pytest.mark.django_db
class TestCampaignRetrieve:
    def test_get_own_campaign(self, api_client, campaign):
        response = api_client.get(campaign_url(campaign.pk))
        assert response.status_code == 200
        assert response.data["data"]["campaign"]["id"] == campaign.id

    def test_unauthenticated_gets_401(self, campaign):
        client = APIClient()
        response = client.get(campaign_url(campaign.pk))
        assert response.status_code == 401


@pytest.mark.django_db
class TestCampaignDelete:
    def test_delete_borrador_returns_204(self, api_client, campaign):
        response = api_client.delete(campaign_url(campaign.pk))
        assert response.status_code == 204
        assert not Campaign.objects.filter(pk=campaign.pk).exists()

    def test_delete_generado_returns_204(self, api_client, campaign_generada):
        response = api_client.delete(campaign_url(campaign_generada.pk))
        assert response.status_code == 204
        assert not Campaign.objects.filter(pk=campaign_generada.pk).exists()

    def test_delete_pendiente_ia_returns_409(self, api_client, campaign_pendiente_ia):
        response = api_client.delete(campaign_url(campaign_pendiente_ia.pk))
        assert response.status_code == 409
        assert Campaign.objects.filter(pk=campaign_pendiente_ia.pk).exists()

    def test_delete_pendiente_aprobacion_returns_409(self, api_client, campaign_generada):
        campaign_generada.estado = CampaignStatus.PENDIENTE_APROBACION
        campaign_generada.save(update_fields=["estado"])
        response = api_client.delete(campaign_url(campaign_generada.pk))
        assert response.status_code == 409
        assert Campaign.objects.filter(pk=campaign_generada.pk).exists()


@pytest.mark.django_db
class TestCampaignGenerate:
    def test_generate_borrador_returns_202(self, api_client, campaign):
        response = api_client.post(generate_url(campaign.pk))
        assert response.status_code == 202

    def test_generate_state_becomes_generado(self, api_client, campaign):
        api_client.post(generate_url(campaign.pk))
        campaign.refresh_from_db()
        assert campaign.estado == CampaignStatus.GENERADO

    def test_generate_wrong_state_returns_409(self, api_client, campaign_generada):
        response = api_client.post(generate_url(campaign_generada.pk))
        assert response.status_code == 409

    def test_generate_no_tokens_returns_402(self, api_client, user_marketero, campaign):
        user_marketero.tokens_disponibles = 0
        user_marketero.save()
        response = api_client.post(generate_url(campaign.pk))
        assert response.status_code == 402

    def test_generate_non_marketero_403(self, cliente, campaign):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(generate_url(campaign.pk))
        assert response.status_code == 403


@pytest.mark.django_db
class TestCampaignRegenerate:
    def test_regenerate_borrador_returns_202(self, api_client, campaign):
        response = api_client.post(regenerate_url(campaign.pk))
        assert response.status_code == 202

    def test_regenerate_rechazado_returns_202(self, api_client, campaign):
        campaign.estado = CampaignStatus.RECHAZADO
        campaign.save(update_fields=["estado"])
        response = api_client.post(regenerate_url(campaign.pk))
        assert response.status_code == 202
        campaign.refresh_from_db()
        # Con mock IA la campaña termina en 'generado'; sin mock quedaría
        # en 'pendiente_ia'. Lo importante: salió de 'rechazado'.
        assert campaign.estado != CampaignStatus.RECHAZADO

    def test_regenerate_rechazado_sin_tokens_402_no_muta_estado(
        self, api_client, user_marketero, campaign
    ):
        campaign.estado = CampaignStatus.RECHAZADO
        campaign.save(update_fields=["estado"])
        user_marketero.tokens_disponibles = 0
        user_marketero.save()
        response = api_client.post(regenerate_url(campaign.pk))
        assert response.status_code == 402
        campaign.refresh_from_db()
        assert campaign.estado == CampaignStatus.RECHAZADO

    def test_regenerate_wrong_state_returns_409(self, api_client, campaign_generada):
        response = api_client.post(regenerate_url(campaign_generada.pk))
        assert response.status_code == 409

    def test_regenerate_non_marketero_403(self, cliente, campaign):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(regenerate_url(campaign.pk))
        assert response.status_code == 403

    def test_regenerate_rechazado_dos_veces_409(self, api_client, campaign):
        campaign.estado = CampaignStatus.RECHAZADO
        campaign.rechazos_cliente_count = 2
        campaign.save(update_fields=["estado", "rechazos_cliente_count"])
        response = api_client.post(regenerate_url(campaign.pk))
        assert response.status_code == 409


@pytest.mark.django_db
class TestCampaignSubmit:
    def test_submit_generado_returns_200(self, api_client, campaign_generada):
        response = api_client.post(submit_url(campaign_generada.pk))
        assert response.status_code == 200
        campaign_generada.refresh_from_db()
        assert campaign_generada.estado == CampaignStatus.PENDIENTE_APROBACION

    def test_submit_wrong_state_returns_409(self, api_client, campaign):
        response = api_client.post(submit_url(campaign.pk))
        assert response.status_code == 409

    def test_submit_non_marketero_403(self, cliente, campaign_generada):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(submit_url(campaign_generada.pk))
        assert response.status_code == 403


@pytest.mark.django_db
class TestCampaignRecentApproved:
    def test_recent_approved_returns_only_approved(self, api_client, campaign, campaign_generada):
        campaign.estado = CampaignStatus.APROBADO
        campaign.cliente_valoracion = 5
        campaign.save(update_fields=["estado", "cliente_valoracion"])
        response = api_client.get(RECENT_APPROVED_URL)
        assert response.status_code == 200
        ids = [c["id"] for c in response.data["data"]["campaigns"]]
        assert campaign.id in ids
        assert campaign_generada.id not in ids

    def test_recent_approved_limits_to_10(self, api_client, user_marketero):
        for i in range(12):
            Campaign.objects.create(
                titulo=f"Aprobada {i}",
                cliente_nombre="Cliente Test",
                cliente_email="cliente@test.com",
                industria="tecnologia",
                tono=CampaignTono.PROFESIONAL,
                plataforma=CampaignPlataforma.INSTAGRAM,
                prompt="Prompt suficientemente largo.",
                texto_generado="Copy aprobado.",
                estado=CampaignStatus.APROBADO,
                marketero=user_marketero,
            )
        response = api_client.get(f"{RECENT_APPROVED_URL}?limit=10")
        assert response.status_code == 200
        assert len(response.data["data"]["campaigns"]) == 10


@pytest.mark.django_db
class TestCampaignStats:
    def test_stats_returns_200(self, api_client):
        response = api_client.get(STATS_URL)
        assert response.status_code == 200
        assert response.data["success"] is True

    def test_stats_has_total(self, api_client, campaign, campaign_generada):
        response = api_client.get(STATS_URL)
        data = response.data["data"]
        assert "total" in data
        assert data["total"] == 2

    def test_stats_counts_by_estado(self, api_client, campaign, campaign_generada):
        response = api_client.get(STATS_URL)
        data = response.data["data"]
        assert data[CampaignStatus.BORRADOR] == 1
        assert data[CampaignStatus.GENERADO] == 1

    def test_stats_incluye_tokens_disponibles(self, api_client, user_marketero):
        response = api_client.get(STATS_URL)
        data = response.data["data"]
        assert data["tokens_disponibles"] == user_marketero.tokens_disponibles

    def test_stats_unauthenticated_401(self):
        client = APIClient()
        response = client.get(STATS_URL)
        assert response.status_code == 401


@pytest.mark.django_db
class TestCampaignCreditsDetail:
    def test_returns_200(self, api_client):
        response = api_client.get(CREDITS_DETAIL_URL)
        assert response.status_code == 200
        assert response.data["success"] is True

    def test_incluye_tokens_disponibles(self, api_client, user_marketero):
        response = api_client.get(CREDITS_DETAIL_URL)
        data = response.data["data"]
        assert data["tokens_disponibles"] == user_marketero.tokens_disponibles

    def test_historial_lista_campanas_propias(self, api_client, campaign, campaign_generada):
        response = api_client.get(CREDITS_DETAIL_URL)
        historial = response.data["data"]["historial"]
        ids = {c["id"] for c in historial}
        assert {campaign.id, campaign_generada.id} <= ids

    def test_metricas_del_mes_se_calculan(self, api_client, campaign_generada):
        response = api_client.get(CREDITS_DETAIL_URL)
        data = response.data["data"]
        assert data["campanas_mes"] >= 1
        assert data["consumidos_mes"] >= 0
        assert data["promedio_por_campana_mes"] >= 0

    def test_sin_campanas_no_falla(self, api_client):
        response = api_client.get(CREDITS_DETAIL_URL)
        data = response.data["data"]
        assert data["historial"] == []
        assert data["campanas_mes"] == 0
        assert data["promedio_por_campana_mes"] == 0

    def test_unauthenticated_401(self):
        client = APIClient()
        response = client.get(CREDITS_DETAIL_URL)
        assert response.status_code == 401


@pytest.mark.django_db
class TestCampaignPurchaseCredits:
    """Pasarela de pago simulada — siempre aprueba, nunca confía en el body."""

    def test_pro_plan_suma_1500_creditos(self, api_client, user_marketero):
        saldo_inicial = user_marketero.tokens_disponibles
        response = api_client.post(CREDITS_PURCHASE_URL, {"plan": "pro"}, format="json")
        assert response.status_code == 200
        assert response.data["data"]["creditos_agregados"] == 1500
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == saldo_inicial + 1500

    def test_crea_registro_credit_purchase(self, api_client, user_marketero):
        from apps.campaigns.models import CreditPurchase

        api_client.post(CREDITS_PURCHASE_URL, {"plan": "elite"}, format="json")
        compra = CreditPurchase.objects.get(usuario=user_marketero)
        assert compra.creditos == 5000
        assert compra.plan_nombre == "Agencia Plus"
        assert compra.monto == 399
        assert compra.estado == "aprobado"

    def test_ignora_creditos_y_monto_enviados_por_el_cliente(self, api_client, user_marketero):
        """El cliente no debe poder auto-otorgarse créditos manipulando el body."""
        saldo_inicial = user_marketero.tokens_disponibles
        response = api_client.post(
            CREDITS_PURCHASE_URL,
            {"plan": "basico", "creditos": 999999, "monto": 1},
            format="json",
        )
        assert response.data["data"]["creditos_agregados"] == 500
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == saldo_inicial + 500

    def test_plan_invalido_400(self, api_client):
        response = api_client.post(CREDITS_PURCHASE_URL, {"plan": "no-existe"}, format="json")
        assert response.status_code == 400

    def test_sin_plan_400(self, api_client):
        response = api_client.post(CREDITS_PURCHASE_URL, {}, format="json")
        assert response.status_code == 400

    def test_unauthenticated_401(self):
        client = APIClient()
        response = client.post(CREDITS_PURCHASE_URL, {"plan": "pro"}, format="json")
        assert response.status_code == 401


def restore_url(campaign_pk: int, version_pk: int) -> str:
    return f"/api/campaigns/{campaign_pk}/versions/{version_pk}/restore/"


@pytest.mark.django_db
class TestCampaignVersionRestore:
    @pytest.fixture
    def version_vieja(self, campaign_generada):
        from apps.campaigns.models import CampaignVersion

        return CampaignVersion.objects.create(
            campaign=campaign_generada,
            version_number=1,
            texto_generado="Copy antiguo v1.",
            imagen_b64=None,
        )

    def test_restore_devuelve_200_y_restaura_texto(
        self, api_client, campaign_generada, version_vieja
    ):
        response = api_client.post(restore_url(campaign_generada.pk, version_vieja.pk))
        assert response.status_code == 200
        campaign_generada.refresh_from_db()
        assert campaign_generada.texto_generado == "Copy antiguo v1."

    def test_restore_guarda_snapshot_del_contenido_actual(
        self, api_client, campaign_generada, version_vieja
    ):
        from apps.campaigns.models import CampaignVersion

        api_client.post(restore_url(campaign_generada.pk, version_vieja.pk))
        snapshots = CampaignVersion.objects.filter(campaign=campaign_generada)
        assert snapshots.count() == 2
        assert snapshots.order_by("-version_number").first().texto_generado == (
            "Copy generado de prueba."
        )

    def test_restore_estado_no_editable_409(self, api_client, campaign_generada, version_vieja):
        campaign_generada.estado = CampaignStatus.PENDIENTE_APROBACION
        campaign_generada.save(update_fields=["estado"])
        response = api_client.post(restore_url(campaign_generada.pk, version_vieja.pk))
        assert response.status_code == 409

    def test_restore_otro_usuario_403(self, cliente, campaign_generada, version_vieja):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(restore_url(campaign_generada.pk, version_vieja.pk))
        assert response.status_code == 403

    def test_restore_version_de_otra_campana_404(
        self, api_client, campaign, campaign_generada, version_vieja
    ):
        response = api_client.post(restore_url(campaign.pk, version_vieja.pk))
        assert response.status_code == 404


ANALYTICS_URL = "/api/admin/analytics/"


@pytest.mark.django_db
class TestAdminAnalyticsView:
    def test_superadmin_gets_analytics(self, superadmin_client):
        response = superadmin_client.get(ANALYTICS_URL)
        assert response.status_code == 200
        assert response.data["success"] is True

    def test_analytics_has_kpi(self, superadmin_client):
        response = superadmin_client.get(ANALYTICS_URL)
        data = response.data["data"]
        assert "kpi" in data
        assert "total_campanas" in data["kpi"]
        assert "tasa_aprobacion" in data["kpi"]

    def test_analytics_has_estados_globales(self, superadmin_client):
        response = superadmin_client.get(ANALYTICS_URL)
        data = response.data["data"]
        assert "estados_globales" in data

    def test_analytics_period_week(self, superadmin_client):
        response = superadmin_client.get(f"{ANALYTICS_URL}?period=week")
        assert response.status_code == 200
        assert response.data["data"]["periodo"] == "week"

    def test_marketero_gets_403(self, api_client):
        response = api_client.get(ANALYTICS_URL)
        assert response.status_code == 403

    def test_unauthenticated_gets_401(self):
        client = APIClient()
        response = client.get(ANALYTICS_URL)
        assert response.status_code == 401
