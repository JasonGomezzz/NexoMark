"""
MarketMind IA — n8n Service (Orquestador Asíncrono)

Flujo producción (USE_MOCK_AI=False):
  1. Valida que el saldo cubra GENERATION_CREDIT_COST (defensa en profundidad).
  2. En transaction.atomic(): descuenta GENERATION_CREDIT_COST con un UPDATE condicional
     (credit_service; no se gasta dos veces el último), rota n8n_callback_token,
     incrementa intentos y transiciona campaña → PENDIENTE_IA.
  3. Dispara webhook a n8n con el secreto compartido (X-NexoMark-Token) y el
     n8n_callback_token del intento. n8n valida el secreto antes de procesar y
     responde 202 enseguida; la URL de callback la arma n8n con su propia
     variable DJANGO_CALLBACK_BASE_URL (no la toma del payload).
  4. Si n8n no responde o rechaza (401/403/5xx): devuelve lo cobrado en ese
     intento (Campaign.creditos_intento) y estado → BORRADOR.
  5. El resultado real llega por POST /api/campaigns/webhook/ia-result/ con el
     mismo secreto. Como el token se rota en cada intento, un callback de un
     intento anterior ya no corresponde a ninguna campaña y se rechaza.

Flujo mock (USE_MOCK_AI=True):
  Simula el callback directamente sin llamar a n8n.
  Útil para desarrollo local sin Docker n8n activo.
"""

import hmac
import logging
import uuid
from typing import TYPE_CHECKING, Any

import requests
from django.conf import settings
from django.db import transaction

from services.credit_service import (
    GENERATION_CREDIT_COST,
    agregar_creditos,
    alcanza_para_generar,
    consumir_credito,
    creditos_a_devolver,
)
from services.mock_assets import MOCK_IMAGE_B64
from services.version_service import save_campaign_version

if TYPE_CHECKING:
    from apps.campaigns.models import Campaign

logger = logging.getLogger(__name__)

# Encabezado con el secreto compartido N8N_WEBHOOK_TOKEN, en ambos sentidos:
# Django → n8n (webhooks) y n8n → Django (callbacks).
N8N_TOKEN_HEADER = "X-NexoMark-Token"


def cabeceras_n8n() -> dict[str, str]:
    """Encabezados que exige el workflow de n8n para aceptar un webhook."""
    return {N8N_TOKEN_HEADER: settings.N8N_WEBHOOK_TOKEN}


def secreto_n8n_valido(recibido: str | None) -> bool:
    """
    Compara el secreto recibido con N8N_WEBHOOK_TOKEN en tiempo constante.

    Un secreto vacío nunca autentica: ni el configurado (compare_digest("", "")
    sería verdadero) ni el recibido.
    """
    esperado = settings.N8N_WEBHOOK_TOKEN or ""
    if not esperado or not recibido:
        return False
    return hmac.compare_digest(recibido.encode(), esperado.encode())


def _motivo_rechazo(status_code: int) -> str:
    if status_code in (401, 403):
        return f"n8n rechazó el secreto compartido ({status_code}); revisar N8N_WEBHOOK_TOKEN"
    return f"n8n respondió {status_code}"


