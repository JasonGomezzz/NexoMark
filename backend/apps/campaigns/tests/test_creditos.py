"""Créditos atómicos: no se gasta dos veces el último ni una devolución pisa otro cambio."""

from unittest.mock import patch

import pytest
import requests
from django.test import override_settings

from apps.authentication.models import User
from apps.campaigns.models import CampaignStatus
from services import n8n_service
from services.credit_service import (
    GENERATION_CREDIT_COST,
    agregar_creditos,
    consumir_credito,
    creditos_a_devolver,
    cuota_del_plan,
    generaciones,
)

CALLBACK_URL = "/api/campaigns/webhook/ia-result/"


def saldo(user: User) -> int:
    return User.objects.values_list("tokens_disponibles", flat=True).get(pk=user.pk)


@pytest.mark.django_db
class TestServicioDeCreditos:
    def test_una_generacion_cuesta_4(self):
        assert GENERATION_CREDIT_COST == 4

    def test_consume_solo_si_alcanza_para_una_generacion(self, user_marketero):
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=7)
        assert consumir_credito(user_marketero) is True
        assert saldo(user_marketero) == 3
        # Con 3 no alcanza para otra: no se cobra nada.
        assert consumir_credito(user_marketero) is False
        assert saldo(user_marketero) == 3
        assert user_marketero.tokens_disponibles == 3

    def test_generaciones_y_cuotas_de_los_planes(self):
        assert [generaciones(c) for c in (100, 400, 1000, 3, None)] == [25, 100, 250, 0, None]
        assert cuota_del_plan("freelance") == 100
        assert cuota_del_plan("agencia") == 400
        assert cuota_del_plan("agencia_plus") == 1000
        assert cuota_del_plan("basico") == 100  # plan desconocido → Freelance

    def test_devolucion_usa_lo_cobrado_en_el_intento(self):
        assert creditos_a_devolver(4) == 4
        assert creditos_a_devolver(0) == 1  # intentos de antes de este cambio cobraron 1

    def test_agregar_suma_sobre_el_valor_de_la_base(self, user_marketero):
        user_marketero.tokens_disponibles = 50  # valor viejo en memoria
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=3)
        agregar_creditos(user_marketero, 2)
        assert saldo(user_marketero) == 5
        assert user_marketero.tokens_disponibles == 5


@pytest.mark.django_db
class TestCobroDeGeneracion:
    def test_no_cobra_si_otra_peticion_gasto_el_ultimo_credito(self, campaign, user_marketero):
        # La vista vio 1 crédito, pero otra petición lo gastó antes del cobro.
        user_marketero.tokens_disponibles = 1
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=0)
        campaign.marketero = user_marketero

        resultado = n8n_service.trigger_ia_generation(campaign)

        campaign.refresh_from_db()
        assert resultado["dispatched"] is False
        assert saldo(user_marketero) == 0
        assert campaign.estado == CampaignStatus.BORRADOR
        assert campaign.intentos_generacion == 0

    @override_settings(USE_MOCK_AI=False)
    def test_n8n_caido_devuelve_el_credito_sin_pisar_otros_cambios(self, campaign, user_marketero):
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=10)
        campaign.marketero.refresh_from_db()

        def caido(*args, **kwargs):
            # Cobramos 4 (queda 6); mientras esperamos a n8n, otra petición gasta 2.
            User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=4)
            raise requests.exceptions.ConnectionError("n8n apagado")

        with patch.object(n8n_service.requests, "post", side_effect=caido):
            resultado = n8n_service.trigger_ia_generation(campaign)

        assert resultado["dispatched"] is False
        assert saldo(user_marketero) == 8  # 4 tras la otra petición + 4 devueltos


@pytest.mark.django_db
class TestDevolucionPorCallback:
    def test_fallo_de_ia_devuelve_el_credito_sobre_el_saldo_actual(
        self, campaign_pendiente_ia, user_marketero, n8n_client
    ):
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=3)
        respuesta = n8n_client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": "Gemini no respondió",
        }, format="json")
        assert respuesta.status_code == 200
        assert saldo(user_marketero) == 4


@pytest.mark.django_db
class TestDevolucionDeUnIntentoNuevo:
    def test_fallo_de_ia_devuelve_los_4_creditos_cobrados(
        self, campaign_pendiente_ia, user_marketero, n8n_client
    ):
        campaign_pendiente_ia.creditos_intento = GENERATION_CREDIT_COST
        campaign_pendiente_ia.save(update_fields=["creditos_intento"])
        User.objects.filter(pk=user_marketero.pk).update(tokens_disponibles=3)
        respuesta = n8n_client.post(CALLBACK_URL, {
            "n8n_callback_token": str(campaign_pendiente_ia.n8n_callback_token),
            "success": False,
            "error": "Gemini no respondió",
        }, format="json")
        assert respuesta.status_code == 200
        assert saldo(user_marketero) == 7
