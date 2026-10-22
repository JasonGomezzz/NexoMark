"""
Miniaturas JPEG de la imagen generada, para listas en la app móvil.

La imagen vive como PNG en base64 dentro de `Campaign.imagen_b64`. Reducirla
cuesta ~20 ms, así que el resultado se guarda en la caché (Redis) con una
clave que cambia cuando cambia la imagen (sha1 del base64).
"""

import base64
import binascii
import hashlib
import logging
import warnings
from io import BytesIO

from django.core.cache import cache
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

LADO_MAXIMO = 480
VIGENCIA_CACHE = 60 * 60 * 24


def miniatura_jpeg(campaign_id: int, imagen_b64: str | None) -> bytes | None:
    """JPEG reducido o None si no hay imagen o no se puede leer."""
    if not imagen_b64:
        return None
    huella = hashlib.sha1(imagen_b64.encode()).hexdigest()
    clave = f"miniatura:v1:{campaign_id}:{huella}"
    try:
        guardada = cache.get(clave)
    except Exception:  # noqa: BLE001 — sin caché igual se puede responder
        guardada = None
    if guardada:
        return guardada
    contenido = _reducir(imagen_b64)
    if contenido:
        try:
            cache.set(clave, contenido, timeout=VIGENCIA_CACHE)
        except Exception:  # noqa: BLE001
            logger.warning("No se pudo guardar la miniatura en la caché.")
    return contenido


def _reducir(imagen_b64: str) -> bytes | None:
    datos = imagen_b64.split(",", 1)[1] if imagen_b64.startswith("data:") else imagen_b64
    try:
        crudo = base64.b64decode(datos, validate=False)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(crudo)) as origen:
                origen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.Resampling.LANCZOS)
                lienzo = Image.new("RGB", origen.size, "white")
                rgba = origen.convert("RGBA")
                lienzo.paste(rgba, mask=rgba.getchannel("A"))
                salida = BytesIO()
                lienzo.save(salida, format="JPEG", quality=80, optimize=True)
                return salida.getvalue()
    except (binascii.Error, UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning):
        logger.warning("No se pudo leer la imagen de la campaña para la miniatura.")
        return None
