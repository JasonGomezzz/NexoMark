"""
MarketMind IA — Intenciones de campaña (voz o texto → campos → campaña).

Flujo:
    POST  /api/intents/interpret/      texto → campos propuestos (no genera, no cobra)
    PATCH /api/intents/{id}/           correcciones del usuario
    POST  /api/intents/{id}/confirm/   crea la campaña y dispara la generación
    POST  /api/intents/{id}/discard/   descarta el borrador
    GET   /api/intents/ · /{id}/       retomar desde otro dispositivo

POST /api/campaigns/ sigue igual: el formulario clásico no depende de esto.
"""

import logging
from typing import Any

from datetime import date

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.authentication.models import UserRole
from apps.authentication.permissions import IsMarketero, IsMarketeroOrSuperAdmin
from core.exceptions import api_response
from services import medicion_service
from services.intent_service import IntentInterpretationError, interpretar_brief
from services.n8n_service import describir_resultado, trigger_ia_generation

from .models import CampaignIntent, CampaignStatus, IntentEstado
from .serializers import (
    CampaignIntentSerializer,
    CampaignSerializer,
    IntentCamposSerializer,
    IntentInterpretSerializer,
)

logger = logging.getLogger(__name__)


class IntentInterpretThrottle(UserRateThrottle):
    """Interpretar no consume créditos del producto, pero sí cuota del proveedor."""

    scope = "intent_interpret"


