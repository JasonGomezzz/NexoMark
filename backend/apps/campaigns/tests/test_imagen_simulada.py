"""La imagen de relleno del modo IA simulada: cuadrada, liviana y la misma del PNG fuente."""

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

from services import mock_assets

PNG_FUENTE = Path(mock_assets.__file__).with_name("imagen_simulada_nexomark.png")


def test_imagen_simulada_es_un_png_cuadrado_y_liviano():
    crudo = base64.b64decode(mock_assets.MOCK_IMAGE_B64)
    imagen = Image.open(BytesIO(crudo))
    assert imagen.format == "PNG"
    assert imagen.size == (1024, 1024)
    # Viaja como base64 dentro de PostgreSQL y hasta la app.
    assert len(crudo) < 60 * 1024


def test_imagen_simulada_coincide_con_el_png_fuente():
    # Si falla, se editó una de las dos a mano: regenerar con scripts/dev/generar_imagen_simulada.py
    assert base64.b64decode(mock_assets.MOCK_IMAGE_B64) == PNG_FUENTE.read_bytes()
