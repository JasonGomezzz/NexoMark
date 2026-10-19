"""
MarketMind IA — Authentication Models
Define el modelo User customizado con roles superadmin/marketero/cliente.
Criterios HU1: registro con roles, email único, password bcrypt.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.conf import settings
import uuid


class CreditRequest(models.Model):
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='credit_requests')
    status = models.CharField(max_length=10, choices=[('pending', 'Pendiente'), ('approved', 'Aprobada'), ('rejected', 'Rechazada')], default='pending')
    created_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_credit_requests')
    credits_granted = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.UniqueConstraint(fields=['requester'], condition=models.Q(status='pending'), name='one_pending_credit_request')]


class UserRole(models.TextChoices):
    """Roles disponibles en el sistema MarketMind IA."""
    SUPERADMIN = "superadmin", "Super Administrador"
    MARKETERO = "marketero", "Marketero"
    CLIENTE = "cliente", "Cliente"


class UserManager(BaseUserManager):
    """Manager customizado para el modelo User."""

    def create_user(
        self,
        email: str,
        password: str,
        nombre: str,
        rol: str = UserRole.CLIENTE,
        **extra_fields,
    ) -> "User":
        """
        Crea y guarda un usuario con email y contraseña.

        Args:
            email: Email único del usuario.
            password: Contraseña en texto plano (se encripta con bcrypt).
            nombre: Nombre completo del usuario.
            rol: Rol dentro del sistema (superadmin/marketero/cliente).
            **extra_fields: Campos adicionales opcionales.

        Returns:
            Instancia del usuario creado.

        Raises:
            ValueError: Si el email no es proporcionado.
        """
        if not email:
            raise ValueError("El campo email es obligatorio.")

        email = self.normalize_email(email)

        if rol not in UserRole.values:
            raise ValueError(
                f"Rol inválido '{rol}'. Valores válidos: {UserRole.values}"
            )

        user: "User" = self.model(
            email=email,
            nombre=nombre,
            rol=rol,
            tokens_disponibles=100,
            **extra_fields,
        )
        user.set_password(password)  # Django usa bcrypt si está configurado
        user.save(using=self._db)
        return user

    def create_superuser(
        self,
        email: str,
        password: str,
        nombre: str = "Super Admin",
        **extra_fields,
    ) -> "User":
        """
        Crea un superusuario con acceso completo al admin de Django.

        Args:
            email: Email del superusuario.
            password: Contraseña en texto plano.
            nombre: Nombre del superusuario.
            **extra_fields: Campos adicionales.

        Returns:
            Instancia del superusuario creado.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superusuario debe tener is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superusuario debe tener is_superuser=True.")

        return self.create_user(
            email=email,
            password=password,
            nombre=nombre,
            rol=UserRole.SUPERADMIN,
            **extra_fields,
        )


class User(AbstractBaseUser, PermissionsMixin):
    """
    Modelo de usuario customizado para MarketMind IA.

    Extiende AbstractBaseUser para control total sobre autenticación.
    Usa email como campo de identificación principal (no username).

    Roles:
        - superadmin: Acceso total al sistema y panel admin.
        - marketero: Crea y gestiona campañas publicitarias.
        - cliente: Aprueba o rechaza propuestas de campaña.

    Campos de auditoría:
        - fecha_creacion: Timestamp de registro.
        - fecha_actualizacion: Último update del registro.
        - ultimo_login: Gestionado por AbstractBaseUser.
    """

    # ── Identificación ──────────────────────────────────────
    email = models.EmailField(
        unique=True,
        max_length=255,
        verbose_name="Email",
        help_text="Email único del usuario. Usado como campo de login.",
    )
    nombre = models.CharField(
        max_length=150,
        verbose_name="Nombre completo",
    )
    # Small normalized JPEG, served only by the authenticated /me/avatar/ endpoint.
    # No public media URL or original upload is retained.
    avatar = models.BinaryField(null=True, blank=True, editable=False)
    google_subject = models.CharField(max_length=255, unique=True, null=True, blank=True, editable=False)

    # ── Rol ─────────────────────────────────────────────────
    rol = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CLIENTE,
        verbose_name="Rol",
        help_text="Define los permisos del usuario en el sistema.",
    )

    # ── Estado ──────────────────────────────────────────────
    is_active = models.BooleanField(
        default=True,
        verbose_name="Activo",
        help_text="Desactiva para suspender sin eliminar la cuenta.",
    )
    is_staff = models.BooleanField(
        default=False,
        verbose_name="Staff",
        help_text="Acceso al admin de Django.",
    )

    # ── Plan de suscripción ──────────────────────────────────
    tokens_disponibles = models.IntegerField(
        default=100,
        verbose_name="Tokens disponibles",
        help_text="Cuota de generaciones IA restantes en el plan actual.",
    )

    # ── Token version (para invalidar JWTs al suspender — HU18) ──
    token_version = models.IntegerField(
        default=0,
        verbose_name="Versión de token",
        help_text="Incrementar invalida todos los JWT emitidos anteriormente.",
    )

    # ── Auditoría ────────────────────────────────────────────
    fecha_creacion = models.DateTimeField(
        default=timezone.now,
        verbose_name="Fecha de registro",
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )

    # ── Manager ─────────────────────────────────────────────
    objects = UserManager()

    # ── AbstractBaseUser config ──────────────────────────────
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]  # Pedido por createsuperuser además de email/password

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        db_table = "users"
        ordering = ["-fecha_creacion"]
        indexes = [
            models.Index(fields=["email"], name="idx_user_email"),
            models.Index(fields=["rol"], name="idx_user_rol"),
        ]

    def __str__(self) -> str:
        return f"{self.nombre} <{self.email}> [{self.rol}]"

    # ── Helpers de rol ───────────────────────────────────────
    @property
    def is_superadmin(self) -> bool:
        """Verifica si el usuario tiene rol superadmin."""
        return self.rol == UserRole.SUPERADMIN

    @property
    def is_marketero(self) -> bool:
        """Verifica si el usuario tiene rol marketero."""
        return self.rol == UserRole.MARKETERO

    @property
    def is_cliente(self) -> bool:
        """Verifica si el usuario tiene rol cliente."""
        return self.rol == UserRole.CLIENTE


