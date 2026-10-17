"""
NexoMark — X (Twitter) como red OPCIONAL, apagada por defecto (X_HABILITADO).

    GET    /api/social/x/config/      {habilitado, costo_post_usd, tope_mensual_usd, usados_mes, restantes, ...}
    GET    /api/social/x/connect/     URL de autorización de X con state de un solo uso y PKCE (S256)
    GET    /api/social/x/callback/    X vuelve aquí con ?code&state (sin JWT); no canjea: redirige al
                                      frontend con code y state en el fragmento (#)
    POST   /api/social/x/complete/    {code, state} con JWT: reclama el state, canjea con el code_verifier
                                      y guarda los tokens cifrados

Con X apagado todos responden 403 "X está desactivado" salvo config, que
informa habilitado=false para que la UI no muestre nada de X.
"""

import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserRole
from core.exceptions import api_response
from services import x_api, x_gasto
from services.social_tokens import TokenIlegible, cifrar

from . import oauth
from .models import ConexionEstado, ProveedorOAuth, RedSocial, SocialConnection
from .serializers import SocialConnectionSerializer

logger = logging.getLogger(__name__)

RUTA_RETORNO_X = "/redes/x-retorno"
MAX_LARGO_CODE = 4096
MENSAJE_DESACTIVADO = "X está desactivado en este servidor."


def x_habilitado() -> bool:
    return bool(settings.X_HABILITADO)


def respuesta_x_desactivado() -> Response:
    return Response(api_response(False, MENSAJE_DESACTIVADO, {"motivo": "x_desactivado"}),
                    status=status.HTTP_403_FORBIDDEN)


def _puede_conectar(usuario) -> bool:
    return usuario.rol in (UserRole.MARKETERO, UserRole.CLIENTE)


def _sin_permiso_para_conectar() -> Response:
    return Response(
        api_response(False, "Solo marketeros y clientes conectan redes.", {}),
        status=status.HTTP_403_FORBIDDEN,
    )


def _x_configurado() -> bool:
    return bool(settings.X_CLIENT_ID and settings.X_CLIENT_SECRET and settings.X_REDIRECT_URI)


def _redirigir_al_frontend(**params: str) -> HttpResponseRedirect:
    """El fragmento (#) no se envía a ningún servidor: code y state solo los lee la página del usuario."""
    response = HttpResponseRedirect(f"{settings.FRONTEND_URL.rstrip('/')}{RUTA_RETORNO_X}#{urlencode(params)}")
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


def _tope_alcanzado(mensaje: str) -> Response:
    return Response(
        api_response(False, mensaje, {"motivo": "tope", "gasto": x_gasto.estado().como_dict()}),
        status=status.HTTP_409_CONFLICT,
    )


