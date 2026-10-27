"""
MarketMind IA — Campaign Model
Modelo central del sistema: representa una campaña publicitaria
con máquina de estados finitos (FSM) para controlar el ciclo de vida.
"""

import uuid
from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class CampaignTono(models.TextChoices):
    """Tonos disponibles para el copy generado por IA."""
    PROFESIONAL = "profesional", "Profesional"
    CASUAL = "casual", "Casual"
    URGENTE = "urgente", "Urgente"
    INSPIRACIONAL = "inspiracional", "Inspiracional"
    HUMORISTICO = "humoristico", "Humorístico"
    PERSUASIVO = "persuasivo", "Persuasivo"


class CampaignPlataforma(models.TextChoices):
    """Platform identifiers, including retired choices retained for historical records.

    LinkedIn and Google Ads are not available for new campaigns.
    """
    INSTAGRAM = "instagram", "Instagram"
    FACEBOOK = "facebook", "Facebook"
    TWITTER = "twitter", "Twitter / X"
    LINKEDIN = "linkedin", "LinkedIn"
    GOOGLE_ADS = "google_ads", "Google Ads"
    TIKTOK = "tiktok", "TikTok"


class CampaignStatus(models.TextChoices):
    """
    Estados del ciclo de vida de una campaña.

    Flujo principal:
        BORRADOR → PENDIENTE_IA → GENERADO → PENDIENTE_APROBACION
                                                  ↓             ↓
                                               APROBADO     RECHAZADO
                                                              ↓
                                                           BORRADOR (reintento)
    """
    BORRADOR = "borrador", "Borrador"
    PENDIENTE_IA = "pendiente_ia", "Pendiente IA"
    GENERADO = "generado", "Generado"
    PENDIENTE_APROBACION = "pendiente_aprobacion", "Pendiente Aprobación"
    APROBADO = "aprobado", "Aprobado"
    RECHAZADO = "rechazado", "Rechazado"
    FRACASO = "fracaso", "Fracaso"


