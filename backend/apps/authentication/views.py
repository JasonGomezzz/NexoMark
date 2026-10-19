"""
MarketMind IA — Authentication Views
Endpoints: POST /api/auth/register/ y POST /api/auth/logout/
Token endpoints provistos por simplejwt directamente en urls.py.
"""

from typing import Any

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import api_response
from .serializers import (
    AuthBrandContentSerializer,
    ChangePasswordSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserResponseSerializer,
)
from .models import AuthBrandContent
from .throttles import RegisterRateThrottle
from .password_reset import RecoveryAPIView
from .password_security import PasswordChangeThrottle, notify_password_changed


class RegisterView(APIView):
    """
    POST /api/auth/register/

    Registra un nuevo usuario en el sistema.
    Acceso público (no requiere autenticación).

    Criterios HU1:
    - Email único → HTTP 400 "El email ya está en uso"
    - Email inválido → HTTP 400 campo específico
    - Rol inválido → HTTP 400 con valores válidos
    - Password < 8 chars → HTTP 400 política de contraseñas
    - Datos correctos → HTTP 201
    """

    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]  # 5 intentos / 10 min

    def post(self, request: Request) -> Response:
        """
        Registra un nuevo usuario.

        Args:
            request: Request con body {email, nombre, password, rol}.

        Returns:
            Response HTTP 201 con datos del usuario creado.
            Response HTTP 400 si hay errores de validación.
        """
        serializer = RegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                api_response(
                    success=False,
                    message="Error de validación en los datos enviados.",
                    data=serializer.errors,
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        user_data = UserResponseSerializer(user).data

        return Response(
            api_response(
                success=True,
                message="Usuario registrado exitosamente.",
                data={"user": user_data},
            ),
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Invalida el refresh token del usuario (JWT Blacklist).
    Requiere autenticación con access token válido.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        """
        Agrega el refresh token a la blacklist de simplejwt.

        Args:
            request: Request con body {refresh: "<refresh_token>"}.

        Returns:
            Response HTTP 200 si el logout fue exitoso.
            Response HTTP 400 si el token es inválido.
        """
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                api_response(
                    success=False,
                    message="Se requiere el refresh token para hacer logout.",
                    data={},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                api_response(
                    success=True,
                    message="Sesión cerrada exitosamente.",
                    data={},
                ),
                status=status.HTTP_200_OK,
            )
        except TokenError:
            return Response(
                api_response(
                    success=False,
                    message="Token inválido o expirado.",
                    data={},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )


class MeView(APIView):
    """
    GET /api/auth/me/    — datos del usuario autenticado.
    PATCH /api/auth/me/  — edita el propio perfil (solo 'nombre').
    tokens_disponibles cambia tras cada generación — no puede leerse del JWT.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = UserResponseSerializer(request.user)
        return Response(
            api_response(
                success=True,
                message="Datos del usuario autenticado.",
                data={"user": serializer.data},
            ),
            status=status.HTTP_200_OK,
        )

    def patch(self, request: Request) -> Response:
        """
        Actualiza el perfil del usuario autenticado.

        Args:
            request: Request con body {nombre}.

        Returns:
            HTTP 200 con el usuario actualizado, o HTTP 400 con errores de campo.
        """
        serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                api_response(success=False, message="Datos inválidos.", data=serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = serializer.save()
        return Response(
            api_response(
                success=True,
                message="Perfil actualizado.",
                data={"user": UserResponseSerializer(user).data},
            ),
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(RecoveryAPIView):
    """
    POST /api/auth/me/change-password/

    Cambia la contraseña del propio usuario. Exige la contraseña actual.
    Invalida todos los JWT anteriores y avisa al correo registrado.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordChangeThrottle]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def post(self, request: Request) -> Response:
        """
        Cambia la contraseña.

        Args:
            request: Request con body {current_password, new_password}.

        Returns:
            HTTP 200 si cambió, o HTTP 400 con errores de validación.
        """
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                api_response(success=False, message="Datos inválidos.", data=serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = serializer.save()
        notified = notify_password_changed(user.email)
        message = 'Contraseña actualizada. Se cerraron las sesiones anteriores. Inicia sesión con tu nueva contraseña.'
        if not notified:
            message += ' No se pudo enviar el aviso por correo; la contraseña sí se cambió.'
        return Response(
            api_response(success=True, message=message, data={'notification_sent': notified, 'reauthentication_required': True}),
            status=status.HTTP_200_OK,
        )


class AuthBrandContentView(APIView):
    """
    GET /api/auth/brand-content/?screen=login|register

    Devuelve contenido público para el panel visual de auth. No requiere JWT.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        screen = request.query_params.get("screen", AuthBrandContent.Screen.LOGIN)
        if screen not in AuthBrandContent.Screen.values:
            return Response(
                api_response(
                    success=False,
                    message="Pantalla inválida.",
                    data={"screen": f"Valores permitidos: {', '.join(AuthBrandContent.Screen.values)}"},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = AuthBrandContent.objects.filter(screen=screen).first()
        if content is None:
            return Response(
                api_response(success=False, message="Contenido no configurado.", data={}),
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            api_response(
                success=True,
                message="Contenido de marca obtenido.",
                data={"content": AuthBrandContentSerializer(content).data},
            ),
            status=status.HTTP_200_OK,
        )