class XConfigView(APIView):
    """Interruptor y tope de gasto. Siempre 200: con X apagado la UI no muestra nada de X."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(api_response(True, "Configuración de X.", x_gasto.estado().como_dict()))


class XConnectView(APIView):
    """URL de autorización de X con un state de un solo uso ligado al usuario y PKCE S256."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if not x_habilitado():
            return respuesta_x_desactivado()
        if not _puede_conectar(request.user):
            return _sin_permiso_para_conectar()
        if not _x_configurado():
            return Response(
                api_response(False, "La conexión con X todavía no está configurada en el servidor.", {}),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # Conectar lee el usuario (GET /2/users/me), que también cuesta: sin margen no se empieza.
        if not x_gasto.hay_margen_para_lectura():
            return _tope_alcanzado("Se alcanzó el tope mensual de gasto en X; no se puede conectar una cuenta.")
        verifier = x_api.nuevo_code_verifier()
        redirect_uri = settings.X_REDIRECT_URI
        state = oauth.iniciar(request.user, redirect_uri, proveedor=ProveedorOAuth.X, code_verifier=verifier)
        return Response(api_response(True, "Redirige al usuario a X.", {
            "url": x_api.url_autorizacion(state, verifier, redirect_uri),
        }))


class XCallbackView(APIView):
    """
    X redirige el navegador aquí (sin JWT). No se canjea el código: solo se
    comprueba que el state siga vigente y se pasa al frontend (XCompleteView).
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> HttpResponseRedirect:
        state = request.query_params.get("state", "")
        if not x_habilitado():
            return _redirigir_al_frontend(error="desactivado")
        if request.query_params.get("error"):
            oauth.cancelar(state, proveedor=ProveedorOAuth.X)
            return _redirigir_al_frontend(error="cancelado")
        if oauth.vigente_para_callback(state, proveedor=ProveedorOAuth.X) is None:
            return _redirigir_al_frontend(error="sesion")
        code = request.query_params.get("code", "")
        if not code or len(code) > MAX_LARGO_CODE:
            return _redirigir_al_frontend(error="sin_codigo")
        return _redirigir_al_frontend(code=code, state=state)


class XCompleteView(APIView):
    """El frontend presenta code + state con el JWT del usuario: recién aquí se canjea con el code_verifier."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        if not x_habilitado():
            return respuesta_x_desactivado()
        if not _puede_conectar(request.user):
            return _sin_permiso_para_conectar()
        code, state = request.data.get("code"), request.data.get("state")
        if not (isinstance(code, str) and isinstance(state, str) and code and state) or len(code) > MAX_LARGO_CODE:
            return Response(
                api_response(False, "Faltan los datos que devolvió X. Vuelve a conectar la cuenta.", {}),
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            autorizacion = oauth.reclamar(request.user, state, proveedor=ProveedorOAuth.X)
            verifier = oauth.leer_code_verifier(autorizacion)
        except oauth.AutorizacionInvalida as exc:
            logger.warning("Conexión con X rechazada para usuario %s: %s", request.user.id, exc.motivo)
            return Response(api_response(False, exc.mensaje, {"motivo": exc.motivo}), status=exc.status)
        except TokenIlegible:
            verifier = ""
        if not verifier:
            return Response(
                api_response(False, "La conexión con X se inició sin PKCE válido. Vuelve a conectar la cuenta.",
                             {"motivo": "pkce"}),
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tokens = x_api.canjear_codigo(code, verifier, autorizacion.redirect_uri)
        except x_api.XError as exc:
            logger.warning("Canje del código de X falló para usuario %s: %s", request.user.id, exc)
            return Response(
                api_response(
                    False,
                    "X rechazó la autorización (el código caduca en segundos y sirve una sola vez). "
                    "Vuelve a conectar la cuenta.",
                    {"motivo": "x"},
                ),
                status=status.HTTP_502_BAD_GATEWAY,
            )
        faltantes = _scopes_faltantes(tokens.scope)
        if faltantes:
            return Response(
                api_response(False, f"X no concedió los permisos necesarios ({', '.join(faltantes)}).",
                             {"motivo": "permisos"}),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if not x_gasto.reservar_lectura():
            return _tope_alcanzado("Se alcanzó el tope mensual de gasto en X; no se pudo leer la cuenta.")
        try:
            perfil = x_api.usuario_actual(tokens.access_token)
        except x_api.XError as exc:
            logger.warning("Lectura del usuario de X falló para usuario %s: %s", request.user.id, exc)
            return Response(
                api_response(False, f"No se pudo leer la cuenta de X: {exc}", {"motivo": "x"}),
                status=status.HTTP_502_BAD_GATEWAY,
            )

        conexion = _guardar_conexion_x(request.user, perfil, tokens)
        return Response(api_response(True, f"Se conectó {conexion.cuenta_nombre}.", {
            "conectadas": 1, "conexiones": [SocialConnectionSerializer(conexion).data],
        }))


def _scopes_faltantes(scope: str) -> list[str]:
    """X informa los scopes concedidos en `scope`; si no lo informa, no se puede comprobar aquí."""
    if not scope:
        return []
    concedidos = set(scope.split())
    return [s for s in settings.X_OAUTH_SCOPES if s not in concedidos]


def _guardar_conexion_x(usuario, perfil: dict, tokens: x_api.TokensX) -> SocialConnection:
    with transaction.atomic():
        conexion, _ = SocialConnection.objects.update_or_create(
            usuario=usuario,
            red=RedSocial.X,
            cuenta_id=perfil["id"],
            defaults={
                "cuenta_nombre": f"@{perfil['username']}"[:150],
                "pagina_id": "",
                "token_cifrado": cifrar(tokens.access_token),
                "refresh_token_cifrado": cifrar(tokens.refresh_token),
                "token_expira_at": timezone.now() + timedelta(seconds=tokens.expires_in),
                "estado": ConexionEstado.ACTIVA,
            },
        )
    return conexion