class Campaign(models.Model):
    """
    Campaña publicitaria generada con asistencia de IA.

    Ciclo de vida controlado por FSM. Solo se permiten transiciones
    definidas en VALID_TRANSITIONS; cualquier otra lanza InvalidTransitionError.

    Relaciones:
        - marketero: Usuario con rol 'marketero' que creó la campaña.
          FK a settings.AUTH_USER_MODEL para no acoplar al modelo User directamente.

    Campos de IA:
        - prompt: Texto de entrada enviado a Gemini vía n8n.
        - texto_generado: Copy publicitario devuelto por Gemini.
        - imagen_url: URL de imagen generada por Stability AI (HU21, Sprint 4).
    """

    VALID_TRANSITIONS: ClassVar[dict[str, list[str]]] = {
        CampaignStatus.BORRADOR: [CampaignStatus.PENDIENTE_IA],
        CampaignStatus.PENDIENTE_IA: [CampaignStatus.GENERADO, CampaignStatus.BORRADOR],
        CampaignStatus.GENERADO: [CampaignStatus.PENDIENTE_APROBACION],
        CampaignStatus.PENDIENTE_APROBACION: [
            CampaignStatus.APROBADO,
            CampaignStatus.RECHAZADO,
        ],
        CampaignStatus.APROBADO: [],
        CampaignStatus.RECHAZADO: [CampaignStatus.BORRADOR, CampaignStatus.FRACASO],
        CampaignStatus.FRACASO: [],
    }

    # ── Identificación ──────────────────────────────────────
    titulo = models.CharField(
        max_length=200,
        verbose_name="Título de la campaña",
    )
    cliente_nombre = models.CharField(
        max_length=150,
        verbose_name="Nombre del cliente",
    )
    cliente_email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="Email del cliente",
        help_text="Destino del email de notificación cuando la campaña está lista para aprobación (HU16).",
    )
    industria = models.CharField(
        max_length=100,
        verbose_name="Industria",
        help_text="Ej: tecnología, retail, salud, educación.",
    )

    # ── Configuración IA ────────────────────────────────────
    tono = models.CharField(
        max_length=20,
        choices=CampaignTono.choices,
        default=CampaignTono.PROFESIONAL,
        verbose_name="Tono del mensaje",
    )
    plataforma = models.CharField(
        max_length=20,
        choices=CampaignPlataforma.choices,
        default=CampaignPlataforma.INSTAGRAM,
        verbose_name="Plataforma de publicación",
    )
    plataformas = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Plataformas de publicación",
        help_text=(
            "Lista de plataformas elegidas. El campo plataforma conserva la "
            "primera selección para compatibilidad con clientes antiguos."
        ),
    )
    prompt = models.TextField(
        verbose_name="Prompt de entrada",
        help_text="Descripción de la campaña enviada a Gemini vía n8n.",
    )

    # ── Resultado IA ────────────────────────────────────────
    texto_generado = models.TextField(
        blank=True,
        default="",
        verbose_name="Copy generado",
        help_text="Texto publicitario devuelto por Gemini.",
    )
    textos_por_plataforma = models.JSONField(default=dict, blank=True)
    imagen_url = models.URLField(
        blank=True,
        null=True,
        verbose_name="URL de imagen",
        help_text="Imagen generada por Stability AI (HU21, Sprint 4).",
    )
    imagen_b64 = models.TextField(
        blank=True,
        null=True,
        verbose_name="Imagen base64",
        help_text="Imagen generada por Gemini Imagen 3 en base64 (HU21). Mostrar con data:image/png;base64,<valor>.",
    )

    # ── Auditoría IA ────────────────────────────────────────
    n8n_callback_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name="Token callback n8n",
        help_text="UUID para autenticar el callback de n8n. No exponer al frontend.",
    )
    tokens_consumidos = models.IntegerField(
        default=0,
        verbose_name="Tokens consumidos",
    )
    intentos_generacion = models.IntegerField(
        default=0,
        verbose_name="Intentos de generación",
        help_text="Máximo 3 intentos por campaña.",
    )
    ia_error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name="Error IA",
        help_text="Último error devuelto por n8n/Gemini.",
    )

    # ── Feedback del cliente (HU15) — escrito por Spring Boot al rechazar ──
    feedback_rechazo = models.TextField(
        blank=True,
        null=True,
        verbose_name="Feedback de rechazo",
        help_text=(
            "Motivo escrito por el cliente cuando rechaza la campaña (HU15). "
            "Null para campañas aprobadas o en otros estados."
        ),
    )

    # ── Email cliente (HU16) — flag de entrega tras Resend OK ──
    email_enviado = models.BooleanField(
        default=False,
        verbose_name="Email cliente enviado",
        help_text="True tras confirmación del callback n8n de envío exitoso vía Resend (HU16).",
    )
    enviado_cliente_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de envío al cliente",
        help_text="Momento en que el marketero envió la campaña para aprobación.",
    )
    cliente_valoracion = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name="Valoración del cliente",
        help_text="Valoración de 1 a 5 estrellas enviada por el cliente al aprobar o rechazar.",
    )
    cliente_valoracion_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de valoración del cliente",
        help_text="Momento en que el cliente registró su valoración.",
    )
    rechazos_cliente_count = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Rechazos del cliente",
        help_text="Cantidad acumulada de rechazos del cliente. Al segundo rechazo la campaña queda en fracaso.",
    )

    # ── Optimistic locking — Spring Boot JPA usa @Version sobre este campo ──
    version = models.IntegerField(
        default=1,
        verbose_name="Versión",
    )

    # ── FSM ─────────────────────────────────────────────────
    estado = models.CharField(
        max_length=30,
        choices=CampaignStatus.choices,
        default=CampaignStatus.BORRADOR,
        verbose_name="Estado",
        db_index=True,
    )

    # ── Relaciones ──────────────────────────────────────────
    marketero = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="campaigns",
        verbose_name="Marketero",
        help_text="Usuario con rol marketero que creó y gestiona esta campaña.",
    )

    # ── Auditoría ────────────────────────────────────────────
    fecha_creacion = models.DateTimeField(
        default=timezone.now,
        verbose_name="Fecha de creación",
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )

    class Meta:
        verbose_name = "Campaña"
        verbose_name_plural = "Campañas"
        db_table = "campaigns"
        ordering = ["-fecha_creacion"]
        indexes = [
            models.Index(fields=["estado"], name="idx_campaign_estado"),
            models.Index(fields=["marketero", "estado"], name="idx_campaign_marketero_estado"),
        ]

    def __str__(self) -> str:
        return f"{self.titulo} [{self.estado}] — {self.cliente_nombre}"

    def transition_to(self, nuevo_estado: str) -> None:
        """
        Cambia el estado de la campaña validando la transición contra VALID_TRANSITIONS.

        Solo permite transiciones explícitamente definidas en VALID_TRANSITIONS.
        Guarda el objeto en BD si la transición es válida.

        Args:
            nuevo_estado: Valor de CampaignStatus al que se quiere transicionar.

        Raises:
            ValidationError: Si la transición desde el estado actual no está permitida.
            ValidationError: Si nuevo_estado no es un valor válido de CampaignStatus.

        Example:
            >>> campaign.transition_to(CampaignStatus.PENDIENTE_IA)
        """
        if nuevo_estado not in CampaignStatus.values:
            raise ValidationError(
                f"Estado '{nuevo_estado}' no es válido. "
                f"Valores permitidos: {CampaignStatus.values}"
            )

        estados_permitidos = self.VALID_TRANSITIONS.get(self.estado, [])

        if nuevo_estado not in estados_permitidos:
            raise ValidationError(
                f"Transición inválida: '{self.estado}' → '{nuevo_estado}'. "
                f"Desde '{self.estado}' solo se permite: {estados_permitidos or ['ninguno (estado final)']}"
            )

        self.estado = nuevo_estado
        self.save(update_fields=["estado", "fecha_actualizacion"])


