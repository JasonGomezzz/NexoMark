"""
MarketMind Voice — Endpoints de redes sociales.

    GET    /api/social/meta/connect/                 URL de autorización de Meta (marketero o cliente)
    GET    /api/social/meta/callback/                Meta vuelve aquí con ?code&state (sin JWT); no canjea:
                                                     redirige al frontend con code y state en el fragmento (#)
    POST   /api/social/meta/complete/                {code, state} con JWT: valida el state y canjea el código
    GET    /api/social/connections/                  cuentas que conectó el usuario
    GET    /api/social/connections/destinos/?cliente_email=   destinos posibles al enviar (marketero)
    DELETE /api/social/connections/{id}/             desconectar
    GET    /api/social/publications/?campaign={id}&estado=&anio=   historial con la última foto de métricas
    POST   /api/social/publications/{id}/publish/    publicar ahora / reintentar
    GET    /api/social/publications/{id}/stats/?refresh=1     métricas de una publicación (+ historial)
    GET    /api/social/publications/summary/?anio=    totales por red y series mensuales (dashboard)
    POST   /api/social/publications/refresh/          actualiza desde Meta las 20 publicadas más recientes
    GET    /api/public/media/{token}.jpg             imagen aprobada para Meta (firmada, caduca)
    POST   /api/internal/campaign-events/approved    aviso de Spring tras aprobar (token interno)
"""

import hmac
import logging

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserRole
from core.exceptions import api_response
from services import meta_graph, public_media
from services.metrics_service import (
    MetricasNoDisponibles,
    con_ultima_metrica,
    del_anio,
    refrescar_metricas,
    refrescar_recientes,
    resumen_por_red,
)
from services.publication_service import (
    PublicacionNoPermitida,
    conexiones_disponibles,
    publicar_campana_aprobada,
    reintentar_publicacion,
    una_por_cuenta,
)
from services.social_tokens import cifrar

from . import oauth
from .models import ConexionEstado, ProveedorOAuth, PublicacionEstado, Publication, RedSocial, SocialConnection
from .serializers import (
    PublicationDetailSerializer,
    PublicationMetricSerializer,
    PublicationSerializer,
    SocialConnectionSerializer,
)

logger = logging.getLogger(__name__)

RUTA_RETORNO_META = "/redes/meta-retorno"
MAX_LARGO_CODE = 4096


class AnioInvalido(Exception):
    pass


def _anio(request: Request) -> int | None:
    """?anio=2026 del dashboard. Ausente: sin filtro (la app Android no lo envía)."""
    valor = request.query_params.get("anio")
    if valor in (None, ""):
        return None
    try:
        anio = int(valor)
    except ValueError:
        raise AnioInvalido from None
    if not 2000 <= anio <= 2100:
        raise AnioInvalido
    return anio


def _anio_invalido() -> Response:
    return Response(api_response(False, "El año no es válido.", {}), status=status.HTTP_400_BAD_REQUEST)


def _puede_conectar(usuario) -> bool:
    return usuario.rol in (UserRole.MARKETERO, UserRole.CLIENTE)


def _sin_permiso_para_conectar() -> Response:
    return Response(
        api_response(False, "Solo marketeros y clientes conectan redes.", {}),
        status=status.HTTP_403_FORBIDDEN,
    )


def _redirigir_al_frontend(plataforma: str = "web", **params: str) -> HttpResponseRedirect:
    """A la página web de retorno o a la app (nexomark://oauth/meta), con code y state en el fragmento."""
    return oauth.redirigir_retorno(plataforma, RUTA_RETORNO_META, "meta", **params)


