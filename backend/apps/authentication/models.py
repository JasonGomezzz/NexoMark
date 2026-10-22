"""
MarketMind IA — Authentication Models
Define el modelo User customizado con roles superadmin/marketero/cliente.
Criterios HU1: registro con roles, email único, password bcrypt.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


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


class PasswordResetToken(models.Model):
    """
    Enlace de recuperación de contraseña de un solo uso.

    En la BD solo se guarda el SHA-256 del token: quien lea la tabla no puede
    usar los enlaces. El token en claro solo viaja en el correo. Caduca a los
    PASSWORD_RESET_TIMEOUT segundos y se marca como usado al cambiar la
    contraseña; pedir un enlace nuevo invalida los anteriores sin usar.
    """

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tokens_recuperacion",
    )
    token_hash = models.CharField(max_length=64, unique=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    expira_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Token de recuperación"
        verbose_name_plural = "Tokens de recuperación"
        db_table = "password_reset_tokens"
        ordering = ["-fecha_creacion"]

    def __str__(self) -> str:
        estado = "usado" if self.usado_en else "vigente"
        return f"Recuperación de {self.usuario_id} ({estado})"


class CreditRequestStatus(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    APROBADA = "aprobada", "Aprobada"
    RECHAZADA = "rechazada", "Rechazada"


class CreditRequest(models.Model):
    """
    Solicitud de créditos de un marketero, resuelta por un superadmin.

    Queda auditada: quién la resolvió, cuándo, cuántos créditos sumó y con qué
    saldo quedó la cuenta. Solo puede haber una pendiente por marketero.
    Aprobar no es un pago: la compra simulada (CreditPurchase) sigue aparte.
    """

    solicitante = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="solicitudes_creditos",
    )
    motivo = models.CharField(max_length=300, blank=True, default="")
    estado = models.CharField(
        max_length=10,
        choices=CreditRequestStatus.choices,
        default=CreditRequestStatus.PENDIENTE,
    )
    creditos_otorgados = models.PositiveIntegerField(default=0)
    saldo_resultante = models.IntegerField(
        null=True,
        blank=True,
        help_text="tokens_disponibles del solicitante justo después de aprobar.",
    )
    nota_resolucion = models.CharField(max_length=300, blank=True, default="")
    resuelta_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="solicitudes_creditos_resueltas",
    )
    resuelta_en = models.DateTimeField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Solicitud de créditos"
        verbose_name_plural = "Solicitudes de créditos"
        db_table = "credit_requests"
        ordering = ["-fecha_creacion", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["solicitante"],
                condition=models.Q(estado="pendiente"),
                name="una_solicitud_pendiente_por_usuario",
            ),
        ]

    def __str__(self) -> str:
        return f"Solicitud {self.pk} de {self.solicitante_id} [{self.estado}]"


class FotoPerfil(models.Model):
    """
    Foto de perfil normalizada: JPEG de 256×256 sin EXIF ni nombre original.

    Va en una tabla aparte para no leer el binario en cada consulta de
    usuarios (cada petición autenticada carga el User). Solo la sirve
    /api/auth/me/avatar/ al propio usuario autenticado; no hay URL pública.
    """

    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="foto_perfil",
    )
    imagen = models.BinaryField()
    actualizada_en = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Foto de perfil"
        verbose_name_plural = "Fotos de perfil"
        db_table = "user_avatars"

    def __str__(self) -> str:
        return f"Foto de {self.usuario_id}"


class EmailChangeRequest(models.Model):
    """
    Cambio de correo pendiente, con doble confirmación (correo actual y nuevo).

    Adaptado de la rama de Piero (email_change.py). Una sola solicitud por
    cuenta; en la BD solo quedan los SHA-256 de los enlaces. Deja de valer si
    vence (30 minutos), si cambia el token_version, el correo actual o la
    contraseña (huella HMAC del hash de la contraseña).
    """

    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="cambio_correo",
    )
    correo_actual = models.EmailField(max_length=255)
    correo_nuevo = models.EmailField(max_length=255)
    hash_token_actual = models.CharField(max_length=64, blank=True, default="")
    hash_token_nuevo = models.CharField(max_length=64, blank=True, default="")
    actual_confirmado = models.BooleanField(default=False)
    nuevo_confirmado = models.BooleanField(default=False)
    token_version = models.IntegerField()
    huella_password = models.CharField(max_length=64)
    expira_en = models.DateTimeField()
    fecha_creacion = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Cambio de correo"
        verbose_name_plural = "Cambios de correo"
        db_table = "email_change_requests"

    def __str__(self) -> str:
        return f"Cambio de correo de {self.usuario_id}"