class CampaignVersion(models.Model):
    """
    Snapshot inmutable del estado de una campaña antes de ser sobreescrita.
    Máximo 5 versiones por campaña (LRU automático en save_campaign_version).
    """

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    texto_generado = models.TextField()
    textos_por_plataforma = models.JSONField(default=dict, blank=True)
    imagen_b64 = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaigns_campaignversion'
        ordering = ['-version_number']
        unique_together = [['campaign', 'version_number']]
        indexes = [
            models.Index(fields=['campaign', '-version_number']),
        ]

    def __str__(self) -> str:
        return f"Campaign {self.campaign_id} v{self.version_number}"


class InstagramPublication(models.Model):
    """One durable attempt per approved campaign version and destination."""

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    account = models.ForeignKey('authentication.InstagramAccount', on_delete=models.SET_NULL, null=True)
    instagram_user_id = models.CharField(max_length=64)
    username = models.CharField(max_length=150)
    campaign_version = models.IntegerField()
    caption = models.TextField()
    image_jpeg = models.TextField()
    image_ticket = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    image_expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, default='preparing')
    container_id = models.CharField(max_length=64, blank=True)
    media_id = models.CharField(max_length=64, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=['campaign', 'instagram_user_id', 'campaign_version'], name='unique_instagram_publication')]


