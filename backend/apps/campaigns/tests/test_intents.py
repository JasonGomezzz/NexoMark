"""Tests de intenciones de campaña: interpretar, corregir, confirmar y descartar."""

from unittest.mock import patch

import requests
import httpx
import pytest
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignIntent, CampaignStatus, IntentEstado
from services import intent_service
from services.intent_service import IntentInterpretationError, normalizar_campos
from apps.campaigns.models import ClientRelationship

INTERPRET_URL = "/api/intents/interpret/"
BRIEF = (
    "Quiero una campaña para una cafetería en Instagram con tono casual, "
    "promocionando un 2x1 en capuchinos para universitarios"
)


def intent_url(pk: int) -> str:
    return f"/api/intents/{pk}/"


def confirm_url(pk: int) -> str:
    return f"/api/intents/{pk}/confirm/"


def discard_url(pk: int) -> str:
    return f"/api/intents/{pk}/discard/"


@pytest.fixture
def intent(api_client) -> CampaignIntent:
    response = api_client.post(INTERPRET_URL, {"texto": BRIEF}, format="json")
    assert response.status_code == 201
    return CampaignIntent.objects.get(pk=response.data["data"]["intent"]["id"])


CAMPOS_COMPLETOS = {
    "titulo": "2x1 en capuchinos",
    "cliente_nombre": "Café Central",
    "cliente_email": "cliente@test.com",
}


@pytest.mark.django_db
class TestInterpret:
    def test_interpreta_sin_crear_campana_ni_cobrar(self, api_client, user_marketero):
        response = api_client.post(INTERPRET_URL, {"texto": BRIEF}, format="json")

        assert response.status_code == 201
        data = response.data["data"]["intent"]
        assert data["estado"] == "borrador"
        assert data["origen"] == "voz"
        assert data["campos_finales"]["plataforma"] == "instagram"
        assert data["campos_finales"]["tono"] == "casual"
        assert data["campos_finales"]["industria"] == "gastronomia"
        assert data["campos_finales"]["prompt"] == BRIEF
        assert "cliente_email" in data["campos_faltantes"]
        assert Campaign.objects.count() == 0
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 10

    def test_tono_fuera_del_dominio_queda_vacio_con_advertencia(self, api_client):
        response = api_client.post(
            INTERPRET_URL,
            {"texto": "Campaña juvenil para una tienda de ropa en TikTok"},
            format="json",
        )
        data = response.data["data"]["intent"]
        assert data["campos_finales"]["tono"] is None
        assert any("juvenil" in aviso for aviso in data["advertencias"])
        assert "tono" in data["campos_faltantes"]

    def test_origen_formulario(self, api_client):
        response = api_client.post(
            INTERPRET_URL, {"texto": BRIEF, "origen": "formulario"}, format="json"
        )
        assert response.data["data"]["intent"]["origen"] == "formulario"

    @pytest.mark.parametrize("texto", ["corto", "x" * 2001])
    def test_longitud_invalida_400(self, api_client, texto):
        response = api_client.post(INTERPRET_URL, {"texto": texto}, format="json")
        assert response.status_code == 400
        assert CampaignIntent.objects.count() == 0

    def test_cliente_no_puede_interpretar(self, cliente):
        client = APIClient()
        client.force_authenticate(user=cliente)
        response = client.post(INTERPRET_URL, {"texto": BRIEF}, format="json")
        assert response.status_code == 403

    def test_anonimo_401(self, db):
        response = APIClient().post(INTERPRET_URL, {"texto": BRIEF}, format="json")
        assert response.status_code == 401

    def test_fallo_del_proveedor_502_sin_guardar(self, api_client):
        with patch(
            "apps.campaigns.intent_views.interpretar_brief",
            side_effect=IntentInterpretationError("El servicio de IA no pudo interpretar el brief."),
        ):
            response = api_client.post(INTERPRET_URL, {"texto": BRIEF}, format="json")
        assert response.status_code == 502
        assert response.data["success"] is False
        assert CampaignIntent.objects.count() == 0


