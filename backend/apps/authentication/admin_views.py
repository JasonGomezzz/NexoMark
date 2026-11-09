"""
MarketMind IA — Admin Views (HU18)
Endpoints de gestión de usuarios para SuperAdmin:
- GET    /api/admin/users/                 → lista paginada
- PATCH  /api/admin/users/{id}/            → suspender/reactivar + invalidar JWT
- PATCH  /api/admin/users/{id}/reset-quota → tokens_disponibles = cuota del plan
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import api_response
from services.credit_service import cuota_del_plan

from .models import User
from .permissions import IsSuperAdmin
from .serializers import AdminUserUpdateSerializer, UserResponseSerializer


class AdminUsersListView(generics.ListAPIView):
    """
    GET /api/admin/users/

    Lista paginada de TODOS los usuarios del sistema. Solo accesible para
    SuperAdmin. Respuesta con shape DRF estándar: {count, next, previous, results}.
    """

    queryset = User.objects.all().order_by("-fecha_creacion")
    serializer_class = UserResponseSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]


class AdminUserDetailView(APIView):
    """
    PATCH /api/admin/users/{id}/

    Suspende o reactiva una cuenta. Al cambiar is_active se incrementa
    token_version del usuario para invalidar todos sus JWT vigentes —
    el siguiente request del usuario afectado caerá en HTTP 403 por
    TokenVersionPermission.

    SuperAdmin no puede modificar su propia cuenta (HTTP 400).
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request: Request, pk: int) -> Response:
        """
        Args:
            request: Request con body {is_active: bool}.
            pk: ID del usuario a modificar.

        Returns:
            HTTP 200 con el usuario actualizado.
            HTTP 400 si el admin se intenta modificar a sí mismo o datos inválidos.
            HTTP 404 si el usuario no existe.
        """
        if request.user.pk == pk:
            return Response(
                api_response(
                    success=False,
                    message="No puedes modificar tu propia cuenta.",
                    data={},
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_object_or_404(User, pk=pk)
        serializer = AdminUserUpdateSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(
                api_response(
                    success=False,
                    message="Datos inválidos.",
                    data=serializer.errors,
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user.is_active = serializer.validated_data["is_active"]
            user.token_version += 1  # Invalida JWTs vigentes
            user.save(update_fields=["is_active", "token_version", "fecha_actualizacion"])

        accion = "reactivado" if user.is_active else "suspendido"
        return Response(
            api_response(
                success=True,
                message=f"Usuario {accion} exitosamente.",
                data={"user": UserResponseSerializer(user).data},
            ),
            status=status.HTTP_200_OK,
        )


class AdminResetQuotaView(APIView):
    """
    PATCH /api/admin/users/{id}/reset-quota/

    Resetea tokens_disponibles a la cuota del plan del usuario (Freelance 100,
    Agencia 400, Agencia Plus 1000). No modifica token_version porque
    no es un cambio de estado de seguridad — el usuario sigue autenticado.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request: Request, pk: int) -> Response:
        """
        Args:
            request: Request del SuperAdmin (sin body).
            pk: ID del usuario al que se le resetea la cuota.

        Returns:
            HTTP 200 con el usuario actualizado.
            HTTP 404 si el usuario no existe.
        """
        user = get_object_or_404(User, pk=pk)
        user.tokens_disponibles = cuota_del_plan(user.plan_key)
        user.save(update_fields=["tokens_disponibles", "fecha_actualizacion"])

        return Response(
            api_response(
                success=True,
                message=f"Cuota reseteada a {user.tokens_disponibles} créditos.",
                data={"user": UserResponseSerializer(user).data},
            ),
            status=status.HTTP_200_OK,
        )