class MetaConnectView(APIView):
    """Devuelve la URL del diálogo de Meta con un state de un solo uso ligado al usuario."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if not _puede_conectar(request.user):
            return _sin_permiso_para_conectar()
        if not (settings.META_APP_ID and settings.META_APP_SECRET):
            return Response(
                api_response(False, "La conexión con Meta todavía no está configurada en el servidor.", {}),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        redirect_uri = settings.META_REDIRECT_URI
        state = oauth.iniciar(request.user, redirect_uri, plataforma=oauth.plataforma_pedida(request))
        return Response(api_response(True, "Redirige al usuario a Meta.", {
            "url": meta_graph.url_autorizacion(state, redirect_uri),
        }))


class MetaCallbackView(APIView):
    """
    Meta redirige el navegador aquí (sin JWT). No se canjea el código ni se sabe
    quién es el usuario: solo se comprueba que el state siga vigente y se pasa
    al frontend, que lo completa con la sesión del usuario (MetaCompleteView).
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> HttpResponseRedirect:
        state = request.query_params.get("state", "")
        plataforma = oauth.plataforma_de(state, ProveedorOAuth.META)
        if request.query_params.get("error"):
            oauth.cancelar(state)
            return _redirigir_al_frontend(plataforma, error="cancelado")
        if oauth.vigente_para_callback(state) is None:
            return _redirigir_al_frontend(plataforma, error="sesion")
        code = request.query_params.get("code", "")
        if not code or len(code) > MAX_LARGO_CODE:
            return _redirigir_al_frontend(plataforma, error="sin_codigo")
        return _redirigir_al_frontend(plataforma, code=code, state=state)


