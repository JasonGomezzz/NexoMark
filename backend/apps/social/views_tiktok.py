"""
TikTok (Sandbox): conectar la cuenta y enviar campañas aprobadas al buzón.

    GET  /api/social/tiktok/config/                    ¿está configurado? ¿dominio de medios verificado?
    GET  /api/social/tiktok/connect/?plataforma=app    URL de autorización (state de un solo uso)
    GET  /api/social/tiktok/callback/                  TikTok vuelve aquí (sin JWT); no canjea
    POST /api/social/tiktok/complete/                  {code, state} con JWT: canjea y guarda la cuenta
    GET  /api/social/tiktok/destinos/?campaign=        cuentas de TikTok para una campaña (marketero)
    POST /api/social/tiktok/enviar/                    {campaign, conexion, confirmo: true}
    POST /api/social/tiktok/estado/{id}/               consulta el estado (máximo cada 30 s)
    GET  /api/public/media/{archivo}.txt               archivo de verificación del portal de TikTok

Mismo flujo seguro que Meta y X (apps/social/oauth.py). Con los permisos
actuales TikTok no publica solo ni entrega métricas.
"""

import logging
import re
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserRole
from apps.campaigns.models import Campaign
from core.exceptions import api_response
from services import tiktok_api, tiktok_service
from services.social_tokens import TokenIlegible

from . import oauth
from .models import ProveedorOAuth
from .serializers import PublicationSerializer, SocialConnectionSerializer

logger = logging.getLogger(__name__)

RUTA_RETORNO_TIKTOK = "/redes/tiktok-retorno"
MAX_LARGO_CODE = 4096


def _redirigir(plataforma: str = "web", **params: str) -> HttpResponseRedirect:
    return oauth.redirigir_retorno(plataforma, RUTA_RETORNO_TIKTOK, "tiktok", **params)


def _entero(valor) -> int | None:
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, str) and valor.isdigit() and len(valor) <= 18:
        return int(valor)
    return None


