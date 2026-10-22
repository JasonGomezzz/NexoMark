"""
MarketMind Voice — Cuentas sociales conectadas y publicaciones.

Django es dueño de la identidad social: los tokens de Meta y de X se guardan
cifrados aquí y nunca salen hacia n8n, React ni Kotlin.

Una Publication congela el copy y la imagen en el momento de la aprobación:
se publica exactamente lo que el cliente aprobó, aunque la campaña cambie
después o su historial de versiones rote.

X es opcional y está apagada por defecto (X_HABILITADO). No entra en la
publicación automática al aprobar: su texto es una VarianteX que el cliente
aprueba aparte y que el marketero publica con confirmación de costo.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.campaigns.models import Campaign


class RedSocial(models.TextChoices):
    INSTAGRAM = "instagram", "Instagram"
    FACEBOOK = "facebook", "Facebook"
    X = "x", "X"
    TIKTOK = "tiktok", "TikTok"


# Redes que se publican solas cuando el cliente aprueba. X y TikTok van aparte.
REDES_META = (RedSocial.INSTAGRAM, RedSocial.FACEBOOK)


class ConexionEstado(models.TextChoices):
    ACTIVA = "activa", "Activa"
    DESCONECTADA = "desconectada", "Desconectada"


class SocialConnection(models.Model):
    """Cuenta de Instagram, página de Facebook o cuenta de X autorizada por su dueño vía OAuth."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conexiones_sociales",
        help_text="Quien autorizó la cuenta (cliente dueño o marketero que la administra).",
    )
    red = models.CharField(max_length=20, choices=RedSocial.choices)
    cuenta_id = models.CharField(
        max_length=64,
        help_text="ID en Meta (página de Facebook o cuenta de Instagram profesional) o ID de usuario en X.",
    )
    cuenta_nombre = models.CharField(max_length=150, help_text="Nombre de la página o @usuario.")
    pagina_id = models.CharField(
        max_length=64,
        help_text="Página de Facebook a la que pertenece el token (la misma en Instagram vinculado). Vacío en X.",
    )
    token_cifrado = models.TextField(
        blank=True, default="", help_text="Token de página (Meta) o de acceso (X) cifrado. Nunca se expone."
    )
    refresh_token_cifrado = models.TextField(
        blank=True,
        default="",
        help_text="Solo X: refresh token cifrado (offline.access). X lo rota en cada renovación.",
    )
    token_expira_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Null: el token de página no informa vencimiento. En X el token de acceso dura 2 horas.",
    )
    refresh_expira_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Solo TikTok: vencimiento del refresh token (pasado este, hay que reconectar).",
    )
    permisos = models.JSONField(
        default=list,
        blank=True,
        help_text="Solo TikTok: scopes concedidos (p. ej. user.info.basic, video.upload).",
    )
    estado = models.CharField(
        max_length=20,
        choices=ConexionEstado.choices,
        default=ConexionEstado.ACTIVA,
        db_index=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "social_connections"
        ordering = ["red", "cuenta_nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "red", "cuenta_id"],
                name="uniq_conexion_usuario_red_cuenta",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.red}:{self.cuenta_nombre} ({self.estado})"


class ProveedorOAuth(models.TextChoices):
    META = "meta", "Meta (Facebook e Instagram)"
    X = "x", "X"
    TIKTOK = "tiktok", "TikTok"


class PlataformaOAuth(models.TextChoices):
    WEB = "web", "Web"
    APP = "app", "App móvil (Android o iOS)"


class OAuthAutorizacion(models.Model):
    """
    Intento de conectar cuentas por OAuth, ligado al usuario que lo inició.

    El `state` viaja por el navegador y vuelve en el callback de Meta; aquí
    solo se guarda su sha256. Es de un solo uso, caduca a los 10 minutos y
    deja de valer si cambia el token_version del usuario (sesiones
    invalidadas). El código de Meta se canjea solo cuando el mismo usuario,
    autenticado con su JWT, presenta el state (ver apps/social/oauth.py).
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="autorizaciones_oauth",
    )
    proveedor = models.CharField(max_length=20, choices=ProveedorOAuth.choices, default=ProveedorOAuth.META)
    plataforma = models.CharField(
        max_length=10,
        choices=PlataformaOAuth.choices,
        default=PlataformaOAuth.WEB,
        help_text="Adónde vuelve el callback: la página web de retorno o la app (esquema nexomark://).",
    )
    state_hash = models.CharField(max_length=64, unique=True, help_text="sha256 del state; el state no se guarda.")
    token_version = models.IntegerField(help_text="token_version del usuario al iniciar la conexión.")
    redirect_uri = models.CharField(
        max_length=500,
        help_text="redirect_uri enviado al proveedor; el canje del código debe usar exactamente el mismo.",
    )
    code_verifier_cifrado = models.TextField(
        blank=True,
        default="",
        help_text="Solo X (PKCE): code_verifier cifrado. Se borra al reclamar el state.",
    )
    expira_at = models.DateTimeField()
    usada_at = models.DateTimeField(null=True, blank=True, help_text="Null: todavía no se canjeó.")
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "social_oauth_autorizaciones"
        ordering = ["-fecha_creacion"]

    def __str__(self) -> str:
        return f"OAuth {self.proveedor} de usuario {self.usuario_id} ({'usada' if self.usada_at else 'pendiente'})"


class PublicacionEstado(models.TextChoices):
    ESPERANDO_APROBACION = "esperando_aprobacion", "Esperando aprobación"
    PUBLICANDO = "publicando", "Publicando"
    PUBLICADO = "publicado", "Publicado"
    FALLIDO = "fallido", "Fallido"
    CANCELADO = "cancelado", "Cancelado"
    # Solo TikTok: el borrador llegó al buzón; la persona termina de publicar en la app de TikTok.
    EN_BUZON = "en_buzon", "En el buzón de TikTok"


class Publication(models.Model):
    """Publicación de una campaña en una cuenta conectada."""

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="publicaciones")
    conexion = models.ForeignKey(
        SocialConnection,
        on_delete=models.SET_NULL,
        null=True,
        related_name="publicaciones",
    )
    red = models.CharField(max_length=20, choices=RedSocial.choices)
    cuenta_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text=(
            "ID en Meta de la cuenta destino (copia de la conexión). Si cliente y marketero "
            "conectaron la misma cuenta, la campaña se publica una sola vez en ella."
        ),
    )
    cuenta_nombre = models.CharField(max_length=150, help_text="Copia para mostrar aunque la cuenta se desconecte.")
    estado = models.CharField(
        max_length=30,
        choices=PublicacionEstado.choices,
        default=PublicacionEstado.ESPERANDO_APROBACION,
        db_index=True,
    )

    # ── Contenido congelado al aprobar ──
    copy_aprobado = models.TextField(blank=True, default="")
    imagen_aprobada_b64 = models.TextField(blank=True, null=True)
    version_aprobada = models.IntegerField(
        null=True,
        blank=True,
        help_text="Campaign.version que aprobó el cliente.",
    )

    # ── Resultado en Meta ──
    contenedor_id = models.CharField(max_length=64, blank=True, default="")
    externo_id = models.CharField(max_length=64, blank=True, default="")
    permalink = models.URLField(max_length=500, blank=True, default="")
    error = models.TextField(blank=True, default="")
    intentos = models.PositiveSmallIntegerField(default=0)
    resultado_incierto = models.BooleanField(
        default=False,
        help_text=(
            "Solo X: el último intento se envió pero X no confirmó el resultado. No se reintenta "
            "hasta que el marketero revise la cuenta y lo confirme."
        ),
    )
    publicando_desde = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Inicio del último intento. Si el proceso murió, pasado un margen se puede reintentar.",
    )

    solicitada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="publicaciones_solicitadas",
    )
    publicado_at = models.DateTimeField(null=True, blank=True)
    consultado_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Solo TikTok: última consulta real del estado del envío (mínimo 30 s entre consultas).",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "social_publications"
        ordering = ["-fecha_creacion"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "conexion"],
                name="uniq_publicacion_campana_conexion",
            ),
            # Vacío = filas antiguas duplicadas que la migración 0005 dejó como historial.
            models.UniqueConstraint(
                fields=["campaign", "red", "cuenta_id"],
                condition=~Q(cuenta_id=""),
                name="uniq_publicacion_campana_red_cuenta",
            ),
        ]
        indexes = [
            models.Index(fields=["campaign", "estado"], name="idx_publicacion_campana_estado"),
        ]

    def __str__(self) -> str:
        return f"Publicación {self.pk} {self.red}:{self.cuenta_nombre} [{self.estado}]"


class PublicationMetric(models.Model):
    """
    Foto de las métricas de una publicación en un momento dado.

    Un valor que Meta no entrega (cuenta nueva, métrica no disponible o aún
    sin procesar: puede tardar hasta 48 h) se guarda como null, nunca como 0.
    """

    publicacion = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name="metricas")
    me_gusta = models.IntegerField(null=True, blank=True, help_text="Likes en Instagram; reacciones en Facebook.")
    comentarios = models.IntegerField(null=True, blank=True)
    compartidos = models.IntegerField(null=True, blank=True)
    guardados = models.IntegerField(null=True, blank=True, help_text="Solo Instagram.")
    alcance = models.IntegerField(null=True, blank=True, help_text="Cuentas únicas que vieron la publicación.")
    vistas = models.IntegerField(null=True, blank=True)
    interacciones = models.IntegerField(null=True, blank=True, help_text="Total de interacciones (o clics en Facebook).")
    crudo = models.JSONField(default=dict, blank=True, help_text="Respuesta de Meta, para auditar.")
    error = models.TextField(blank=True, default="")
    obtenida_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "social_publication_metrics"
        ordering = ["-obtenida_at"]
        indexes = [
            models.Index(fields=["publicacion", "-obtenida_at"], name="idx_metrica_pub_fecha"),
        ]

    def __str__(self) -> str:
        return f"Métricas de publicación {self.publicacion_id} @ {self.obtenida_at:%Y-%m-%d %H:%M}"


class VarianteXEstado(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    PENDIENTE_CLIENTE = "pendiente_cliente", "Esperando al cliente"
    APROBADA = "aprobada", "Aprobada"
    RECHAZADA = "rechazada", "Rechazada"


class VarianteX(models.Model):
    """
    Texto corto para X de una campaña ya aprobada ("Resumir para X").

    La campaña aprobada no se reabre nunca: la variante tiene su propio ciclo
    (borrador → esperando al cliente → aprobada | rechazada). Al aprobar se
    guarda el sha256 del texto; al publicar se exige que el texto actual y el
    contenido de la campaña sigan siendo los mismos que el cliente vio.
    Editar la variante la devuelve a borrador; la campaña no cambia.
    """

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="variantes_x")
    version_origen = models.IntegerField(help_text="Campaign.version al crear la variante (auditoría).")
    hash_origen = models.CharField(
        max_length=64,
        help_text="sha256 del texto_generado + imagen_b64 aprobados de la campaña al crear la variante.",
    )
    texto = models.TextField()
    generada_por_ia = models.BooleanField(default=False, help_text="False: escrita a mano o resumen recortado.")
    estado = models.CharField(
        max_length=20,
        choices=VarianteXEstado.choices,
        default=VarianteXEstado.BORRADOR,
        db_index=True,
    )
    hash_aprobado = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="sha256 del texto que aprobó el cliente. Vacío si no está aprobada.",
    )
    feedback_cliente = models.TextField(blank=True, default="")
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="variantes_x_creadas",
    )
    enviada_at = models.DateTimeField(null=True, blank=True)
    aprobada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="variantes_x_aprobadas",
    )
    aprobada_at = models.DateTimeField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "social_variantes_x"
        ordering = ["-fecha_creacion"]
        constraints = [
            # Una variante vigente por campaña: se edita, no se duplica.
            models.UniqueConstraint(fields=["campaign"], name="uniq_variante_x_campana"),
        ]

    def __str__(self) -> str:
        return f"Variante X de campaña {self.campaign_id} [{self.estado}]"


class GastoMensualX(models.Model):
    """
    Gasto estimado en la API de X por mes (tope de gasto en el servidor).

    Se reserva ANTES de llamar a X con un UPDATE condicional (como los
    créditos): dos peticiones simultáneas no superan el tope. Es conservador:
    un intento que llega a llamar a la API cuenta aunque X lo rechace.
    """

    mes = models.DateField(unique=True, help_text="Primer día del mes.")
    publicaciones = models.PositiveIntegerField(default=0, help_text="Intentos de publicación que llamaron a X.")
    lecturas = models.PositiveIntegerField(default=0, help_text="Lecturas de usuario (users/me al conectar).")
    gasto_milesimas = models.PositiveIntegerField(
        default=0,
        help_text="Gasto estimado en milésimas de dólar (15 = US$0.015): entero para que el tope sea exacto.",
    )
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "social_gasto_mensual_x"
        ordering = ["-mes"]

    def __str__(self) -> str:
        return f"Gasto X {self.mes:%Y-%m}: {self.gasto_milesimas} milésimas de US$"