class GoogleLoginTicket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nonce_hash = models.CharField(max_length=64)
    proof_hash = models.CharField(max_length=64)
    purpose = models.CharField(max_length=10)
    role = models.CharField(max_length=20, blank=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)


class EmailChangeRequest(models.Model):
    """One pending change per account; only digests of confirmation secrets persist."""
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_change')
    old_email = models.EmailField(max_length=255)
    new_email = models.EmailField(max_length=255)
    old_token_hash = models.CharField(max_length=64)
    new_token_hash = models.CharField(max_length=64)
    old_confirmed = models.BooleanField(default=False)
    new_confirmed = models.BooleanField(default=False)
    token_version = models.IntegerField()
    password_fingerprint = models.CharField(max_length=64)
    expires_at = models.DateTimeField()


class AuthBrandContent(models.Model):
    """Contenido editable/sembrado para el panel visual de Login y Register."""

    class Screen(models.TextChoices):
        LOGIN = "login", "Login"
        REGISTER = "register", "Register"

    screen = models.CharField(
        max_length=20,
        choices=Screen.choices,
        unique=True,
        verbose_name="Pantalla",
    )
    quote = models.TextField(verbose_name="Frase testimonial")
    person_name = models.CharField(max_length=120, verbose_name="Persona")
    person_role = models.CharField(max_length=180, verbose_name="Cargo")
    person_image = models.CharField(
        max_length=255,
        default="/src/assets/landing/testimonial.png",
        verbose_name="Ruta de imagen",
    )

    class Meta:
        verbose_name = "Contenido de panel auth"
        verbose_name_plural = "Contenidos de panel auth"
        db_table = "auth_brand_content"
        ordering = ["screen"]

    def __str__(self) -> str:
        return f"{self.screen}: {self.person_name}"


class InstagramAccount(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='instagram_accounts')
    instagram_user_id = models.CharField(max_length=64)
    username = models.CharField(max_length=150)
    encrypted_token = models.TextField()
    expires_at = models.DateTimeField()
    connected_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'instagram_user_id'], name='unique_owner_instagram_account')]


class InstagramAuthorization(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    state_hash = models.CharField(max_length=64, unique=True)
    token_version = models.IntegerField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    return_origin = models.CharField(max_length=255, blank=True, default='')


class FacebookPage(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='facebook_pages')
    facebook_page_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    encrypted_token = models.TextField()
    expires_at = models.DateTimeField()
    connected_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'facebook_page_id'], name='unique_owner_facebook_page')]


class FacebookAuthorization(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    state_hash = models.CharField(max_length=64, unique=True)
    token_version = models.IntegerField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    return_origin = models.CharField(max_length=255)


class XAccount(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='x_accounts')
    x_user_id = models.CharField(max_length=64)
    username = models.CharField(max_length=150)
    encrypted_access_token = models.TextField()
    encrypted_refresh_token = models.TextField()
    expires_at = models.DateTimeField()
    connected_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'x_user_id'], name='unique_owner_x_account')]


class XAuthorization(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    state_hash = models.CharField(max_length=64, unique=True)
    encrypted_verifier = models.TextField()
    token_version = models.IntegerField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    return_origin = models.CharField(max_length=255)


class TikTokAccount(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tiktok_accounts')
    open_id = models.CharField(max_length=128)
    display_name = models.CharField(max_length=255)
    encrypted_access_token = models.TextField()
    encrypted_refresh_token = models.TextField()
    expires_at = models.DateTimeField()
    refresh_expires_at = models.DateTimeField()
    scopes = models.JSONField(default=list)
    connected_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'open_id'], name='unique_owner_tiktok_account')]


class TikTokAuthorization(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    state_hash = models.CharField(max_length=64, unique=True)
    token_version = models.IntegerField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    return_origin = models.CharField(max_length=255)