def trigger_ia_generation(campaign: "Campaign") -> dict[str, Any]:
    """
    Orquesta la generación asíncrona de copy IA para una campaña.

    Descuenta GENERATION_CREDIT_COST créditos, transiciona a PENDIENTE_IA y dispara el webhook n8n.
    Django retorna 202 inmediatamente; el resultado llega por callback.

    Args:
        campaign: Objeto Campaign en estado BORRADOR con marketero cargado.

    Returns:
        Dict con claves:
            - dispatched (bool): True si el webhook fue aceptado por n8n.
            - mock (bool): True si se usó el flujo mock (solo si dispatched=True).
            - error (str): Descripción del error (solo si dispatched=False).
    """
    from apps.campaigns.models import CampaignStatus

    user = campaign.marketero

    if not alcanza_para_generar(user):
        logger.warning(
            "Campaña %s sin tokens disponibles para usuario %s",
            campaign.id,
            user.id,
        )
        return {"dispatched": False, "error": f"Necesitas {GENERATION_CREDIT_COST} créditos para generar."}

    if campaign.intentos_generacion >= 3:
        logger.warning(
            "Campaña %s alcanzó el máximo de intentos (%s)",
            campaign.id,
            campaign.intentos_generacion,
        )
        return {"dispatched": False, "error": "Máximo de intentos de generación alcanzado (3)."}

    # Si esta campaña ya tenía una versión generada, preservarla antes de
    # reemplazarla. En primera generación es no-op; el resultado inicial se
    # guarda después de recibir el contenido.
    save_campaign_version(campaign)

    # ── Descontar créditos + incrementar intentos + transicionar ───────
    with transaction.atomic():
        if not consumir_credito(user, GENERATION_CREDIT_COST):
            # Otra petición gastó el saldo entre la validación y el cobro.
            return {"dispatched": False, "error": f"Necesitas {GENERATION_CREDIT_COST} créditos para generar."}

        # Token nuevo por intento: el callback de un intento anterior (p. ej. uno
        # que n8n terminó después de un timeout) ya no autentica contra esta campaña.
        campaign.n8n_callback_token = uuid.uuid4()
        campaign.intentos_generacion += 1
        campaign.tokens_consumidos += GENERATION_CREDIT_COST
        campaign.creditos_intento = GENERATION_CREDIT_COST
        campaign.save(
            update_fields=[
                "n8n_callback_token",
                "intentos_generacion",
                "tokens_consumidos",
                "creditos_intento",
                "fecha_actualizacion",
            ]
        )

        campaign.transition_to(CampaignStatus.PENDIENTE_IA)

    logger.info(
        "Campaña %s → PENDIENTE_IA. Tokens restantes: %s. Intento #%s.",
        campaign.id,
        user.tokens_disponibles,
        campaign.intentos_generacion,
    )

    # ── Flujo mock: simula callback sin n8n ────────────────────────────
    if settings.USE_MOCK_AI:
        logger.info("USE_MOCK_AI activo — simulando callback para campaña %s", campaign.id)
        mock_copy = (
            f"[MOCK] Copy publicitario para «{campaign.titulo}». "
            f"Industria: {campaign.industria} | Tono: {campaign.tono} | "
            f"Plataforma: {campaign.plataforma}. "
            "Transforma tu marca hoy con NexoMark IA."
        )
        campaign.texto_generado = mock_copy
        # El mock no llama al modelo de imagen (GEMINI_IMAGE_MODEL), pero devuelve un PNG placeholder
        # honesto para que la web y el mobile siempre muestren un anuncio
        # completo (texto + imagen) sin depender del contenedor n8n.
        campaign.imagen_b64 = MOCK_IMAGE_B64
        campaign.save(update_fields=["texto_generado", "imagen_b64", "fecha_actualizacion"])
        save_campaign_version(campaign)
        campaign.transition_to(CampaignStatus.GENERADO)
        return {"dispatched": True, "mock": True}

    # ── Flujo real: disparar webhook n8n ───────────────────────────────
    webhook_url = f"{settings.N8N_WEBHOOK_BASE_URL}/webhook/marketmind"

    payload = {
        "campaign_id": campaign.id,
        "prompt": campaign.prompt,
        "industria": campaign.industria,
        "tono": campaign.tono,
        "plataforma": campaign.plataforma,
        "n8n_callback_token": str(campaign.n8n_callback_token),
        # Solo por compatibilidad del payload: el workflow lo ignora y arma la
        # URL con su variable DJANGO_CALLBACK_BASE_URL.
        "callback_url": f"{settings.DJANGO_BASE_URL}/api/campaigns/webhook/ia-result/",
        "use_mock": False,
    }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers=cabeceras_n8n(),
            timeout=settings.N8N_WEBHOOK_TIMEOUT,
        )
        if response.status_code not in (200, 202):
            raise requests.exceptions.RequestException(_motivo_rechazo(response.status_code))

        logger.info(
            "Webhook n8n aceptado para campaña %s (status %s). Esperando callback.",
            campaign.id,
            response.status_code,
        )
        return {"dispatched": True, "mock": False}

    except (
        requests.exceptions.Timeout,
        requests.exceptions.ConnectionError,
        requests.exceptions.RequestException,
    ) as exc:
        error_msg = str(exc)
        logger.error(
            "Error al disparar webhook n8n para campaña %s: %s",
            campaign.id,
            error_msg,
        )
        # Rollback: devolver lo cobrado + marcar error + estado → BORRADOR
        with transaction.atomic():
            agregar_creditos(user, creditos_a_devolver(campaign.creditos_intento))

            campaign.ia_error_message = f"n8n no disponible: {error_msg}"
            campaign.save(update_fields=["ia_error_message", "fecha_actualizacion"])

            campaign.transition_to(CampaignStatus.BORRADOR)

        logger.warning(
            "Campaña %s revertida a BORRADOR. Créditos devueltos a usuario %s.",
            campaign.id,
            user.id,
        )
        return {"dispatched": False, "error": error_msg}


def describir_resultado(resultado: dict[str, Any]) -> str:
    """Mensaje para el usuario según el resultado de trigger_ia_generation."""
    if resultado.get("mock"):
        return "Campaña creada y contenido generado (modo mock)."
    if resultado["dispatched"]:
        return "Campaña creada. Generando contenido IA en segundo plano..."
    return "Campaña creada como borrador. El servicio IA no está disponible."
