"""
MarketMind IA — Campaign Views
Endpoint REST para crear, listar y gestionar campañas publicitarias.
"""

import logging
import re
from datetime import timedelta
from typing import Any

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsSuperAdmin
from core.exceptions import api_response
from services.gemini_text_service import improve_copy
from services.internal_event_service import notify_campaign_submitted
from services.credit_service import agregar_creditos
from services.n8n_service import describir_resultado, trigger_ia_generation
from services.publication_service import DestinoInvalido, programar_publicaciones
from services.version_service import restore_campaign_version, save_campaign_version

from .models import Campaign, CampaignStatus, CampaignVersion, CreditPurchase
from .permissions import N8nCallbackPermission
from .serializers import CampaignEditSerializer, CampaignListaSerializer, CampaignSerializer, CampaignVersionSerializer
from .thumbnails import miniatura_jpeg

logger = logging.getLogger(__name__)

# Mapeo fijo de planes de créditos — pasarela de pago simulada (siempre
# aprueba, sin procesador real). Debe mantenerse en sincronía manual con
# frontend/src/lib/credits.js (PLANS). El cliente solo envía la key del
# plan; el monto/créditos SIEMPRE se leen de aquí, nunca del body.
# Estados en que el marketero puede cambiar el contenido (PATCH, improve-text).
# pendiente_ia: n8n está generando y pisaría el cambio. pendiente_aprobacion:
# el cliente está revisando. aprobado/fracaso: finales (se publica lo aprobado).
ESTADOS_EDITABLES = (
    CampaignStatus.BORRADOR,
    CampaignStatus.GENERADO,
    CampaignStatus.RECHAZADO,
)
MENSAJE_VERSION_DESACTUALIZADA = (
    "La campaña cambió desde que la abriste (otra pestaña, la IA o una restauración). "
    "Recarga para ver la versión actual antes de guardar."
)


def _no_editable(campaign: Campaign) -> Response:
    return Response(
        api_response(
            success=False,
            message=(
                f"No se puede modificar una campaña en estado '{campaign.estado}'. "
                "Solo se editan en borrador, generado o rechazado."
            ),
            data={"estado": campaign.estado},
        ),
        status=status.HTTP_409_CONFLICT,
    )


def _version_desactualizada(campaign: Campaign) -> Response:
    return Response(
        api_response(
            success=False,
            message=MENSAJE_VERSION_DESACTUALIZADA,
            data={"version_actual": campaign.version},
        ),
        status=status.HTTP_409_CONFLICT,
    )


def _es_entero(valor: Any) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


CREDIT_PLAN_MAP = {
    "basico": {"nombre": "Básico", "precio": 49, "creditos": 500},
    "pro": {"nombre": "Pro", "precio": 129, "creditos": 1500},
    "elite": {"nombre": "Elite", "precio": 299, "creditos": 5000},
}