class MetaCompleteView(APIView):
    """El frontend presenta code + state con el JWT del usuario: recién aquí se canjea el código."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        if not _puede_conectar(request.user):
            return _sin_permiso_para_conectar()
        code, state = request.data.get("code"), request.data.get("state")
        if not (isinstance(code, str) and isinstance(state, str) and code and state) or len(code) > MAX_LARGO_CODE:
            return Response(
                api_response(False, "Faltan los datos que devolvió Meta. Vuelve a conectar la cuenta.", {}),
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            autorizacion = oauth.reclamar(request.user, state)
        except oauth.AutorizacionInvalida as exc:
            logger.warning("Conexión con Meta rechazada para usuario %s: %s", request.user.id, exc.motivo)
            return Response(api_response(False, exc.mensaje, {"motivo": exc.motivo}), status=exc.status)

        try:
            token_usuario = meta_graph.canjear_codigo(code, autorizacion.redirect_uri)
            paginas = meta_graph.paginas_con_instagram(token_usuario)
        except meta_graph.MetaError as exc:
            logger.warning("Canje del código de Meta falló para usuario %s: %s", request.user.id, exc)
            return Response(
                api_response(
                    False,
                    "Meta rechazó la autorización (el código caduca en minutos y sirve una sola vez). "
                    "Vuelve a conectar la cuenta.",
                    {"motivo": "meta"},
                ),
                status=status.HTTP_502_BAD_GATEWAY,
            )

        conexiones = _guardar_conexiones(request.user, paginas)
        if not conexiones:
            return Response(
                api_response(
                    False,
                    "Meta no devolvió páginas. En el diálogo de permisos marca tu página de Facebook "
                    "(y su cuenta de Instagram).",
                    {"motivo": "sin_paginas"},
                ),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        cantidad = len(conexiones)
        return Response(api_response(
            True,
            "Se conectó 1 cuenta." if cantidad == 1 else f"Se conectaron {cantidad} cuentas.",
            {"conectadas": cantidad, "conexiones": SocialConnectionSerializer(conexiones, many=True).data},
        ))


def _guardar_conexiones(usuario, paginas: list[dict]) -> list[SocialConnection]:
    conexiones = []
    with transaction.atomic():
        for pagina in paginas:
            token = pagina.get("access_token")
            if not token or not pagina.get("id"):
                continue
            token_cifrado = cifrar(token)
            conexiones.append(_guardar(usuario, RedSocial.FACEBOOK, pagina["id"], pagina.get("name", ""),
                                       pagina["id"], token_cifrado))
            instagram = pagina.get("instagram_business_account")
            if instagram and instagram.get("id"):
                conexiones.append(_guardar(usuario, RedSocial.INSTAGRAM, instagram["id"],
                                           f"@{instagram.get('username', instagram['id'])}", pagina["id"],
                                           token_cifrado))
    return conexiones


def _guardar(usuario, red: str, cuenta_id: str, nombre: str, pagina_id: str, token_cifrado: str) -> SocialConnection:
    conexion, _ = SocialConnection.objects.update_or_create(
        usuario=usuario,
        red=red,
        cuenta_id=cuenta_id,
        defaults={
            "cuenta_nombre": nombre[:150],
            "pagina_id": pagina_id,
            "token_cifrado": token_cifrado,
            "estado": ConexionEstado.ACTIVA,
        },
    )
    return conexion


class SocialConnectionViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SocialConnectionSerializer

    def get_queryset(self):
        return SocialConnection.objects.filter(usuario=self.request.user).select_related("usuario")

    def list(self, request: Request) -> Response:
        conexiones = self.get_queryset().filter(estado=ConexionEstado.ACTIVA)
        if not settings.X_HABILITADO:
            # X apagada: la UI no muestra nada de X (las conexiones quedan guardadas).
            conexiones = conexiones.exclude(red=RedSocial.X)
        return Response(api_response(True, "Cuentas conectadas.", {
            "conexiones": SocialConnectionSerializer(conexiones, many=True).data,
        }))

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        conexion = get_object_or_404(self.get_queryset(), pk=pk)
        conexion.estado = ConexionEstado.DESCONECTADA
        conexion.token_cifrado = ""
        conexion.save(update_fields=["estado", "token_cifrado", "fecha_actualizacion"])
        return Response(api_response(True, "Cuenta desconectada.", {}))

    @action(detail=False, methods=["get"], url_path="destinos")
    def destinos(self, request: Request) -> Response:
        """Cuentas donde se publica automáticamente al aprobar. Nunca incluye X (va aparte, con su variante)."""
        if request.user.rol != UserRole.MARKETERO:
            return Response(
                api_response(False, "Solo el marketero elige destinos.", {}),
                status=status.HTTP_403_FORBIDDEN,
            )
        cliente_email = request.query_params.get("cliente_email")
        # La misma cuenta conectada por cliente y marketero se ofrece una vez (la del cliente).
        conexiones = una_por_cuenta(conexiones_disponibles(request.user, cliente_email), cliente_email)
        return Response(api_response(True, "Destinos disponibles.", {
            "conexiones": SocialConnectionSerializer(conexiones, many=True).data,
        }))


class PublicationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PublicationSerializer

    def get_queryset(self):
        """Cada rol ve lo suyo: superadmin todo, marketero sus campañas, cliente las dirigidas a su email."""
        qs = Publication.objects.select_related("campaign", "campaign__marketero")
        usuario = self.request.user
        if usuario.rol == UserRole.SUPERADMIN:
            return qs
        if usuario.rol == UserRole.CLIENTE:
            return qs.filter(campaign__cliente_email__iexact=usuario.email)
        return qs.filter(campaign__marketero=usuario)

    def list(self, request: Request) -> Response:
        qs = self.get_queryset()
        campaign_id = request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        estado = request.query_params.get("estado")
        if estado in PublicacionEstado.values:
            qs = qs.filter(estado=estado)
        red = request.query_params.get("red")
        if red in RedSocial.values:
            qs = qs.filter(red=red)
        try:
            anio = _anio(request)
        except AnioInvalido:
            return _anio_invalido()
        if anio is not None:
            qs = del_anio(qs, anio)
        qs = con_ultima_metrica(qs.order_by("-publicado_at", "-fecha_creacion"))[:100]
        return Response(api_response(True, "Publicaciones.", {
            "publicaciones": PublicationSerializer(qs, many=True).data,
        }))

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request: Request, pk: str | None = None) -> Response:
        """Métricas de una publicación. ?refresh=1 consulta a Meta si la última foto tiene más de 10 min."""
        publicacion = get_object_or_404(self.get_queryset().select_related("conexion"), pk=pk)
        aviso = ""
        if request.query_params.get("refresh") in ("1", "true"):
            try:
                refrescar_metricas(publicacion)
            except MetricasNoDisponibles as exc:
                aviso = str(exc)
        historial = publicacion.metricas.order_by("-obtenida_at")[:20]
        return Response(api_response(True, aviso or "Estadísticas de la publicación.", {
            "publicacion": PublicationDetailSerializer(publicacion).data,
            "historial": PublicationMetricSerializer(historial, many=True).data,
            "aviso": aviso,
        }))

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request: Request) -> Response:
        """Dashboard: publicaciones y totales por red con la última foto de cada publicación."""
        try:
            anio = _anio(request)
        except AnioInvalido:
            return _anio_invalido()
        return Response(api_response(True, "Resumen por red.", resumen_por_red(self.get_queryset(), anio)))

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request: Request) -> Response:
        """Botón "Actualizar métricas" del dashboard. Respeta el intervalo mínimo por publicación."""
        resultado = refrescar_recientes(self.get_queryset())
        return Response(api_response(True, "Métricas actualizadas.", resultado))

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request: Request, pk: str | None = None) -> Response:
        if request.user.rol != UserRole.MARKETERO:
            return Response(
                api_response(False, "Solo el marketero de la campaña puede publicarla.", {}),
                status=status.HTTP_403_FORBIDDEN,
            )
        publicacion = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            publicacion = reintentar_publicacion(publicacion, request.user)
        except PublicacionNoPermitida as exc:
            return Response(api_response(False, str(exc), {}), status=status.HTTP_409_CONFLICT)
        ok = publicacion.estado == "publicado"
        return Response(
            api_response(ok, "Publicado." if ok else "No se pudo publicar.", {
                "publicacion": PublicationSerializer(publicacion).data,
            }),
            status=status.HTTP_200_OK if ok else status.HTTP_502_BAD_GATEWAY,
        )


class PublicMediaView(APIView):
    """Imagen aprobada en JPEG para que Meta la descargue. Pública, firmada y con caducidad."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request: Request, token: str) -> HttpResponse:
        try:
            publication_id = public_media.leer_firma(token)
        except (signing.BadSignature, ValueError):
            return HttpResponse(status=404)
        publicacion = Publication.objects.filter(pk=publication_id).only("imagen_aprobada_b64").first()
        if publicacion is None:
            return HttpResponse(status=404)
        try:
            jpeg = public_media.a_jpeg(publicacion.imagen_aprobada_b64)
        except public_media.ImagenNoDisponible:
            return HttpResponse(status=404)
        response = HttpResponse(jpeg, content_type="image/jpeg")
        response["Cache-Control"] = "private, max-age=300"
        return response


class InternalApprovedEventView(APIView):
    """Spring avisa, después de su commit, que el cliente aprobó la campaña."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        token = request.headers.get("X-Internal-Event-Token", "")
        esperado = settings.INTERNAL_EVENT_TOKEN
        # Un token vacío nunca autentica (compare_digest("", "") sería verdadero).
        if not esperado or not hmac.compare_digest(token.encode(), esperado.encode()):
            return Response(api_response(False, "Token interno inválido.", {}), status=status.HTTP_403_FORBIDDEN)
        try:
            campaign_id = int(request.data.get("campaignId"))
        except (TypeError, ValueError):
            return Response(api_response(False, "campaignId inválido.", {}), status=status.HTTP_400_BAD_REQUEST)
        resumen = publicar_campana_aprobada(campaign_id)
        return Response(api_response(True, "Evento procesado.", {
            "publicadas": resumen.publicadas, "fallidas": resumen.fallidas, "omitidas": resumen.omitidas,
        }))
