"""Bounded image decoding; never keep original filenames, EXIF or executable uploads."""
from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 16_000_000


def normalize_avatar(upload):
    if upload.size > MAX_BYTES:
        raise serializers.ValidationError('La foto no debe superar 2 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(upload) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise serializers.ValidationError('Usa una imagen JPG, PNG o WebP, no SVG ni GIF.')
                width, height = source.size
                if min(width, height) < 64 or width * height > MAX_PIXELS:
                    raise serializers.ValidationError('Usa una foto de al menos 64 × 64 píxeles y hasta 16 megapíxeles.')
                if getattr(source, 'n_frames', 1) != 1:
                    raise serializers.ValidationError('La foto debe ser una imagen estática.')
                source.load()
                square = ImageOps.fit(ImageOps.exif_transpose(source).convert('RGBA'), (256, 256), method=Image.Resampling.LANCZOS)
                clean = Image.new('RGB', (256, 256), 'white')
                clean.paste(square, mask=square.getchannel('A'))
                output = BytesIO()
                clean.save(output, format='JPEG', quality=85, optimize=True)
                return output.getvalue()
    except serializers.ValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise serializers.ValidationError('No se pudo leer la imagen. Selecciona una foto JPG, PNG o WebP válida.') from None


class MyAvatarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        image = request.user.avatar
        response = HttpResponse(bytes(image) if image else b'', content_type='image/jpeg', status=200 if image else 204)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