@pytest.mark.django_db
class TestEdicionYAcceso:
    def test_patch_guarda_correcciones_sin_tocar_lo_interpretado(self, api_client, intent):
        response = api_client.patch(
            intent_url(intent.pk), {"campos": {"tono": "urgente"}}, format="json"
        )
        assert response.status_code == 200
        intent.refresh_from_db()
        assert intent.campos_finales["tono"] == "urgente"
        assert intent.campos_interpretados["tono"] == "casual"

    def test_patch_rechaza_campos_desconocidos(self, api_client, intent):
        response = api_client.patch(
            intent_url(intent.pk), {"campos": {"estado": "aprobado"}}, format="json"
        )
        assert response.status_code == 400

    def test_otro_marketero_no_ve_la_intencion(self, intent):
        otro = User.objects.create_user(
            email="otro@test.com", password="Test1234!", nombre="Otro", rol=UserRole.MARKETERO
        )
        client = APIClient()
        client.force_authenticate(user=otro)
        assert client.get(intent_url(intent.pk)).status_code == 404
        assert client.post(confirm_url(intent.pk), {}, format="json").status_code == 404
        assert client.get("/api/intents/").data["data"]["intents"] == []

    def test_lista_filtra_por_estado(self, api_client, intent):
        api_client.post(discard_url(intent.pk))
        borradores = api_client.get("/api/intents/?estado=borrador").data["data"]["intents"]
        descartadas = api_client.get("/api/intents/?estado=descartado").data["data"]["intents"]
        assert borradores == []
        assert [i["id"] for i in descartadas] == [intent.pk]

    def test_descartada_no_se_edita_ni_confirma(self, api_client, intent, cliente):
        assert api_client.post(discard_url(intent.pk)).status_code == 200
        patch_response = api_client.patch(
            intent_url(intent.pk), {"campos": {"tono": "urgente"}}, format="json"
        )
        confirm_response = api_client.post(
            confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json"
        )
        assert patch_response.status_code == 409
        assert confirm_response.status_code == 409
        assert Campaign.objects.count() == 0