class CampaignIntentViewSet(viewsets.GenericViewSet):
    """Intenciones del marketero autenticado. Nadie ve las de otro usuario."""

    serializer_class = CampaignIntentSerializer
    permission_classes = [IsAuthenticated, IsMarketero]

    def get_queryset(self):
        return CampaignIntent.objects.filter(usuario=self.request.user)

    def _respuesta(self, intent: CampaignIntent, message: str, code: int = status.HTTP_200_OK,
                   extra: dict[str, Any] | None = None) -> Response:
        data = {"intent": CampaignIntentSerializer(intent).data, **(extra or {})}
        return Response(api_response(success=True, message=message, data=data), status=code)

    def list(self, request: Request) -> Response:
        """Últimas intenciones; `?estado=borrador` para retomar las pendientes."""
        queryset = self.get_queryset()
        estado = request.query_params.get("estado")
        if estado in IntentEstado.values:
            queryset = queryset.filter(estado=estado)
        intents = CampaignIntentSerializer(queryset[:20], many=True).data
        return Response(api_response(True, "Intenciones obtenidas.", {"intents": intents}))

    @action(detail=False, methods=["get"], url_path="medicion", permission_classes=[IsAuthenticated, IsMarketeroOrSuperAdmin])
    def medicion(self, request: Request) -> Response | HttpResponse:
        """
        GET /api/intents/medicion/?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&formato=csv]

        Voz vs. formulario para la tesis (ver services/medicion_service.py).
        El superadmin ve todas las intenciones; el marketero, las suyas.
        Con `formato=csv` devuelve una fila por intención, sin el texto del brief.
        """
        qs = CampaignIntent.objects.all()
        if request.user.rol != UserRole.SUPERADMIN:
            qs = qs.filter(usuario=request.user)
        try:
            desde = request.query_params.get("desde")
            hasta = request.query_params.get("hasta")
            if desde:
                qs = qs.filter(fecha_creacion__date__gte=date.fromisoformat(desde))
            if hasta:
                qs = qs.filter(fecha_creacion__date__lte=date.fromisoformat(hasta))
        except ValueError:
            return Response(api_response(False, "Usa fechas con formato AAAA-MM-DD.", {}),
                            status=status.HTTP_400_BAD_REQUEST)
        if request.query_params.get("formato") == "csv":
            response = HttpResponse(medicion_service.csv_por_intencion(qs), content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = 'attachment; filename="medicion-voz-formulario.csv"'
            response["Cache-Control"] = "no-store"
            return response
        return Response(api_response(True, "Medición voz vs. formulario.", medicion_service.resumen(qs)))

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        intent = get_object_or_404(self.get_queryset(), pk=pk)
        return self._respuesta(intent, "Intención obtenida.")

    @action(detail=False, methods=["post"], url_path="interpret",
            throttle_classes=[IntentInterpretThrottle])
    def interpret(self, request: Request) -> Response:
        """Convierte el brief en campos editables. No crea campaña ni descuenta crédito."""
        entrada = IntentInterpretSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        try:
            resultado = interpretar_brief(entrada.validated_data["texto"])
        except IntentInterpretationError as exc:
            return Response(
                api_response(
                    success=False,
                    message=f"{exc} Puedes completar el formulario a mano.",
                    data={},
                ),
                status=status.HTTP_502_BAD_GATEWAY,
            )

        intent = CampaignIntent.objects.create(
            usuario=request.user,
            origen=entrada.validated_data["origen"],
            transcripcion=entrada.validated_data["texto"],
            campos_interpretados=resultado.campos,
            campos_finales=dict(resultado.campos),
            advertencias=resultado.advertencias,
            modelo_ia=resultado.modelo,
            uso_ia=resultado.uso,
            interpretacion_ms=resultado.duracion_ms,
            captura_ms=entrada.validated_data.get("captura_ms"),
        )
        return self._respuesta(
            intent, "Brief interpretado. Revisa los campos antes de confirmar.",
            status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        """Guarda las correcciones del usuario mientras la intención es borrador."""
        entrada = IntentCamposSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        with transaction.atomic():
            intent = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            if intent.estado != IntentEstado.BORRADOR:
                return self._no_editable(intent)
            intent.campos_finales = {**intent.campos_finales, **entrada.validated_data["campos"]}
            intent.save(update_fields=["campos_finales", "fecha_actualizacion"])
        return self._respuesta(intent, "Cambios guardados.")

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        """
        Crea la campaña con los campos finales y dispara la generación.

        Confirmar dos veces devuelve la misma campaña: no crea otra ni
        descuenta otro crédito.
        """
        cuerpo = request.data if isinstance(request.data, dict) else {}
        entrada = IntentCamposSerializer(data={"campos": cuerpo.get("campos", {})})
        entrada.is_valid(raise_exception=True)

        with transaction.atomic():
            intent = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)

            if intent.estado == IntentEstado.CONFIRMADO and intent.campaign_id:
                return self._respuesta(
                    intent, "Esta intención ya fue confirmada.",
                    extra={"campaign": CampaignSerializer(intent.campaign).data},
                )
            if intent.estado != IntentEstado.BORRADOR:
                return self._no_editable(intent)

            intent.campos_finales = {**intent.campos_finales, **entrada.validated_data["campos"]}
            intent.save(update_fields=["campos_finales", "fecha_actualizacion"])

            campana = CampaignSerializer(
                data={k: v for k, v in intent.campos_finales.items() if v}
            )
            if not campana.is_valid():
                return Response(
                    api_response(
                        success=False,
                        message="Faltan datos o hay campos inválidos.",
                        data={
                            "errors": campana.errors,
                            "intent": CampaignIntentSerializer(intent).data,
                        },
                    ),
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if request.user.tokens_disponibles <= 0:
                return Response(
                    api_response(
                        success=False,
                        message=(
                            "Sin tokens disponibles. "
                            "Contacta al administrador para renovar tu plan."
                        ),
                        data={"tokens_disponibles": 0},
                    ),
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )

            campaign = campana.save(estado=CampaignStatus.BORRADOR, marketero=request.user)
            intent.estado = IntentEstado.CONFIRMADO
            intent.campaign = campaign
            intent.confirmado_at = timezone.now()
            intent.save(update_fields=["estado", "campaign", "confirmado_at", "fecha_actualizacion"])

        # Fuera de la transacción: llama a n8n y no debe retener el bloqueo.
        request.user.refresh_from_db()
        resultado = trigger_ia_generation(campaign)
        campaign.refresh_from_db()

        return self._respuesta(
            intent, describir_resultado(resultado), status.HTTP_202_ACCEPTED,
            extra={"campaign": CampaignSerializer(campaign).data},
        )

    @action(detail=True, methods=["post"], url_path="discard")
    def discard(self, request: Request, pk: str | None = None) -> Response:
        with transaction.atomic():
            intent = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            if intent.estado == IntentEstado.CONFIRMADO:
                return self._no_editable(intent)
            intent.estado = IntentEstado.DESCARTADO
            intent.save(update_fields=["estado", "fecha_actualizacion"])
        return self._respuesta(intent, "Intención descartada.")

    def _no_editable(self, intent: CampaignIntent) -> Response:
        return Response(
            api_response(
                success=False,
                message=f"La intención está en estado '{intent.estado}' y ya no se puede modificar.",
                data={"intent": CampaignIntentSerializer(intent).data},
            ),
            status=status.HTTP_409_CONFLICT,
        )
