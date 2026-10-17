from rest_framework import serializers

from services import public_media, x_texto

from .models import Publication, PublicationMetric, RedSocial, SocialConnection, VarianteX


class SocialConnectionSerializer(serializers.ModelSerializer):
    """Nunca incluye el token: solo lo necesario para mostrar y elegir destino."""

    propietario_email = serializers.EmailField(source="usuario.email", read_only=True)
    propietario_rol = serializers.CharField(source="usuario.rol", read_only=True)

    class Meta:
        model = SocialConnection
        fields = [
            "id", "red", "cuenta_nombre", "estado",
            "propietario_email", "propietario_rol", "fecha_creacion",
        ]
        read_only_fields = fields


class PublicationMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicationMetric
        fields = [
            "me_gusta", "comentarios", "compartidos", "guardados",
            "alcance", "vistas", "interacciones", "obtenida_at",
        ]
        read_only_fields = fields


class PublicationSerializer(serializers.ModelSerializer):
    campaign_titulo = serializers.CharField(source="campaign.titulo", read_only=True)
    cliente_nombre = serializers.CharField(source="campaign.cliente_nombre", read_only=True)
    marketero_nombre = serializers.CharField(source="campaign.marketero.nombre", read_only=True, default="")
    ultima_metrica = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            "id", "campaign", "campaign_titulo", "cliente_nombre", "marketero_nombre", "red",
            "cuenta_nombre", "estado", "permalink", "error", "intentos", "version_aprobada",
            "publicando_desde", "publicado_at", "fecha_creacion", "ultima_metrica",
        ]
        read_only_fields = fields

    def get_ultima_metrica(self, obj: Publication):
        # Usa la precarga de metrics_service.con_ultima_metrica si existe.
        ordenadas = getattr(obj, "metricas_ordenadas", None)
        metrica = ordenadas[0] if ordenadas else (None if ordenadas is not None else obj.metricas.first())
        return PublicationMetricSerializer(metrica).data if metrica else None


class PublicationDetailSerializer(PublicationSerializer):
    """Detalle para el panel de estadísticas: además, lo que se publicó (copy e imagen aprobados)."""

    imagen_url = serializers.SerializerMethodField()

    class Meta(PublicationSerializer.Meta):
        fields = PublicationSerializer.Meta.fields + ["copy_aprobado", "imagen_url"]
        read_only_fields = fields

    def get_imagen_url(self, obj: Publication) -> str | None:
        return public_media.url_publica(obj.id) if obj.imagen_aprobada_b64 else None


class PublicacionXSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publication
        fields = [
            "id", "cuenta_nombre", "estado", "permalink", "error", "intentos", "resultado_incierto",
            "publicando_desde", "publicado_at",
        ]
        read_only_fields = fields


class VarianteXSerializer(serializers.ModelSerializer):
    """
    Versión para X. `hash_texto` es el sha256 del texto: el cliente lo devuelve
    al aprobar para demostrar que aprobó exactamente lo que tenía en pantalla.
    """

    campaign_titulo = serializers.CharField(source="campaign.titulo", read_only=True)
    cliente_nombre = serializers.CharField(source="campaign.cliente_nombre", read_only=True)
    longitud = serializers.SerializerMethodField()
    limite = serializers.SerializerMethodField()
    hash_texto = serializers.SerializerMethodField()
    vigente = serializers.SerializerMethodField()
    bloqueada = serializers.SerializerMethodField()
    publicaciones = serializers.SerializerMethodField()

    class Meta:
        model = VarianteX
        fields = [
            "id", "campaign", "campaign_titulo", "cliente_nombre", "texto", "estado", "longitud", "limite",
            "hash_texto", "generada_por_ia", "feedback_cliente", "version_origen", "vigente", "bloqueada",
            "enviada_at", "aprobada_at", "fecha_creacion", "fecha_actualizacion", "publicaciones",
        ]
        read_only_fields = fields

    def get_longitud(self, obj: VarianteX) -> int:
        return x_texto.longitud_ponderada(obj.texto)

    def get_limite(self, obj: VarianteX) -> int:
        return x_texto.MAXIMO

    def get_hash_texto(self, obj: VarianteX) -> str:
        return x_texto.hash_texto(obj.texto)

    def get_vigente(self, obj: VarianteX) -> bool:
        """False si el copy o la imagen de la campaña cambiaron desde que se preparó (no debería pasar)."""
        from services.x_publication_service import hash_campana

        return hash_campana(obj.campaign) == obj.hash_origen

    def get_bloqueada(self, obj: VarianteX) -> bool:
        from services.x_publication_service import bloqueada

        return bloqueada(obj)

    def get_publicaciones(self, obj: VarianteX):
        qs = Publication.objects.filter(campaign_id=obj.campaign_id, red=RedSocial.X).order_by("-fecha_creacion")
        return PublicacionXSerializer(qs, many=True).data
