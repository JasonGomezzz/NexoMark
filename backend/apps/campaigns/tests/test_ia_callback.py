"""Tests de IaResultCallbackView y EmailSentCallbackView."""

import pytest
from rest_framework.test import APIClient

from apps.campaigns.models import (
    Campaign,
    CampaignPlataforma,
    CampaignStatus,
    CampaignTono,
    CampaignVersion,
)

CALLBACK_URL = "/api/campaigns/webhook/ia-result/"
EMAIL_CALLBACK_URL = "/api/campaigns/webhook/email-sent/"


@pytest.mark.django_db
class TestIaResultCallbackSuccess:
    def test_success_callback_returns_200(self, campaign_pendiente_ia):
        client = APIClient()
        response = client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": True,
            "copy": "Copy publicitario de prueba generado por Gemini.",
        }, format="json")
        assert response.status_code == 200
        assert response.data["success"] is True

    def test_success_saves_texto_generado(self, campaign_pendiente_ia):
        client = APIClient()
        copy_text = "Texto generado por IA premium."
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": True,
            "copy": copy_text,
        }, format="json")
        campaign_pendiente_ia.refresh_from_db()
        assert campaign_pendiente_ia.texto_generado == copy_text

    def test_success_transitions_to_generado(self, campaign_pendiente_ia):
        client = APIClient()
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": True,
            "copy": "Copy test",
        }, format="json")
        campaign_pendiente_ia.refresh_from_db()
        assert campaign_pendiente_ia.estado == CampaignStatus.GENERADO

    def test_success_saves_initial_version(self, campaign_pendiente_ia):
        client = APIClient()
        copy_text = "Primera versión generada por IA."
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": True,
            "copy": copy_text,
        }, format="json")
        versions = CampaignVersion.objects.filter(campaign=campaign_pendiente_ia)
        assert versions.count() == 1
        assert versions.first().texto_generado == copy_text


@pytest.mark.django_db
class TestIaResultCallbackFailure:
    def test_failure_callback_returns_200(self, campaign_pendiente_ia):
        client = APIClient()
        response = client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": "Gemini 429: quota exceeded",
        }, format="json")
        assert response.status_code == 200

    def test_failure_transitions_to_borrador(self, campaign_pendiente_ia):
        client = APIClient()
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": "timeout",
        }, format="json")
        campaign_pendiente_ia.refresh_from_db()
        assert campaign_pendiente_ia.estado == CampaignStatus.BORRADOR

    def test_failure_returns_token_to_user(self, campaign_pendiente_ia, user_marketero):
        initial_tokens = user_marketero.tokens_disponibles
        client = APIClient()
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": "timeout",
        }, format="json")
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == initial_tokens + 1

    def test_failure_returns_standard_proposal_cost(self, campaign_pendiente_ia, user_marketero):
        campaign_pendiente_ia.generation_credit_cost = 4
        campaign_pendiente_ia.save()
        initial = user_marketero.tokens_disponibles
        response = APIClient().post(CALLBACK_URL, {
            'n8n_callback_token': str(campaign_pendiente_ia.n8n_callback_token),
            'success': False, 'error': 'timeout',
        }, format='json')
        user_marketero.refresh_from_db()
        assert user_marketero.tokens_disponibles == initial + 4

    def test_failure_saves_error_message(self, campaign_pendiente_ia):
        client = APIClient()
        error_msg = "Gemini API rate limit exceeded"
        client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": error_msg,
        }, format="json")
        campaign_pendiente_ia.refresh_from_db()
        assert campaign_pendiente_ia.ia_error_message == error_msg


@pytest.mark.django_db
class TestIaResultCallbackInvalidToken:
    def test_invalid_token_returns_403(self):
        client = APIClient()
        response = client.post(CALLBACK_URL, {
            "n8n_callback_token": "00000000-0000-0000-0000-000000000000",
            "success": True,
            "copy": "x",
        }, format="json")
        assert response.status_code == 403

    def test_missing_token_returns_403(self):
        client = APIClient()
        response = client.post(CALLBACK_URL, {
            "success": True,
            "copy": "x",
        }, format="json")
        assert response.status_code == 403


@pytest.mark.django_db
class TestEmailSentCallback:
    def test_email_callback_marks_email_enviado(self, db, user_marketero):
        campaign = Campaign.objects.create(
            titulo="Email Test",
            cliente_nombre="C",
            industria="tech",
            tono=CampaignTono.PROFESIONAL,
            plataforma=CampaignPlataforma.INSTAGRAM,
            prompt="x",
            estado=CampaignStatus.PENDIENTE_APROBACION,
            marketero=user_marketero,
        )
        client = APIClient()
        response = client.post(EMAIL_CALLBACK_URL, {
            "n8n_callback_token": str(campaign.n8n_callback_token),
            "success": True,
            "event_type": "pendiente_aprobacion",
        }, format="json")
        assert response.status_code == 200
        campaign.refresh_from_db()
        assert campaign.email_enviado is True

    def test_email_callback_no_event_type_does_not_set_flag(self, db, user_marketero):
        campaign = Campaign.objects.create(
            titulo="Email No Flag",
            cliente_nombre="C",
            industria="tech",
            tono=CampaignTono.PROFESIONAL,
            plataforma=CampaignPlataforma.INSTAGRAM,
            prompt="x",
            estado=CampaignStatus.PENDIENTE_APROBACION,
            marketero=user_marketero,
        )
        client = APIClient()
        client.post(EMAIL_CALLBACK_URL, {
            "n8n_callback_token": str(campaign.n8n_callback_token),
            "success": True,
        }, format="json")
        campaign.refresh_from_db()
        assert campaign.email_enviado is False

    def test_email_callback_invalid_token_403(self):
        client = APIClient()
        response = client.post(EMAIL_CALLBACK_URL, {
            "n8n_callback_token": "00000000-0000-0000-0000-000000000000",
            "success": True,
        }, format="json")
        assert response.status_code == 403
