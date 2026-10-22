"""
MarketMind IA — Authentication Serializers
Maneja registro de usuarios y JWT con campo 'role' en payload.
Criterios HU1 y HU2.
"""

from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken, Token

from .models import AuthBrandContent, FotoPerfil, User, UserRole
from .profile_avatar import normalizar_foto


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer para registro de nuevos usuarios.

    Valida:
    - Email único en BD (HU1: email duplicado → HTTP 400)
    - Formato de email válido (HU1: formato inválido → HTTP 400)
    - Registro público limitado a marketero/cliente (HTTP 400 para otros roles)
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
        choices=[
            (UserRole.MARKETERO, UserRole.MARKETERO.label),
            (UserRole.CLIENTE, UserRole.CLIENTE.label),
        ],
        error_messages={
            "invalid_choice": (
                "Rol inválido. Valores permitidos: marketero, cliente."
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
    Permite 'nombre' y la foto (multipart `avatar` o `remove_avatar`).
    El email se cambia con doble confirmación (email_change.py) y el rol
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
    avatar = serializers.FileField(required=False, write_only=True)
    remove_avatar = serializers.BooleanField(required=False, write_only=True)

    def validate_avatar(self, value) -> bytes:
        return normalizar_foto(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("remove_avatar") and "avatar" in attrs:
            raise serializers.ValidationError("No puedes subir y quitar la foto a la vez.")
        return attrs

    @transaction.atomic
    def update(self, instance: User, validated_data: dict[str, Any]) -> User:
        foto = validated_data.pop("avatar", None)
        quitar = validated_data.pop("remove_avatar", False)
        if foto is not None:
            FotoPerfil.objects.update_or_create(
                usuario=instance, defaults={"imagen": foto, "actualizada_en": timezone.now()}
            )
        elif quitar:
            FotoPerfil.objects.filter(usuario=instance).delete()
        if validated_data:
            for campo, valor in validated_data.items():
                setattr(instance, campo, valor)
            instance.save(update_fields=[*validated_data, "fecha_actualizacion"])
        return instance

    class Meta:
        model = User
        fields = ["nombre", "avatar", "remove_avatar"]


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer para cambio de contraseña del propio usuario.
    Exige la contraseña actual (evita que una sesión robada cambie la clave
    sin conocerla) y valida la nueva con AUTH_PASSWORD_VALIDATORS.
    """

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
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
        validate_password(value)
        return value

    def save(self, **kwargs: Any) -> User:
        """Setea la nueva contraseña encriptada y la persiste."""
        user: User = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
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


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Renovación del access token que respeta token_version (HU18).

    Sin esto, un refresh emitido antes de suspender la cuenta o de restablecer
    la contraseña seguía generando access tokens nuevos hasta su caducidad
    (7 días): el access nuevo fallaba después, pero la renovación no.
    Si la cuenta está inactiva o su token_version cambió → 401.
    """

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # TokenError (firma, caducidad o blacklist) lo convierte la vista en 401.
        refresh = RefreshToken(attrs["refresh"])
        user = (
            User.objects.filter(pk=refresh.get(jwt_settings.USER_ID_CLAIM), is_active=True)
            .only("token_version")
            .first()
        )
        if user is None or user.token_version != refresh.get("token_version", 0):
            raise InvalidToken("La sesión ya no es válida. Inicia sesión nuevamente.")
        return super().validate(attrs)


class UserResponseSerializer(serializers.ModelSerializer):
    """
    Serializer de solo lectura para representar datos del usuario en respuestas.
    Nunca expone campos sensibles como password o token_version.
    """

    has_avatar = serializers.SerializerMethodField()
    avatar_version = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    def _foto_actualizada(self, obj: User):
        """Una sola consulta por usuario serializado (has_avatar y avatar_version la comparten)."""
        leidas = self.__dict__.setdefault("_fotos_leidas", {})
        if obj.pk not in leidas:
            leidas[obj.pk] = (
                FotoPerfil.objects.filter(usuario_id=obj.pk).values_list("actualizada_en", flat=True).first()
            )
        return leidas[obj.pk]

    def get_has_avatar(self, obj: User) -> bool:
        return self._foto_actualizada(obj) is not None

    def get_avatar_version(self, obj: User) -> int | None:
        """Cambia cada vez que se sube una foto: sirve para que la app refresque su copia."""
        actualizada = self._foto_actualizada(obj)
        return int(actualizada.timestamp()) if actualizada else None

    def get_has_password(self, obj: User) -> bool:
        """False en cuentas creadas con Google: deben crear una con el enlace del correo."""
        return obj.has_usable_password()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "nombre",
            "rol",
            "is_active",
            "fecha_creacion",
            "tokens_disponibles",
            "has_avatar",
            "avatar_version",
            "has_password",
        ]
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
