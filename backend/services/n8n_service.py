"""
MarketMind IA — n8n Service (Orquestador Asíncrono)

Flujo producción (USE_MOCK_AI=False):
  1. Valida tokens_disponibles > 0 (defensa en profundidad).
  2. En transaction.atomic(): descuenta 1 token, incrementa intentos,
     transiciona campaña → PENDIENTE_IA.
  3. Dispara webhook a n8n con callback_token + callback_url.
     Timeout de 5s: n8n responde inmediatamente (modo "Respond Immediately").
  4. Si n8n no responde: rollback token + estado → BORRADOR.
  5. El resultado real llega por POST /api/campaigns/webhook/ia-result/.

Flujo mock (USE_MOCK_AI=True):
  Simula el callback directamente sin llamar a n8n.
  Útil para desarrollo local sin Docker n8n activo.
"""

import logging
from typing import TYPE_CHECKING, Any

import requests
from django.conf import settings
from django.db import transaction

from services.mock_assets import MOCK_IMAGE_B64
from services.version_service import save_campaign_version

if TYPE_CHECKING:
    from apps.campaigns.models import Campaign

logger = logging.getLogger(__name__)


def trigger_ia_generation(campaign: "Campaign") -> dict[str, Any]:
    """
    Orquesta la generación asíncrona de copy IA para una campaña.

    Descuenta 1 token, transiciona a PENDIENTE_IA y dispara el webhook n8n.
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
    from apps.campaigns.platform_content import platforms

    if 'google_ads' in platforms(campaign):
        return {"dispatched": False, "error": "Google Ads se ha retirado del proyecto. Se conserva la campaña histórica sin generar contenido nuevo."}

    user = campaign.marketero

    if user.tokens_disponibles <= 0:
        logger.warning(
            "Campaña %s sin tokens disponibles para usuario %s",
            campaign.id,
            user.id,
        )
        return {"dispatched": False, "error": "Sin tokens disponibles."}

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

    # ── Descontar token + incrementar intentos + transicionar ──────────
    with transaction.atomic():
        user.tokens_disponibles -= 1
        user.save(update_fields=["tokens_disponibles"])

        campaign.intentos_generacion += 1
        campaign.tokens_consumidos += 1
        campaign.save(update_fields=["intentos_generacion", "tokens_consumidos", "fecha_actualizacion"])

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
            f"Plataformas: {', '.join(campaign.plataformas or [campaign.plataforma])}. "
            "Transforma tu marca hoy con NexoMark IA."
        )
        campaign.texto_generado = mock_copy
        from services.platform_copy_service import adapt_platform_copies
        campaign.textos_por_plataforma = adapt_platform_copies(campaign)
        campaign.version += 1
        # El mock no llama a Gemini Imagen 3, pero devuelve un PNG placeholder
        # honesto para que la web y el mobile siempre muestren un anuncio
        # completo (texto + imagen) sin depender del contenedor n8n.
        campaign.imagen_b64 = MOCK_IMAGE_B64
        campaign.save(update_fields=["texto_generado", "textos_por_plataforma", "version", "imagen_b64", "fecha_actualizacion"])
        save_campaign_version(campaign)
        campaign.transition_to(CampaignStatus.GENERADO)
        return {"dispatched": True, "mock": True}

    # ── Flujo real: disparar webhook n8n ───────────────────────────────
    webhook_url = f"{settings.N8N_WEBHOOK_BASE_URL}/webhook/marketmind"
    callback_url = (
        f"{settings.DJANGO_BASE_URL}/api/campaigns/webhook/ia-result/"
    )

    payload = {
        "campaign_id": campaign.id,
        "prompt": (
            f"{campaign.prompt}\n\n"
            "Adapta el copy para que funcione en estas plataformas objetivo: "
            f"{', '.join(campaign.plataformas or [campaign.plataforma])}."
        ),
        "industria": campaign.industria,
        "tono": campaign.tono,
        "plataforma": campaign.plataforma,
        "plataformas": campaign.plataformas or [campaign.plataforma],
        "n8n_callback_token": str(campaign.n8n_callback_token),
        "callback_url": callback_url,
        "use_mock": False,
    }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=settings.N8N_WEBHOOK_TIMEOUT,
        )
        if response.status_code not in (200, 202):
            raise requests.exceptions.RequestException(
                f"n8n respondió {response.status_code}"
            )

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
        # Rollback: devolver token + marcar error + estado → BORRADOR
        with transaction.atomic():
            user.tokens_disponibles += 1
            user.save(update_fields=["tokens_disponibles"])

            campaign.ia_error_message = f"n8n no disponible: {error_msg}"
            campaign.save(update_fields=["ia_error_message", "fecha_actualizacion"])

            campaign.transition_to(CampaignStatus.BORRADOR)

        logger.warning(
            "Campaña %s revertida a BORRADOR. Token devuelto a usuario %s.",
            campaign.id,
            user.id,
        )
        return {"dispatched": False, "error": error_msg}
