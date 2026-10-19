"""
MarketMind IA — Authentication Serializers
Maneja registro de usuarios y JWT con campo 'role' en payload.
Criterios HU1 y HU2.
"""

from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import Token, RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import AuthBrandContent, EmailChangeRequest, User, UserRole


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = RefreshToken(attrs['refresh'])
        user = User.objects.filter(pk=token.get('user_id'), is_active=True).first()
        if user is None or user.token_version != token.get('token_version', 0):
            raise InvalidToken('La sesión ya no es válida. Inicia sesión nuevamente.')
        return super().validate(attrs)


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer para registro de nuevos usuarios.

    Valida:
    - Email único en BD (HU1: email duplicado → HTTP 400)
    - Formato de email válido (HU1: formato inválido → HTTP 400)
    - Registro público solo permite marketero y cliente (otros roles → HTTP 400)
    - Password mínimo 8 caracteres (HU1: password corto → HTTP 400)
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "min_length": "La contraseña debe tener al menos 8 caracteres.",
        },
    )
    rol = serializers.ChoiceField(
        # Los roles administrativos se crean solo por mecanismos de confianza,
        # nunca desde el registro público, aunque el cliente altere el JSON.
        choices=[
            (UserRole.MARKETERO.value, UserRole.MARKETERO.label),
            (UserRole.CLIENTE.value, UserRole.CLIENTE.label),
        ],
        error_messages={
            "invalid_choice": (
                "El registro público solo permite los roles marketero y cliente."
            ),
        },
    )

    class Meta:
        model = User
        fields = ["email", "nombre", "password", "rol"]
        extra_kwargs = {
            "email": {
                "error_messages": {
                    "invalid": "El formato del email es inválido.",
                    "unique": "El email ya está en uso.",
                }
            },
        }

    def validate_password(self, value: str) -> str:
        """
        Aplica los validadores de Django configurados en AUTH_PASSWORD_VALIDATORS.

        Args:
            value: Contraseña en texto plano.

        Returns:
            La contraseña si pasa todas las validaciones.

        Raises:
            ValidationError: Si la contraseña no cumple los requisitos.
        """
        validate_password(value)
        return value

    def create(self, validated_data: dict[str, Any]) -> User:
        """
        Crea el usuario llamando al manager que encripta la contraseña.

        Args:
            validated_data: Datos validados del serializer.

        Returns:
            Instancia del usuario creado en BD.
        """
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            nombre=validated_data["nombre"],
            rol=validated_data["rol"],
        )


class UpdateProfileSerializer(serializers.ModelSerializer):
    """
    Serializer para que el usuario autenticado edite su propio perfil.
    Solo permite 'nombre' — email es el identificador de login y el rol
    lo administra el SuperAdmin (HU18); no se exponen aquí.
    """

    nombre = serializers.CharField(
        min_length=2,
        max_length=150,
        error_messages={
            "min_length": "El nombre debe tener al menos 2 caracteres.",
            "blank": "El nombre no puede estar vacío.",
        },
    )

    class Meta:
        model = User
        fields = ["nombre"]


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer para cambio de contraseña del propio usuario.
    Exige la contraseña actual (evita que una sesión robada cambie la clave
    sin conocerla) y valida la nueva con AUTH_PASSWORD_VALIDATORS.
    """

    current_password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=128,
        trim_whitespace=False,
        error_messages={
            "min_length": "La nueva contraseña debe tener al menos 8 caracteres.",
        },
    )

    def validate_current_password(self, value: str) -> str:
        """Verifica que la contraseña actual sea correcta."""
        user: User = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate_new_password(self, value: str) -> str:
        """Aplica los validadores de Django a la nueva contraseña."""
        user = self.context['request'].user
        validate_password(value, user=user)
        if user.check_password(value):
            raise serializers.ValidationError('La nueva contraseña debe ser diferente a la actual.')
        return value

    @transaction.atomic
    def save(self, **kwargs: Any) -> User:
        """Recheck under lock and revoke sessions in the same transaction."""
        session_user = self.context['request'].user
        user = User.objects.select_for_update().get(pk=session_user.pk)
        if not user.is_active or user.token_version != session_user.token_version:
            raise AuthenticationFailed('La sesión ya no es válida. Inicia sesión nuevamente.')
        if not user.check_password(self.validated_data['current_password']):
            raise serializers.ValidationError({'current_password': ['La contraseña actual es incorrecta.']})
        user.set_password(self.validated_data["new_password"])
        user.token_version += 1
        user.save(update_fields=['password', 'token_version', 'fecha_actualizacion'])
        EmailChangeRequest.objects.filter(owner=user).delete()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extiende simplejwt para incluir el campo 'role' en el payload del JWT.

    Criterio HU2: Login → access_token + refresh_token + role en payload.
    """

    @classmethod
    def get_token(cls, user: User) -> Token:
        """
        Agrega claims personalizados al token JWT.

        Args:
            user: Instancia del usuario autenticado.

        Returns:
            Token JWT con claims adicionales: role, nombre, token_version.
        """
        token = super().get_token(user)

        # Claims adicionales en el payload
        token["role"] = user.rol
        token["nombre"] = user.nombre
        token["token_version"] = user.token_version  # Para invalidación en HU18

        return token

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """
        Agrega campos extra a la respuesta del login.

        Args:
            attrs: Credenciales del usuario.

        Returns:
            Dict con access, refresh, role y nombre del usuario.
        """
        data = super().validate(attrs)

        # Info extra en la respuesta (no solo en el payload del token)
        data["role"] = self.user.rol
        data["nombre"] = self.user.nombre

        return data


class UserResponseSerializer(serializers.ModelSerializer):
    """
    Serializer de solo lectura para representar datos del usuario en respuestas.
    Nunca expone campos sensibles como password o token_version.
    """

    class Meta:
        model = User
        fields = ["id", "email", "nombre", "rol", "is_active", "fecha_creacion", "tokens_disponibles"]
        read_only_fields = fields


class AuthBrandContentSerializer(serializers.ModelSerializer):
    """Serializer público para el panel lateral de Login/Register."""

    class Meta:
        model = AuthBrandContent
        fields = ["screen", "quote", "person_name", "person_role", "person_image"]
        read_only_fields = fields


class AdminUserUpdateSerializer(serializers.Serializer):
    """
    Serializer de escritura para PATCH /api/admin/users/{id}/ (HU18).
    Solo permite cambiar is_active — suspender o reactivar la cuenta.
    """

    is_active = serializers.BooleanField(required=True)