class CampaignViewSet(viewsets.ModelViewSet):
    """
    ViewSet para campañas publicitarias.

    Permisos:
        - Todos los métodos requieren autenticación JWT.
        - Solo rol 'marketero' puede crear campañas y ejecutar generate_ia.
        - 'superadmin' ve todas las campañas.
        - 'cliente' no ve ninguna campaña.

    Endpoints:
        GET    /api/campaigns/        → list
        POST   /api/campaigns/        → create
        GET    /api/campaigns/{id}/   → retrieve
        PATCH  /api/campaigns/{id}/   → partial_update
        GET    /api/campaigns/stats/  → stats (acción custom)
    """

    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        # La app móvil pide la lista sin imágenes en base64 y carga miniaturas aparte.
        if self.action == "list" and self.request.query_params.get("vista") == "ligera":
            return CampaignListaSerializer
        return CampaignSerializer

    def get_queryset(self):
        """
        Filtra campañas según el rol del usuario autenticado.

        Returns:
            QuerySet filtrado por rol.
        """
        user = self.request.user
        if user.rol == "superadmin":
            return Campaign.objects.all()
        if user.rol == "marketero":
            return Campaign.objects.filter(marketero=user)
        return Campaign.objects.none()

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """
        POST /api/campaigns/

        Crea una campaña en BORRADOR y dispara la generación IA de forma asíncrona.
        Django responde HTTP 202 inmediatamente; el resultado llega por callback n8n.

        Returns:
            HTTP 202 — campaña creada, generación en proceso.
            HTTP 400 — errores de validación.
            HTTP 402 — sin tokens disponibles.
            HTTP 403 — rol no autorizado.
        """
        if request.user.rol != "marketero":
            return Response(
                api_response(
                    success=False,
                    message="Solo los marketeros pueden crear campañas.",
                    data={},
                ),
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CampaignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                api_response(
                    success=False,
                    message="Error de validación en los datos enviados.",
                    data={"errors": serializer.errors},
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

        campaign: Campaign = serializer.save(
            estado=CampaignStatus.BORRADOR,
            marketero=request.user,
        )

        # Recargar user para reflejar cambios de tokens hechos en el servicio
        request.user.refresh_from_db()
        resultado = trigger_ia_generation(campaign)

        # Recargar campaña — el servicio pudo haber cambiado estado y texto
        campaign.refresh_from_db()

        return Response(
            api_response(
                success=True,
                message=describir_resultado(resultado),
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_202_ACCEPTED,
        )

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """DELETE /api/campaigns/{id}/ — elimina campañas aún no enviadas al cliente."""
        campaign = self.get_object()
        can_delete = campaign.estado in [
            CampaignStatus.BORRADOR,
            CampaignStatus.GENERADO,
        ]

        if not can_delete:
            return Response(
                api_response(
                    success=False,
                    message="Solo puedes eliminar campañas en estado borrador o generado, antes de enviarlas al cliente.",
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="generate")
    def generate(self, request: Request, pk: int = None) -> Response:
        """
        POST /api/campaigns/{id}/generate/

        Dispara (o re-dispara) la generación IA para una campaña en BORRADOR.
        Máximo 3 intentos por campaña.

        Returns:
            HTTP 202 — generación en proceso.
            HTTP 402 — sin tokens disponibles.
            HTTP 409 — estado incorrecto o intentos agotados.
        """
        if request.user.rol != "marketero":
            return Response(
                api_response(success=False, message="Solo el marketero puede generar.", data={}),
                status=status.HTTP_403_FORBIDDEN,
            )

        campaign = self.get_object()

        if campaign.estado != CampaignStatus.BORRADOR:
            return Response(
                api_response(
                    success=False,
                    message=f"Solo campañas en 'borrador' pueden generarse. Estado actual: '{campaign.estado}'.",
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        if request.user.tokens_disponibles <= 0:
            return Response(
                api_response(
                    success=False,
                    message="Sin tokens disponibles. Contacta al administrador.",
                    data={"tokens_disponibles": 0},
                ),
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        request.user.refresh_from_db()
        resultado = trigger_ia_generation(campaign)
        campaign.refresh_from_db()

        if not resultado["dispatched"]:
            return Response(
                api_response(
                    success=False,
                    message=resultado.get("error", "No se pudo iniciar la generación."),
                    data={"campaign": CampaignSerializer(campaign).data},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        if resultado.get("mock"):
            message = "Contenido generado (modo mock)."
        else:
            message = "Generación IA iniciada. El resultado llegará en breve."

        return Response(
            api_response(
                success=True,
                message=message,
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="regenerate")
    def regenerate(self, request: Request, pk: int = None) -> Response:
        """
        POST /api/campaigns/{id}/regenerate/

        Regenera el contenido IA de una campaña que ya fue rechazada o falló.
        Acepta BORRADOR (fallo previo) y RECHAZADO: en este último caso aplica
        primero la transición FSM rechazado → borrador (documentada) para
        habilitar el nuevo intento. Máximo 3 intentos acumulados.

        Returns:
            HTTP 202 — regeneración en proceso.
            HTTP 402 — sin tokens disponibles.
            HTTP 409 — estado incorrecto o intentos agotados.
        """
        if request.user.rol != "marketero":
            return Response(
                api_response(success=False, message="Solo el marketero puede regenerar.", data={}),
                status=status.HTTP_403_FORBIDDEN,
            )

        campaign = self.get_object()

        if campaign.estado not in [CampaignStatus.BORRADOR, CampaignStatus.RECHAZADO]:
            return Response(
                api_response(
                    success=False,
                    message=(
                        "Solo campañas en 'borrador' o 'rechazado' pueden regenerarse. "
                        f"Estado actual: '{campaign.estado}'."
                    ),
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        if campaign.estado == CampaignStatus.RECHAZADO and campaign.rechazos_cliente_count >= 2:
            return Response(
                api_response(
                    success=False,
                    message="Esta campaña ya fue rechazada dos veces y quedó en fracaso.",
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        if request.user.tokens_disponibles <= 0:
            return Response(
                api_response(
                    success=False,
                    message="Sin tokens disponibles. Contacta al administrador.",
                    data={"tokens_disponibles": 0},
                ),
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        # Transición FSM documentada: rechazado → borrador (habilita el reintento).
        # Se hace después del check de tokens para no mutar estado en un 402.
        if campaign.estado == CampaignStatus.RECHAZADO:
            campaign.transition_to(CampaignStatus.BORRADOR)

        request.user.refresh_from_db()
        resultado = trigger_ia_generation(campaign)
        campaign.refresh_from_db()

        if not resultado["dispatched"]:
            return Response(
                api_response(
                    success=False,
                    message=resultado.get("error", "No se pudo iniciar la regeneración."),
                    data={"campaign": CampaignSerializer(campaign).data},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        if resultado.get("mock"):
            message = "Contenido regenerado (modo mock)."
        else:
            message = "Regeneración IA iniciada. El resultado llegará en breve."

        return Response(
            api_response(
                success=True,
                message=message,
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="miniatura")
    def miniatura(self, request: Request, pk: int = None) -> HttpResponse:
        """
        GET /api/campaigns/{id}/miniatura/ — JPEG de 480 px de la imagen generada.

        Para las tarjetas de la app: ~30 KB en vez de ~1,5 MB en base64. 204 si
        la campaña no tiene imagen. Solo la ve quien puede ver la campaña.
        """
        campaign = self.get_object()
        contenido = miniatura_jpeg(campaign.pk, campaign.imagen_b64)
        response = HttpResponse(contenido or b"", content_type="image/jpeg", status=200 if contenido else 204)
        response["Cache-Control"] = "private, max-age=3600"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """GET /api/campaigns/{id}/ — devuelve campaña individual con envoltura api_response."""
        campaign = self.get_object()
        return Response(
            api_response(
                success=True,
                message="Campaña obtenida.",
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """
        PATCH /api/campaigns/{id}/  {prompt?, texto_generado?, version}

        Edita el contenido con bloqueo optimista: `version` es obligatoria y debe
        ser la que el cliente leyó; si otra edición, la IA o una restauración la
        subió antes → 409 sin guardar. Solo en ESTADOS_EDITABLES (si no, 409).
        Al guardar, la versión sube una sola vez (_subir_version).
        """
        version = request.data.get("version")
        with transaction.atomic():
            campaign = get_object_or_404(self.get_queryset().select_for_update(), pk=kwargs["pk"])

            if campaign.estado not in ESTADOS_EDITABLES:
                return _no_editable(campaign)

            if not _es_entero(version):
                return Response(
                    api_response(
                        success=False,
                        message="Falta la versión de la campaña. Recarga la página e intenta de nuevo.",
                        data={"errors": {"version": ["Envía la 'version' que leíste de la campaña."]}},
                    ),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if version != campaign.version:
                return _version_desactualizada(campaign)

            serializer = CampaignEditSerializer(campaign, data=request.data, partial=True)
            if not serializer.is_valid():
                return Response(
                    api_response(
                        success=False,
                        message="Error de validación.",
                        data={"errors": serializer.errors},
                    ),
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer.save()
            _subir_version(campaign)
        return Response(
            api_response(
                success=True,
                message="Cambios guardados.",
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="improve-text")
    def improve_text(self, request: Request, pk: int = None) -> Response:
        """
        POST /api/campaigns/{id}/improve-text/

        Mejora SOLO el copy (texto_generado) con Gemini, sin tocar la imagen.
        Guarda una versión previa (historial LRU-5) antes de reemplazar. No
        consume tokens de cuota: es una edición asistida, no una generación
        nueva. Solo el marketero, solo en ESTADOS_EDITABLES y solo si ya hay
        texto generado. `version` en el body es opcional; si llega, debe
        coincidir. Gemini se llama fuera de la transacción: si mientras tanto
        la campaña cambió de versión o de estado, no se guarda nada (409).

        Returns:
            HTTP 200 — {campaign} con el texto mejorado.
            HTTP 403 — rol no autorizado.
            HTTP 409 — estado no editable, versión desactualizada o sin texto.
        """
        if request.user.rol != "marketero":
            return Response(
                api_response(success=False, message="Solo el marketero puede mejorar el copy.", data={}),
                status=status.HTTP_403_FORBIDDEN,
            )

        campaign = self.get_object()

        if campaign.estado not in ESTADOS_EDITABLES:
            return _no_editable(campaign)

        version = request.data.get("version")
        if version is not None and (not _es_entero(version) or version != campaign.version):
            return _version_desactualizada(campaign)

        if not (campaign.texto_generado or "").strip():
            return Response(
                api_response(
                    success=False,
                    message="No hay texto generado para mejorar.",
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        # Fuera de la transacción: no se bloquea la fila mientras responde Gemini.
        mejorado = improve_copy(
            texto_actual=campaign.texto_generado,
            industria=campaign.industria,
            tono=campaign.tono,
            plataforma=campaign.plataforma,
        )

        with transaction.atomic():
            actual = get_object_or_404(self.get_queryset().select_for_update(), pk=campaign.pk)
            if actual.version != campaign.version or actual.estado != campaign.estado:
                return _version_desactualizada(actual)
            # Preservar el copy actual en el historial antes de reemplazarlo.
            save_campaign_version(actual)
            actual.texto_generado = mejorado
            actual.save(update_fields=["texto_generado", "fecha_actualizacion"])
            _subir_version(actual)
        campaign = actual

        return Response(
            api_response(
                success=True,
                message="Copy mejorado con IA.",
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request: Request, pk: int = None) -> Response:
        """
        POST /api/campaigns/{id}/submit/

        Transiciona GENERADO → PENDIENTE_APROBACION.
        Solo rol marketero puede ejecutarlo.
        """
        if request.user.rol != "marketero":
            return Response(
                api_response(
                    success=False,
                    message="Solo el marketero puede enviar al cliente.",
                    data={},
                ),
                status=status.HTTP_403_FORBIDDEN,
            )

        campaign = self.get_object()

        # Cuentas donde se publicará al aprobar (opcional; sin destinos no se publica).
        destinos = request.data.get("destinos") or []
        if not isinstance(destinos, list) or not all(
            isinstance(d, int) and not isinstance(d, bool) for d in destinos
        ):
            return Response(
                api_response(success=False, message="'destinos' debe ser una lista de ids.", data={}),
                status=status.HTTP_400_BAD_REQUEST,
            )

        if campaign.estado != CampaignStatus.GENERADO:
            return Response(
                api_response(
                    success=False,
                    message=(
                        f"Solo campañas en estado 'generado' pueden enviarse. "
                        f"Estado actual: '{campaign.estado}'."
                    ),
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                campaign.transition_to(CampaignStatus.PENDIENTE_APROBACION)
                campaign.enviado_cliente_at = timezone.now()
                campaign.save(update_fields=["enviado_cliente_at", "fecha_actualizacion"])
                publicaciones = programar_publicaciones(campaign, destinos, request.user)
                transaction.on_commit(lambda: notify_campaign_submitted(campaign.id))
        except ValidationError as e:
            return Response(
                api_response(
                    success=False,
                    message=e.message,
                    data={},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DestinoInvalido as e:
            campaign.refresh_from_db()
            return Response(
                api_response(success=False, message=str(e), data={}),
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            api_response(
                success=True,
                message="Campaña enviada al cliente para aprobación.",
                data={
                    "campaign": CampaignSerializer(campaign).data,
                    "destinos": [
                        {"id": p.id, "red": p.red, "cuenta_nombre": p.cuenta_nombre, "estado": p.estado}
                        for p in publicaciones
                    ],
                },
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="recent-approved")
    def recent_approved(self, request: Request) -> Response:
        """GET /api/campaigns/recent-approved/?limit=10 — aprobadas recientes del marketero."""
        try:
            limit = int(request.query_params.get("limit", 10))
        except (TypeError, ValueError):
            limit = 10
        limit = min(max(limit, 1), 10)

        qs = (
            self.get_queryset()
            .filter(estado=CampaignStatus.APROBADO)
            .order_by(F("cliente_valoracion_at").desc(nulls_last=True), "-fecha_actualizacion")[:limit]
        )

        return Response(
            api_response(
                success=True,
                message="Campañas aprobadas recientes.",
                data={"campaigns": CampaignSerializer(qs, many=True).data},
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request: Request) -> Response:
        """
        GET /api/campaigns/stats/

        Retorna conteo de campañas agrupadas por estado y los créditos de IA
        disponibles del usuario (tokens_disponibles, para el sidebar).
        Resultado cacheado 30s en Redis por usuario; el signal post_save
        de Campaign invalida la caché cuando cambia una campaña.

        Returns:
            HTTP 200 con conteos por estado.
        """
        cache_key = f"campaign_stats_{request.user.id}"
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(
                api_response(
                    success=True,
                    message="Estadísticas de campañas.",
                    data=cached_data,
                ),
                status=status.HTTP_200_OK,
            )

        qs = self.get_queryset()
        conteos: dict[str, int] = {estado: 0 for estado in CampaignStatus.values}
        for campaign in qs.values("estado"):
            conteos[campaign["estado"]] += 1

        data = {
            "total": sum(conteos.values()),
            "tokens_disponibles": request.user.tokens_disponibles,
            **conteos,
        }
        cache.set(cache_key, data, timeout=30)

        return Response(
            api_response(
                success=True,
                message="Estadísticas de campañas.",
                data=data,
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="credits-detail")
    def credits_detail(self, request: Request) -> Response:
        """
        GET /api/campaigns/credits-detail/

        Detalle de consumo de créditos IA del usuario para la pantalla
        "Créditos de IA": saldo actual, métricas derivadas del mes en curso
        y el historial de consumo por campaña (solo datos que existen
        realmente en el modelo — sin inventar transacciones ni facturación).

        Returns:
            HTTP 200 con tokens_disponibles, métricas del mes y el listado
            de campañas (id, titulo, fecha_creacion, tokens_consumidos, estado).
        """
        qs = self.get_queryset()
        inicio_mes = timezone.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        del_mes = qs.filter(fecha_creacion__gte=inicio_mes)

        agregados_mes = del_mes.aggregate(
            consumidos=Sum("tokens_consumidos"), total=Count("id")
        )
        consumidos_mes = agregados_mes["consumidos"] or 0
        campanas_mes = agregados_mes["total"] or 0
        promedio_mes = round(consumidos_mes / campanas_mes, 1) if campanas_mes else 0

        historial = [
            {
                "id": c.id,
                "titulo": c.titulo,
                "fecha_creacion": c.fecha_creacion,
                "tokens_consumidos": c.tokens_consumidos,
                "estado": c.estado,
            }
            for c in qs.order_by("-fecha_creacion")[:50]
        ]

        return Response(
            api_response(
                success=True,
                message="Detalle de créditos de IA.",
                data={
                    "tokens_disponibles": request.user.tokens_disponibles,
                    "consumidos_mes": consumidos_mes,
                    "campanas_mes": campanas_mes,
                    "promedio_por_campana_mes": promedio_mes,
                    "historial": historial,
                },
            ),
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="credits/purchase")
    def purchase_credits(self, request: Request) -> Response:
        """
        POST /api/campaigns/credits/purchase/

        Pasarela de pago simulada para créditos de IA: siempre aprueba (no
        hay integración con un procesador real). El plan se identifica por
        una key fija (CREDIT_PLAN_MAP); el monto y los créditos NUNCA se
        leen del body para evitar que el cliente se auto-otorgue créditos.

        Body: {"plan": "basico" | "pro" | "elite"}

        Returns:
            HTTP 200 con tokens_disponibles actualizado y créditos añadidos.
            HTTP 400 si el plan no existe.
        """
        plan_key = request.data.get("plan")
        plan = CREDIT_PLAN_MAP.get(plan_key)
        if plan is None:
            return Response(
                api_response(
                    success=False,
                    message="Plan inválido.",
                    data={"planes_validos": list(CREDIT_PLAN_MAP.keys())},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            CreditPurchase.objects.create(
                usuario=request.user,
                plan_nombre=plan["nombre"],
                monto=plan["precio"],
                creditos=plan["creditos"],
            )
            agregar_creditos(request.user, plan["creditos"])

        return Response(
            api_response(
                success=True,
                message="Créditos añadidos.",
                data={
                    "tokens_disponibles": request.user.tokens_disponibles,
                    "creditos_agregados": plan["creditos"],
                    "plan": plan["nombre"],
                },
            ),
            status=status.HTTP_200_OK,
        )


class IaResultCallbackView(APIView):
    """
    POST /api/campaigns/webhook/ia-result/

    Endpoint de callback para n8n. Recibe el resultado de la generación IA
    (éxito o fallo) y actualiza el estado de la campaña en consecuencia.

    Autenticación: N8nCallbackPermission (secreto X-NexoMark-Token + el
    n8n_callback_token del intento en curso, que se rota en cada generación).
    No requiere JWT — diseñado para llamadas machine-to-machine desde n8n.
    Solo se aplica a una campaña en PENDIENTE_IA: un callback repetido o tardío
    responde 409 sin tocar contenido ni créditos.

    Body éxito:
        {n8n_callback_token, success: true, copy: str}
    Body fallo:
        {n8n_callback_token, success: false, error: str}
    """

    authentication_classes: list = []
    permission_classes = [N8nCallbackPermission]

    def post(self, request: Request) -> Response:
        """
        Procesa el resultado de generación IA enviado por n8n.

        Éxito: PENDIENTE_IA → GENERADO, guarda texto_generado y sube la versión
        (contenido nuevo: una pestaña con el copy anterior ya no puede pisarlo).
        Fallo: PENDIENTE_IA → BORRADOR, devuelve 1 token al marketero.
        Si la campaña ya no está en PENDIENTE_IA (callback repetido o tardío),
        responde 409 sin tocar contenido, créditos ni historial.
        Todo en transaction.atomic() para consistencia.
        """
        token = request.data.get("n8n_callback_token")
        success = request.data.get("success", False)

        try:
            with transaction.atomic():
                campaign = (
                    Campaign.objects.select_related("marketero")
                    .select_for_update()
                    .get(n8n_callback_token=token)
                )

                if campaign.estado != CampaignStatus.PENDIENTE_IA:
                    # Callback repetido, o tardío tras un timeout que ya devolvió
                    # el crédito: no se aplica (ni se devuelve otro crédito).
                    return Response(
                        api_response(
                            success=False,
                            message="La campaña no tiene una generación en curso.",
                            data={"campaign_id": campaign.id, "estado": campaign.estado},
                        ),
                        status=status.HTTP_409_CONFLICT,
                    )

                if success:
                    copy = request.data.get("copy", "")
                    imagen_b64 = request.data.get("imagen_b64")
                    campaign.texto_generado = copy
                    campaign.imagen_b64 = imagen_b64
                    campaign.save(update_fields=["texto_generado", "imagen_b64", "fecha_actualizacion"])
                    save_campaign_version(campaign)
                    _subir_version(campaign)
                    campaign.transition_to(CampaignStatus.GENERADO)

                    return Response(
                        api_response(
                            success=True,
                            message="Contenido IA generado y guardado.",
                            data={
                                "campaign_id": campaign.id,
                                "estado": campaign.estado,
                                "tiene_imagen": imagen_b64 is not None,
                            },
                        ),
                        status=status.HTTP_200_OK,
                    )

                # Fallo: devolver token + estado → borrador
                error_msg = request.data.get("error", "Error desconocido en n8n/Gemini.")
                campaign.ia_error_message = error_msg
                campaign.save(update_fields=["ia_error_message", "fecha_actualizacion"])

                agregar_creditos(campaign.marketero, 1)

                campaign.transition_to(CampaignStatus.BORRADOR)

                return Response(
                    api_response(
                        success=False,
                        message="Generación IA fallida. Token devuelto al usuario.",
                        data={
                            "campaign_id": campaign.id,
                            "estado": campaign.estado,
                            "error": error_msg,
                        },
                    ),
                    status=status.HTTP_200_OK,
                )

        except Campaign.DoesNotExist:
            return Response(
                api_response(success=False, message="Campaña no encontrada.", data={}),
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValidationError as e:
            return Response(
                api_response(success=False, message=str(e.message), data={}),
                status=status.HTTP_409_CONFLICT,
            )


class EmailSentCallbackView(APIView):
    """
    POST /api/campaigns/webhook/email-sent/

    Callback de n8n tras enviar email vía Resend (HU16). Solo el evento
    pendiente_aprobacion persiste flag (email_enviado=True); el workflow solo
    llama aquí para ese evento, así que HU17 (aprobado/rechazado) nunca llega.

    Autenticación: N8nCallbackPermission (secreto X-NexoMark-Token +
    n8n_callback_token de la campaña).

    Body:
        {n8n_callback_token: str, success: bool, event_type: str}
    """

    authentication_classes: list = []
    permission_classes = [N8nCallbackPermission]

    def post(self, request: Request) -> Response:
        """Marca email_enviado=True si el envío Resend fue exitoso (HU16)."""
        token = request.data.get("n8n_callback_token")
        success = bool(request.data.get("success", False))
        event_type = request.data.get("event_type")

        try:
            campaign = Campaign.objects.get(n8n_callback_token=token)
        except Campaign.DoesNotExist:
            return Response(
                api_response(success=False, message="Campaña no encontrada.", data={}),
                status=status.HTTP_404_NOT_FOUND,
            )

        if success and event_type == "pendiente_aprobacion":
            campaign.email_enviado = True
            campaign.save(update_fields=["email_enviado", "fecha_actualizacion"])

        return Response(
            api_response(
                success=True,
                message="Callback de email procesado.",
                data={"campaign_id": campaign.id, "email_enviado": campaign.email_enviado},
            ),
            status=status.HTTP_200_OK,
        )


_PERIOD_DAYS: dict[str, int] = {"week": 7, "month": 30, "quarter": 90}


class AdminAnalyticsView(APIView):
    """
    GET /api/admin/analytics/?period=week|month|quarter

    Dashboard de analytics para superadmin.
    Devuelve KPIs, campañas por marketero y distribución de estados
    para el periodo seleccionado.

    Requiere rol superadmin — HTTP 403 para cualquier otro rol.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request: Request) -> Response:
        """
        Calcula métricas agregadas de campañas para el periodo indicado.

        Query params:
            period: week | month | quarter (default: month)

        Returns:
            HTTP 200 con kpi, campanas_por_marketero, estados_globales
            y campanas_por_plataforma.
        """
        period = request.query_params.get("period", "month")
        days = _PERIOD_DAYS.get(period, 30)
        desde = timezone.now() - timedelta(days=days)

        qs = Campaign.objects.filter(fecha_creacion__gte=desde)

        # KPIs
        total = qs.count()
        aprobadas = qs.filter(estado=CampaignStatus.APROBADO).count()
        tasa = round(aprobadas / total * 100, 1) if total > 0 else 0

        duracion_avg = (
            qs.filter(estado=CampaignStatus.APROBADO)
            .annotate(
                duracion=ExpressionWrapper(
                    F("fecha_actualizacion") - F("fecha_creacion"),
                    output_field=DurationField(),
                )
            )
            .aggregate(avg=Avg("duracion"))["avg"]
        )
        dias_promedio = (
            round(duracion_avg.total_seconds() / 86400, 1) if duracion_avg else None
        )

        # Campañas por marketero
        por_marketero = list(
            qs.values("marketero__nombre")
            .annotate(total=Count("id"))
            .order_by("-total")
        )

        # Distribución de estados (todos los estados con conteo 0 si no hay datos)
        conteos: dict[str, int] = {s: 0 for s in CampaignStatus.values}
        for row in qs.values("estado").annotate(total=Count("id")):
            conteos[row["estado"]] = row["total"]

        # Campañas por plataforma (barra horizontal del panel analytics)
        por_plataforma = list(
            qs.values("plataforma")
            .annotate(total=Count("id"))
            .order_by("-total")
        )

        return Response(
            api_response(
                success=True,
                message="Analytics generadas.",
                data={
                    "periodo": period,
                    "kpi": {
                        "total_campanas": total,
                        "tasa_aprobacion": tasa,
                        "tiempo_promedio_aprobacion_dias": dias_promedio,
                    },
                    "campanas_por_marketero": [
                        {"marketero": r["marketero__nombre"], "total": r["total"]}
                        for r in por_marketero
                    ],
                    "estados_globales": [
                        {"estado": k, "total": v} for k, v in conteos.items()
                    ],
                    "campanas_por_plataforma": [
                        {"plataforma": r["plataforma"], "total": r["total"]}
                        for r in por_plataforma
                    ],
                },
            ),
            status=status.HTTP_200_OK,
        )


class CampaignVersionListView(generics.ListAPIView):
    """
    GET /api/campaigns/{campaign_id}/versions/

    Retorna las últimas 5 versiones de una campaña.
    Solo el owner o un superadmin puede acceder.
    """

    serializer_class = CampaignVersionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        campaign_id = self.kwargs['campaign_id']
        campaign = get_object_or_404(
            Campaign.objects.select_related('marketero'),
            pk=campaign_id,
        )
        user = self.request.user
        if campaign.marketero != user and user.rol != 'superadmin':
            raise PermissionDenied("No tienes acceso a esta campaña.")
        return CampaignVersion.objects.filter(campaign=campaign)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': 'Versiones obtenidas correctamente.',
            'data': serializer.data,
        })


class CampaignVersionRestoreView(APIView):
    """
    POST /api/campaigns/{campaign_id}/versions/{version_id}/restore/

    Restaura el texto e imagen de un snapshot del historial (HU23) a la campaña.
    Guarda el contenido actual como nueva versión antes de sobreescribir.
    Solo el owner (marketero) o un superadmin; solo estados editables
    (borrador/generado). No consume créditos de IA.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, campaign_id: int, version_id: int) -> Response:
        """Valida acceso y estado, delega la copia a restore_campaign_version()."""
        campaign = get_object_or_404(
            Campaign.objects.select_related("marketero"),
            pk=campaign_id,
        )
        user = request.user
        if campaign.marketero != user and user.rol != "superadmin":
            return Response(
                api_response(success=False, message="No tienes acceso a esta campaña.", data={}),
                status=status.HTTP_403_FORBIDDEN,
            )

        if campaign.estado not in [CampaignStatus.BORRADOR, CampaignStatus.GENERADO]:
            return Response(
                api_response(
                    success=False,
                    message=(
                        "Solo se puede restaurar en estados editables (borrador/generado). "
                        f"Estado actual: '{campaign.estado}'."
                    ),
                    data={},
                ),
                status=status.HTTP_409_CONFLICT,
            )

        version = get_object_or_404(CampaignVersion, pk=version_id, campaign=campaign)
        campaign = restore_campaign_version(campaign, version)
        _subir_version(campaign)

        return Response(
            api_response(
                success=True,
                message=f"Versión {version.version_number} restaurada.",
                data={"campaign": CampaignSerializer(campaign).data},
            ),
            status=status.HTTP_200_OK,
        )


def _cargar_weasyprint():
    """
    Importa WeasyPrint solo al exportar. Si la librería o sus dependencias del
    sistema (Pango, cairo) no cargan, devuelve None: el resto de la API sigue
    funcionando y el export responde 503 en vez de tumbar el módulo de vistas.
    """
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        logger.warning("WeasyPrint no disponible; export PDF deshabilitado: %s", exc)
        return None
    return HTML


class CampaignExportPDFView(APIView):
    """
    GET /api/campaigns/{campaign_id}/export-pdf/

    Genera y retorna un PDF descargable de una campaña aprobada.
    Solo el owner (marketero) de la campaña o un superadmin puede acceder.
    Requiere estado == 'aprobado'. Retorna application/pdf como attachment.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, campaign_id: int) -> HttpResponse:
        """Renderiza el template HTML de la campaña y lo convierte a PDF con WeasyPrint."""
        campaign = get_object_or_404(
            Campaign.objects.select_related("marketero"),
            pk=campaign_id,
        )
        user = request.user
        if campaign.marketero != user and user.rol != "superadmin":
            return Response(
                api_response(
                    success=False,
                    message="No tienes acceso a esta campaña.",
                    data={},
                ),
                status=status.HTTP_403_FORBIDDEN,
            )
        if campaign.estado != CampaignStatus.APROBADO:
            return Response(
                api_response(
                    success=False,
                    message="Solo se pueden exportar campañas aprobadas.",
                    data={},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        weasy_html = _cargar_weasyprint()
        if weasy_html is None:
            return Response(
                api_response(
                    success=False,
                    message=(
                        "La exportación a PDF no está disponible en este servidor "
                        "(falta WeasyPrint o sus librerías del sistema). Intenta más tarde."
                    ),
                    data={},
                ),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        context = {
            "campaign": campaign,
            "fecha_exportacion": timezone.localtime().strftime("%d/%m/%Y %H:%M"),
        }
        html_string = render_to_string("campaigns/campaign_pdf.html", context)
        try:
            pdf_bytes = weasy_html(
                string=html_string,
                base_url=request.build_absolute_uri("/"),
            ).write_pdf()
        except Exception:
            logger.exception(
                "WeasyPrint falló al renderizar PDF de la campaña %s; "
                "reintentando sin imagen.",
                campaign.id,
            )
            # imagen_b64 corrupta — regenerar sin imagen y sin romper el flujo
            original_imagen = campaign.imagen_b64
            campaign.imagen_b64 = None
            html_string_sin_imagen = render_to_string(
                "campaigns/campaign_pdf.html", context
            )
            campaign.imagen_b64 = original_imagen  # restaurar en memoria
            pdf_bytes = weasy_html(
                string=html_string_sin_imagen,
                base_url=request.build_absolute_uri("/"),
            ).write_pdf()

        safe_title = re.sub(r"[^\w\-]", "_", campaign.titulo[:40])
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="campana_{safe_title}.pdf"'
        return response


def _subir_version(campaign: Campaign) -> None:
    """
    Incrementa Campaign.version al cambiar el contenido.

    Spring usa este campo como bloqueo optimista al aprobar: si el cliente
    aprueba lo que vio antes de una edición, su aprobación se rechaza y debe
    recargar. Así lo aprobado es lo que se publica.
    """
    Campaign.objects.filter(pk=campaign.pk).update(version=F("version") + 1)
    campaign.refresh_from_db(fields=["version"])