def _no_configurado() -> Response:
    return Response(
        api_response(False, "La conexión con TikTok todavía no está configurada en el servidor.", {}),
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class TikTokConfigView(APIView):
    """Siempre 200: sin TikTok configurado, la app no ofrece conectarlo ni enviar."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(api_response(True, "Configuración de TikTok.", {
            "configurado": tiktok_api.configurado(),
            "medios_verificados": tiktok_api.medios_verificados(),
            "max_texto": tiktok_api.MAX_TEXTO_UTF16,
        }))


class TikTokConnectView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if request.user.rol not in (UserRole.MARKETERO, UserRole.CLIENTE):
            return Response(api_response(False, "Solo marketeros y clientes conectan redes.", {}),
                            status=status.HTTP_403_FORBIDDEN)
        if not tiktok_api.configurado():
            return _no_configurado()
        state = oauth.iniciar(
            request.user,
            settings.TIKTOK_REDIRECT_URI,
            proveedor=ProveedorOAuth.TIKTOK,
            plataforma=oauth.plataforma_pedida(request),
        )
        return Response(api_response(True, "Autoriza NexoMark en TikTok.", {"url": tiktok_api.url_autorizacion(state)}))


class TikTokCallbackView(APIView):
    """TikTok redirige el navegador aquí (sin JWT). No se canjea: se pasa code y state al cliente."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> HttpResponseRedirect:
        state = request.query_params.get("state", "")
        plataforma = oauth.plataforma_de(state, ProveedorOAuth.TIKTOK)
        if request.query_params.get("error"):
            oauth.cancelar(state, proveedor=ProveedorOAuth.TIKTOK)
            return _redirigir(plataforma, error="cancelado")
        if oauth.vigente_para_callback(state, proveedor=ProveedorOAuth.TIKTOK) is None:
            return _redirigir(plataforma, error="sesion")
        code = request.query_params.get("code", "")
        if not code or len(code) > MAX_LARGO_CODE:
            return _redirigir(plataforma, error="sin_codigo")
        return _redirigir(plataforma, code=code, state=state)


class TikTokCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        if request.user.rol not in (UserRole.MARKETERO, UserRole.CLIENTE):
            return Response(api_response(False, "Solo marketeros y clientes conectan redes.", {}),
                            status=status.HTTP_403_FORBIDDEN)
        code, state = request.data.get("code"), request.data.get("state")
        if not (isinstance(code, str) and isinstance(state, str) and code and state) or len(code) > MAX_LARGO_CODE:
            return Response(api_response(False, "Faltan los datos que devolvió TikTok. Vuelve a conectar.", {}),
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            oauth.reclamar(request.user, state, proveedor=ProveedorOAuth.TIKTOK)
        except oauth.AutorizacionInvalida as exc:
            return Response(api_response(False, exc.mensaje, {"motivo": exc.motivo}), status=exc.status)
        try:
            tokens, nombre = tiktok_api.canjear_codigo(code)
        except tiktok_api.TikTokError as exc:
            logger.warning("Canje de TikTok rechazado para usuario %s", request.user.id)
            return Response(api_response(False, f"{exc} Vuelve a conectar la cuenta.", {"motivo": "tiktok"}),
                            status=status.HTTP_502_BAD_GATEWAY)
        try:
            conexion = tiktok_service.guardar_conexion(request.user, tokens, nombre)
        except TokenIlegible:
            return _no_configurado()
        return Response(api_response(
            True,
            f"Se conectó {conexion.cuenta_nombre}. Conectar no envía ni publica nada.",
            {"conexiones": SocialConnectionSerializer([conexion], many=True).data},
        ))


class TikTokDestinosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if request.user.rol != UserRole.MARKETERO:
            return Response(api_response(False, "Solo el marketero envía a TikTok.", {}),
                            status=status.HTTP_403_FORBIDDEN)
        campaign_id = _entero(request.query_params.get("campaign"))
        if campaign_id is None:
            return Response(api_response(False, "Indica la campaña.", {}), status=status.HTTP_400_BAD_REQUEST)
        campaign = get_object_or_404(Campaign, pk=campaign_id, marketero=request.user)
        return Response(api_response(True, "Cuentas de TikTok disponibles.", {
            "conexiones": SocialConnectionSerializer(tiktok_service.cuentas_disponibles(campaign), many=True).data,
        }))


class TikTokEnviarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        if request.user.rol != UserRole.MARKETERO:
            return Response(api_response(False, "Solo el marketero envía a TikTok.", {}),
                            status=status.HTTP_403_FORBIDDEN)
        if request.data.get("confirmo") is not True:
            return Response(api_response(False, "Confirma que revisaste la imagen y el texto antes de enviar.", {}),
                            status=status.HTTP_400_BAD_REQUEST)
        campaign_id, conexion_id = _entero(request.data.get("campaign")), _entero(request.data.get("conexion"))
        if campaign_id is None or conexion_id is None:
            return Response(api_response(False, "Indica la campaña y la cuenta de TikTok.", {}),
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            publicacion, nueva = tiktok_service.enviar(campaign_id, conexion_id, request.user)
        except tiktok_service.EnvioNoPermitido as exc:
            return Response(api_response(False, exc.mensaje, {}), status=exc.status)
        if not nueva:
            mensaje = "Esta campaña ya se envió a esa cuenta: no se reenvía."
        elif publicacion.resultado_incierto:
            mensaje = tiktok_service.MENSAJE_INCIERTO
        elif publicacion.error:
            mensaje = publicacion.error
        else:
            mensaje = "Enviada a TikTok. Cuando llegue al buzón, termina de publicarla en la app de TikTok."
        return Response(
            api_response(True, mensaje, {"publicacion": PublicationSerializer(publicacion).data, "nueva": nueva}),
            status=status.HTTP_201_CREATED if nueva else status.HTTP_200_OK,
        )


class TikTokEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: int) -> Response:
        try:
            publicacion, aviso = tiktok_service.consultar(pk, request.user)
        except tiktok_service.EnvioNoPermitido as exc:
            return Response(api_response(False, exc.mensaje, {}), status=exc.status)
        return Response(api_response(True, aviso or "Estado del envío a TikTok.", {
            "publicacion": PublicationSerializer(publicacion).data,
        }))


class TikTokVerificacionView(APIView):
    """
    Archivo con el que el portal de TikTok comprueba que el prefijo de medios es nuestro.

    Solo se sirve el archivo exacto de TIKTOK_VERIFICATION_FILE (nunca un directorio),
    bajo /api/public/media/, que es el prefijo que TikTok descarga.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request: Request, archivo: str) -> HttpResponse:
        configurado = settings.TIKTOK_VERIFICATION_FILE
        nombre = f"{archivo}.txt"
        if not configurado or not re.fullmatch(r"tiktok[A-Za-z0-9]{16,128}\.txt", nombre):
            raise Http404
        origen = Path(configurado)
        if origen.name != nombre:
            raise Http404
        try:
            if origen.is_symlink() or not origen.is_file() or not 0 < origen.stat().st_size <= 4096:
                raise Http404
            contenido = origen.read_bytes()
        except OSError:
            raise Http404 from None
        response = HttpResponse(contenido, content_type="text/plain; charset=utf-8")
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