class FacebookPublication(models.Model):
    """Immutable approved content and one durable attempt per Page/version."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    page = models.ForeignKey('authentication.FacebookPage', on_delete=models.SET_NULL, null=True)
    facebook_page_id = models.CharField(max_length=64)
    page_name = models.CharField(max_length=255)
    campaign_version = models.IntegerField()
    caption = models.TextField()
    image_jpeg = models.TextField()
    status = models.CharField(max_length=20, default='publishing')
    photo_id = models.CharField(max_length=64, blank=True)
    post_id = models.CharField(max_length=140, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['campaign', 'facebook_page_id', 'campaign_version'],
                                              name='unique_facebook_publication')]


class XSummary(models.Model):
    """Marketer-reviewed adaptation, separate from client-approved content."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    campaign_version = models.IntegerField()
    source_digest = models.CharField(max_length=64)
    caption = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class XPublication(models.Model):
    """Approved snapshot and durable attempt, surviving account disconnection."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    account = models.ForeignKey('authentication.XAccount', on_delete=models.SET_NULL, null=True)
    x_user_id = models.CharField(max_length=64)
    username = models.CharField(max_length=150)
    campaign_version = models.IntegerField()
    summary = models.ForeignKey(XSummary, on_delete=models.SET_NULL, null=True, blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    caption = models.TextField()
    image_jpeg = models.TextField()
    status = models.CharField(max_length=20, default='preparing')
    media_id = models.CharField(max_length=64, blank=True)
    post_id = models.CharField(max_length=64, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['campaign', 'x_user_id', 'campaign_version'],
                                              name='unique_x_publication')]


class TikTokUpload(models.Model):
    """One immutable confirmed upload per approved version/account, never auto-resent."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    account = models.ForeignKey('authentication.TikTokAccount', on_delete=models.SET_NULL, null=True)
    open_id = models.CharField(max_length=128)
    display_name = models.CharField(max_length=255)
    campaign_version = models.IntegerField()
    caption = models.TextField()
    image_jpeg = models.TextField()
    image_ticket = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    image_expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, default='sending')
    publish_id = models.CharField(max_length=64, blank=True)
    public_post_ids = models.JSONField(default=list)
    message = models.TextField(blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    confirmation_source = models.CharField(max_length=20, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['campaign', 'open_id', 'campaign_version'],
                                              name='unique_tiktok_upload')]


class TikTokPublicationLink(models.Model):
    """User-confirmed association verified by Display API, not an upload receipt."""
    upload = models.OneToOneField(TikTokUpload, on_delete=models.CASCADE, related_name='publication_link')
    post_id = models.CharField(max_length=64, unique=True)
    post_url = models.URLField(max_length=512, blank=True)
    provider_created_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(default=timezone.now)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)


class TikTokWebhookReceipt(models.Model):
    """Signed event deduplication; never retain credentials or raw event bodies."""
    digest = models.CharField(max_length=64, unique=True)
    event = models.CharField(max_length=64)
    upload = models.ForeignKey(TikTokUpload, on_delete=models.SET_NULL, null=True)
    received_at = models.DateTimeField(auto_now_add=True)


class PublicationMetricSnapshot(models.Model):
    """Daily provider counters, independent of the campaign's current revision."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    platform = models.CharField(max_length=20)
    publication_id = models.PositiveBigIntegerField()
    day = models.DateField()
    metrics = models.JSONField(default=dict)
    measured_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['platform', 'publication_id', 'day'],
                                              name='unique_daily_publication_metrics')]


class PublicationAvailability(models.Model):
    """Last API check, separate from historical delivery and counter snapshots."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE)
    platform = models.CharField(max_length=20)
    publication_id = models.PositiveBigIntegerField()
    state = models.CharField(max_length=20, default='unknown')
    checked_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['platform', 'publication_id'],
                                              name='unique_publication_availability')]


class XMetricReadBudget(models.Model):
    """Operator-authorized read allowance; never granted by a client request.

    Reservations include failures/timeouts and are not refunded automatically.
    This bounds calls, not an invoice from X (whose rates can change).
    """
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    request_limit = models.PositiveIntegerField(default=0)
    requests_reserved = models.PositiveIntegerField(default=0)
    unit_cost_usd = models.DecimalField(max_digits=8, decimal_places=4, default='0.0050')
    authorized_at = models.DateTimeField(default=timezone.now)


class CreditPurchase(models.Model):
    """
    Registro append-only de compras de créditos de IA. Pasarela de pago
    simulada: siempre aprueba, no hay integración real con un procesador.
    El monto/créditos vienen del mapeo fijo en views.py (PLAN_MAP), nunca
    del cliente, para evitar auto-otorgamiento de créditos.
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compras_creditos',
    )
    plan_nombre = models.CharField(max_length=50)
    monto = models.DecimalField(max_digits=8, decimal_places=2)
    creditos = models.PositiveIntegerField()
    estado = models.CharField(max_length=20, default='aprobado')
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaigns_creditpurchase'
        ordering = ['-fecha_creacion']

    def __str__(self) -> str:
        return f"Compra {self.plan_nombre} — {self.usuario_id} ({self.creditos} créditos)"
