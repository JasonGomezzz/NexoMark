"""
MarketMind IA — Campaign Serializer
Validación y serialización del modelo Campaign.
"""

from rest_framework import serializers

from apps.authentication.models import User, UserRole

from .models import Campaign, CampaignPlataforma, CampaignStatus, CampaignTono, CampaignVersion

# TODO: mover a TextChoices en models.py (Sprint refactor)
INDUSTRIA_CHOICES = [
    "tecnologia", "salud", "educacion", "retail",
    "gastronomia", "moda", "finanzas", "entretenimiento", "otro",
]


class CampaignSerializer(serializers.ModelSerializer):
    """
    Serializer principal de Campaign.

    Campos de escritura (requeridos en create):
        titulo, cliente_nombre, industria, tono, plataforma, prompt.

    Campos de solo lectura (devueltos en respuesta):
        id, estado, texto_generado, imagen_url, marketero, fecha_creacion.
    """

    marketero = serializers.StringRelatedField(read_only=True)
    publication_status = serializers.SerializerMethodField()

    def get_publication_status(self, campaign):
        from .models import InstagramPublication, FacebookPublication, XPublication, TikTokUpload
        result = {}
        for platform, model in [('instagram', InstagramPublication), ('facebook', FacebookPublication), ('twitter', XPublication), ('tiktok', TikTokUpload)]:
            records = list(model.objects.filter(campaign=campaign, campaign_version=campaign.version).values_list('status', flat=True))
            result[platform] = ('published' if 'published' in records else records[-1] if records else 'not_published')
            if platform == 'tiktok' and result[platform] != 'published' and model.objects.filter(
                    campaign=campaign, campaign_version=campaign.version, publication_link__isnull=False).exists():
                result[platform] = 'linked'
        return result
    cliente_email = serializers.EmailField(required=True)
    plataforma = serializers.ChoiceField(
        choices=CampaignPlataforma.choices,
        required=False,
    )
    plataformas = serializers.ListField(
        child=serializers.ChoiceField(choices=CampaignPlataforma.choices),
        required=False,
        allow_empty=False,
        max_length=len(CampaignPlataforma.values),
    )

    class Meta:
        model = Campaign
        fields = [
            "id",
            "version",
            "titulo",
            "cliente_nombre",
            "cliente_email",
            "industria",
            "tono",
            "plataforma",
            "plataformas",
            "prompt",
            "estado",
            "texto_generado",
            "textos_por_plataforma",
            "publication_status",
            "imagen_url",
            "imagen_b64",
            "ia_error_message",
            "feedback_rechazo",
            "email_enviado",
            "enviado_cliente_at",
            "cliente_valoracion",
            "cliente_valoracion_at",
            "rechazos_cliente_count",
            "marketero",
            "fecha_creacion",
        ]
        read_only_fields = [
            "id",
            "version",
            "estado",
            "texto_generado",
            "textos_por_plataforma",
            "imagen_url",
            "imagen_b64",
            "ia_error_message",
            "feedback_rechazo",
            "email_enviado",
            "enviado_cliente_at",
            "cliente_valoracion",
            "cliente_valoracion_at",
            "rechazos_cliente_count",
            "marketero",
            "fecha_creacion",
        ]

    def validate_titulo(self, value: str) -> str:
        """Valida longitud mínima y máxima del título."""
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("El título debe tener al menos 5 caracteres.")
        if len(value) > 200:
            raise serializers.ValidationError("El título no puede superar los 200 caracteres.")
        return value

    def validate_cliente_nombre(self, value: str) -> str:
        """Valida que el nombre del cliente no esté vacío."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del cliente no puede estar vacío.")
        if len(value) > 150:
            raise serializers.ValidationError(
                "El nombre del cliente no puede superar 150 caracteres."
            )
        return value

    def validate_cliente_email(self, value: str) -> str:
        """Normaliza el email del cliente."""
        return value.strip().lower()

    def validate(self, attrs: dict) -> dict:
        """
        Valida que exista un cliente registrado con ese email.

        El 'cliente_nombre' es libre (el marketero puede usar el nombre del
        negocio/marca, ej. 'Gimnasio Mega Force'); NO tiene que coincidir con
        el nombre de la cuenta. La identidad se ancla en el email, que sí debe
        pertenecer a un usuario con rol cliente (evita enviar campañas a
        destinatarios inexistentes).
        """
        attrs = super().validate(attrs)
        plataformas = attrs.get("plataformas")
        plataforma_legacy = attrs.get("plataforma")
        # Keep the model choice for historical records, but reject new selections
        # through either API field, including conflicting legacy/multiple inputs.
        if plataforma_legacy == CampaignPlataforma.LINKEDIN or CampaignPlataforma.LINKEDIN in (plataformas or []):
            raise serializers.ValidationError(
                {"plataformas": "LinkedIn ya no está disponible para nuevas campañas."}
            )
        if plataforma_legacy == CampaignPlataforma.GOOGLE_ADS or CampaignPlataforma.GOOGLE_ADS in (plataformas or []):
            raise serializers.ValidationError(
                {"plataformas": "Google Ads se ha retirado del proyecto y no está disponible para nuevas campañas."}
            )
        if not plataformas and plataforma_legacy:
            plataformas = [plataforma_legacy]
        if not plataformas:
            raise serializers.ValidationError(
                {"plataformas": "Selecciona al menos una plataforma."}
            )

        # Quitar duplicados conservando el orden elegido. El primer valor se
        # replica en el campo histórico para no romper Flutter/Spring actuales.
        plataformas = list(dict.fromkeys(plataformas))
        attrs["plataformas"] = plataformas
        attrs["plataforma"] = plataformas[0]

        email = attrs.get("cliente_email")
        nombre = attrs.get("cliente_nombre")
        if not email:
            raise serializers.ValidationError(
                {"cliente_email": "El email del cliente es obligatorio."}
            )
        if not nombre:
            raise serializers.ValidationError(
                {"cliente_nombre": "El nombre del cliente es obligatorio."}
            )

        try:
            cliente = User.objects.get(email=email, rol=UserRole.CLIENTE)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"cliente_email": "Debe existir un usuario cliente registrado con este email."}
            ) from exc

        # Email normalizado al del cliente registrado; nombre se respeta tal cual.
        attrs["cliente_email"] = cliente.email
        attrs["cliente_nombre"] = nombre.strip()
        return attrs

    def validate_prompt(self, value: str) -> str:
        """Valida longitud mínima y máxima del prompt."""
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("El prompt debe tener al menos 10 caracteres.")
        if len(value) > 2000:
            raise serializers.ValidationError("El prompt no puede superar los 2000 caracteres.")
        return value

    def validate_industria(self, value: str) -> str:
        """Valida que la industria sea una de las opciones permitidas."""
        value = value.strip().lower()
        if value not in INDUSTRIA_CHOICES:
            raise serializers.ValidationError(
                f"Industria inválida. Opciones: {', '.join(INDUSTRIA_CHOICES)}."
            )
        return value

    def validate_tono(self, value: str) -> str:
        """Valida que el tono sea un valor definido en CampaignTono."""
        value = value.strip().lower()
        if value not in CampaignTono.values:
            raise serializers.ValidationError(
                f"Tono inválido. Opciones: {', '.join(CampaignTono.values)}."
            )
        return value

    def validate_plataforma(self, value: str) -> str:
        """Valida que la plataforma sea un valor definido en CampaignPlataforma."""
        value = value.strip().lower()
        if value not in CampaignPlataforma.values:
            raise serializers.ValidationError(
                f"Plataforma inválida. Opciones: {', '.join(CampaignPlataforma.values)}."
            )
        return value


class CampaignEditSerializer(serializers.ModelSerializer):
    """Serializer para edición de prompt y texto_generado por el marketero."""

    class Meta:
        model = Campaign
        fields = ["prompt", "texto_generado", "textos_por_plataforma"]

    def validate_textos_por_plataforma(self, value):
        from .platform_content import platforms
        if not isinstance(value, dict) or set(value) != set(platforms(self.instance)):
            raise serializers.ValidationError('Incluye exactamente las plataformas de esta campaña.')
        if any(not isinstance(text, str) or not text.strip() or len(text) > 10000 for text in value.values()):
            raise serializers.ValidationError('Cada versión necesita texto, con un máximo de 10000 caracteres.')
        return {platform: text.strip() for platform, text in value.items()}

    def validate_prompt(self, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("El prompt debe tener al menos 10 caracteres.")
        if len(value) > 2000:
            raise serializers.ValidationError("El prompt no puede superar los 2000 caracteres.")
        return value

    def validate_texto_generado(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El texto no puede estar vacío.")
        return value


class CampaignVersionSerializer(serializers.ModelSerializer):
    texto_preview = serializers.SerializerMethodField()
    tiene_imagen = serializers.SerializerMethodField()

    class Meta:
        model = CampaignVersion
        fields = [
            'id', 'version_number', 'texto_preview',
            'tiene_imagen', 'imagen_b64', 'created_at',
        ]

    def get_texto_preview(self, obj: CampaignVersion) -> str:
        """Retorna los primeros 200 caracteres del texto para la lista."""
        texto = obj.texto_generado or ''
        return texto[:200] + ('…' if len(texto) > 200 else '')

    def get_tiene_imagen(self, obj: CampaignVersion) -> bool:
        return bool(obj.imagen_b64)