@pytest.mark.django_db
class TestConfirm:
    def test_confirma_crea_campana_y_descuenta_cuatro_creditos(
        self, api_client, intent, cliente, user_marketero
    ):
        response = api_client.post(
            confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json"
        )

        assert response.status_code == 202
        campaign = Campaign.objects.get()
        assert response.data["data"]["campaign"]["id"] == campaign.pk
        assert campaign.marketero == user_marketero
        assert campaign.plataforma == "instagram"
        assert campaign.estado == CampaignStatus.GENERADO  # modo mock
        intent.refresh_from_db()
        assert intent.estado == IntentEstado.CONFIRMADO
        assert intent.campaign == campaign
        assert intent.confirmado_at is not None
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 6

    def test_confirmar_dos_veces_no_duplica_ni_cobra_de_nuevo(
        self, api_client, intent, cliente, user_marketero
    ):
        primera = api_client.post(
            confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json"
        )
        segunda = api_client.post(
            confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json"
        )

        assert primera.status_code == 202
        assert segunda.status_code == 200
        assert segunda.data["data"]["campaign"]["id"] == primera.data["data"]["campaign"]["id"]
        assert Campaign.objects.count() == 1
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 6

    def test_campos_incompletos_400_y_sigue_en_borrador(self, api_client, intent, user_marketero):
        response = api_client.post(confirm_url(intent.pk), {}, format="json")

        assert response.status_code == 400
        assert "cliente_email" in response.data["data"]["errors"]
        intent.refresh_from_db()
        assert intent.estado == IntentEstado.BORRADOR
        assert Campaign.objects.count() == 0
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 10

    def test_cliente_no_registrado_400(self, api_client, intent, cliente):
        campos = {**CAMPOS_COMPLETOS, "cliente_email": "nadie@test.com"}
        response = api_client.post(confirm_url(intent.pk), {"campos": campos}, format="json")
        assert response.status_code == 400
        assert "cliente_email" in response.data["data"]["errors"]

    @pytest.mark.parametrize("balance", [0, 1, 2, 3])
    def test_sin_creditos_402_y_no_crea_campana(self, api_client, intent, cliente, user_marketero, balance):
        user_marketero.tokens_disponibles = balance
        user_marketero.save(update_fields=["tokens_disponibles"])

        response = api_client.post(
            confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json"
        )

        assert response.status_code == 402
        assert Campaign.objects.count() == 0
        intent.refresh_from_db()
        assert intent.estado == IntentEstado.BORRADOR

    def test_confirmada_no_se_descarta(self, api_client, intent, cliente):
        api_client.post(confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json")
        assert api_client.post(discard_url(intent.pk)).status_code == 409

    def test_multiple_platforms(self, api_client, intent, cliente, user_marketero):
        response = api_client.post(confirm_url(intent.pk), {"campos": {
            **CAMPOS_COMPLETOS, "plataformas": ["facebook", "tiktok"],
        }}, format="json")
        assert response.status_code == 202
        campaign = Campaign.objects.get()
        assert campaign.plataformas == ["facebook", "tiktok"]
        assert campaign.plataforma == "facebook"

    def test_confirmation_ignores_legacy_client_relationships(self, api_client, intent, cliente, user_marketero):
        user_marketero.plan_key = "basico"
        user_marketero.save(update_fields=["plan_key"])
        for index in range(5):
            client = User.objects.create_user(email=f"quota{index}@example.com", password=None, nombre="Cliente", rol="cliente")
            ClientRelationship.objects.create(marketero=user_marketero, cliente=client)
        ClientRelationship.objects.create(marketero=user_marketero, cliente=cliente, is_active=False)
        response = api_client.post(confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json")
        assert response.status_code == 202
        assert Campaign.objects.count() == 1
        intent.refresh_from_db()
        assert intent.estado == IntentEstado.CONFIRMADO
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 6

    @pytest.mark.parametrize("platform", ["linkedin", "google_ads"])
    def test_retired_platform_cannot_be_confirmed(self, api_client, intent, cliente, platform):
        response = api_client.post(confirm_url(intent.pk), {"campos": {
            **CAMPOS_COMPLETOS, "plataformas": [platform],
        }}, format="json")
        assert response.status_code == 400
        assert Campaign.objects.count() == 0

    def test_failed_dispatch_preserves_one_draft_and_refunds(self, api_client, intent, cliente, user_marketero, settings):
        settings.USE_MOCK_AI = False
        with patch("services.n8n_service.requests.post", side_effect=requests.ConnectionError()):
            first = api_client.post(confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json")
            retry = api_client.post(confirm_url(intent.pk), {"campos": CAMPOS_COMPLETOS}, format="json")
        assert first.status_code == 202
        assert retry.status_code == 200
        assert Campaign.objects.count() == 1
        assert first.data["data"]["campaign"]["id"] == retry.data["data"]["campaign"]["id"]
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == 10


class TestNormalizarCampos:
    """La salida de la IA es entrada no confiable."""

    def test_multiple_platforms_are_validated_and_deduplicated(self):
        fields, warnings = normalizar_campos({"plataformas": ["FB", "instagram", "FB", "linkedin", "google_ads"]})
        assert fields["plataformas"] == ["facebook", "instagram"]
        assert fields["plataforma"] == "facebook"
        assert len(warnings) == 2

    def test_valores_validos_se_normalizan(self):
        campos, advertencias = normalizar_campos(
            {
                "titulo": "  Promo de verano  ",
                "cliente_email": "Cliente@Test.COM",
                "industria": "Tecnología",
                "tono": "Humorístico",
                "plataforma": "FB",
                "prompt": "Promoción de verano con descuentos",
            }
        )
        assert campos["titulo"] == "Promo de verano"
        assert campos["cliente_email"] == "cliente@test.com"
        assert campos["industria"] == "tecnologia"
        assert campos["tono"] == "humoristico"
        assert campos["plataforma"] == "facebook"
        assert campos["cliente_nombre"] is None
        assert advertencias == []

    def test_valores_fuera_del_dominio_no_pasan(self):
        campos, advertencias = normalizar_campos(
            {
                "titulo": 123,
                "cliente_email": "no-es-un-email",
                "industria": "minería",
                "tono": "juvenil",
                "plataforma": "snapchat",
                "prompt": None,
                "rol": "superadmin",
            },
            texto="Brief original suficientemente largo",
        )
        assert campos["titulo"] is None
        assert campos["cliente_email"] is None
        assert campos["industria"] is None
        assert campos["tono"] is None
        assert campos["plataforma"] is None
        assert campos["prompt"] == "Brief original suficientemente largo"
        assert "rol" not in campos
        assert len(advertencias) == 4

    def test_textos_largos_se_recortan(self):
        campos, _ = normalizar_campos({"titulo": "t" * 500, "prompt": "p" * 5000})
        assert len(campos["titulo"]) == 200
        assert len(campos["prompt"]) == 2000


class TestProveedorGemini:
    """Ruta real (USE_MOCK_AI=False) con el HTTP simulado: no gasta cuota."""

    @staticmethod
    def _respuesta(texto: str, uso: dict | None = None) -> httpx.Response:
        cuerpo = {"candidates": [{"content": {"parts": [{"text": texto}]}}]}
        if uso is not None:
            cuerpo["usageMetadata"] = uso
        return httpx.Response(200, json=cuerpo, request=httpx.Request("POST", "http://gemini"))

    def test_json_valido_y_uso_reportado(self, settings):
        settings.USE_MOCK_AI = False
        respuesta = self._respuesta(
            '```json\n{"titulo": "Promo 2x1", "tono": "casual", "plataforma": "instagram"}\n```',
            uso={"promptTokenCount": 120, "candidatesTokenCount": 40},
        )
        with patch.object(intent_service.httpx, "post", return_value=respuesta) as post:
            resultado = intent_service.interpretar_brief(BRIEF)

        assert resultado.campos["titulo"] == "Promo 2x1"
        assert resultado.campos["plataforma"] == "instagram"
        assert resultado.campos["prompt"] == BRIEF
        assert resultado.uso == {"promptTokenCount": 120, "candidatesTokenCount": 40}
        assert resultado.modelo == settings.GEMINI_MODEL
        assert BRIEF in post.call_args.kwargs["json"]["contents"][0]["parts"][0]["text"]

    def test_uso_no_reportado_es_none_no_cero(self, settings):
        settings.USE_MOCK_AI = False
        with patch.object(
            intent_service.httpx, "post", return_value=self._respuesta('{"titulo": "Promo 2x1"}')
        ):
            resultado = intent_service.interpretar_brief(BRIEF)
        assert resultado.uso is None

    @pytest.mark.parametrize("contenido", ["esto no es json", "[1, 2, 3]", ""])
    def test_respuesta_inutilizable_lanza_error(self, settings, contenido):
        settings.USE_MOCK_AI = False
        with patch.object(intent_service.httpx, "post", return_value=self._respuesta(contenido)):
            with pytest.raises(IntentInterpretationError):
                intent_service.interpretar_brief(BRIEF)

    def test_error_de_red_lanza_error(self, settings):
        settings.USE_MOCK_AI = False
        with patch.object(
            intent_service.httpx, "post", side_effect=httpx.ConnectTimeout("timeout")
        ):
            with pytest.raises(IntentInterpretationError):
                intent_service.interpretar_brief(BRIEF)
