"""
Foto de perfil: decodificación acotada y servida solo al propio usuario.

Portado de la rama de Piero (profile_avatar.py). La imagen subida nunca se
guarda tal cual: se decodifica con límites (tamaño, megapíxeles, bomba de
descompresión, un solo cuadro) y se vuelve a codificar como JPEG 256×256
sin EXIF. No se aceptan SVG ni GIF.

    PATCH  /api/auth/me/            multipart con `avatar` o `remove_avatar=true`
    GET    /api/auth/me/avatar/     JPEG (200) o vacío (204); privado, sin caché
"""

import warnings
from io import BytesIO

from django.http import HttpResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from .models import FotoPerfil

MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 16_000_000
LADO = 256
FORMATOS = ("JPEG", "PNG", "WEBP")


def normalizar_foto(upload) -> bytes:
    """
    Devuelve el JPEG 256×256 listo para guardar.

    Raises:
        serializers.ValidationError: archivo grande, formato no permitido,
            imagen animada, demasiado chica o ilegible.
    """
    if upload.size > MAX_BYTES:
        raise serializers.ValidationError("La foto no debe superar 2 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload) as origen:
                if origen.format not in FORMATOS:
                    raise serializers.ValidationError("Usa una imagen JPG, PNG o WebP (no SVG ni GIF).")
                ancho, alto = origen.size
                if min(ancho, alto) < 64 or ancho * alto > MAX_PIXELS:
                    raise serializers.ValidationError(
                        "Usa una foto de al menos 64 × 64 píxeles y de hasta 16 megapíxeles."
                    )
                if getattr(origen, "n_frames", 1) != 1:
                    raise serializers.ValidationError("La foto debe ser una imagen fija, no animada.")
                origen.load()
                cuadrada = ImageOps.fit(
                    ImageOps.exif_transpose(origen).convert("RGBA"),
                    (LADO, LADO),
                    method=Image.Resampling.LANCZOS,
                )
                limpia = Image.new("RGB", (LADO, LADO), "white")
                limpia.paste(cuadrada, mask=cuadrada.getchannel("A"))
                salida = BytesIO()
                limpia.save(salida, format="JPEG", quality=85, optimize=True)
                return salida.getvalue()
    except serializers.ValidationError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise serializers.ValidationError(
            "No se pudo leer la imagen. Elige una foto JPG, PNG o WebP válida."
        ) from None


class MyAvatarView(APIView):
    """GET /api/auth/me/avatar/ — la foto del usuario autenticado (204 si no tiene)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> HttpResponse:
        foto = FotoPerfil.objects.filter(usuario_id=request.user.pk).only("imagen").first()
        if foto is None:
            response = HttpResponse(status=204)
        else:
            response = HttpResponse(bytes(foto.imagen), content_type="image/jpeg")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
