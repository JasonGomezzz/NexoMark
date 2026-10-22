"""Genera la imagen de relleno del modo IA simulada (USE_MOCK_AI=True).

Dibuja con Pillow un PNG cuadrado de 1024 x 1024: fondo azul marino de NexoMark,
el icono aprobado (brand/nexomark-icon-approved-1024.png) centrado y debajo
"Imagen de ejemplo" / "IA simulada · NexoMark IA" en Inter. Rotula la imagen como
ejemplo para que nadie la confunda con una generación real de Gemini.

Escribe dos cosas:
  - backend/services/imagen_simulada_nexomark.png  (el PNG, para verlo y revisarlo)
  - la constante MOCK_IMAGE_B64 de backend/services/mock_assets.py

Desde la raíz del repo, con el venv del backend:

    backend/venv/bin/python scripts/dev/generar_imagen_simulada.py
    backend/venv/bin/python scripts/dev/generar_imagen_simulada.py --solo-png

Inter no vive en el repo (la web la carga de Google Fonts). El script la busca en
NEXOMARK_FUENTES (carpeta con Inter-Regular y Inter-SemiBold, .otf o .ttf), en las
carpetas de fuentes del sistema y en el runtime de JetBrains que traen Android
Studio e IntelliJ. Si no la encuentra usa Helvetica/Arial y lo avisa.

El PNG se guarda con paleta indexada: la imagen viaja como base64 dentro de
PostgreSQL y hasta la app, así que pesa poco (unos 20 KB).
"""

import argparse
import base64
import glob
import io
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ICONO = ROOT / "brand" / "nexomark-icon-approved-1024.png"
PNG_SALIDA = ROOT / "backend" / "services" / "imagen_simulada_nexomark.png"
MODULO = ROOT / "backend" / "services" / "mock_assets.py"

LADO = 1024
# Tokens de frontend/DESIGN.md
MARINO = (0x14, 0x28, 0x3F)  # navy
TEXTO = (0xFF, 0xFF, 0xFF)  # on-navy
TEXTO_SUAVE = (0xB9, 0xCB, 0xD8)  # on-navy-muted
TURQUESA = (0x17, 0xB8, 0xAD)  # turquoise

TITULO = "Imagen de ejemplo"
SUBTITULO = "IA simulada · NexoMark IA"

LADO_ICONO = 600
TAM_TITULO = 76
TAM_SUBTITULO = 42
SEPARACION_ICONO = 64
SEPARACION_TEXTOS = 22

CARPETAS_FUENTES = [
    os.environ.get("NEXOMARK_FUENTES", ""),
    "~/Library/Fonts",
    "/Library/Fonts",
    "/usr/share/fonts/**",
    "/usr/local/share/fonts/**",
    "/Applications/*.app/Contents/jbr/Contents/Home/lib/fonts",
    "~/.gradle/jdks/*/Contents/Home/lib/fonts",
]
RESPALDO = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def luminancia(rgb):
    def canal(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (canal(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def buscar_fuente(peso):
    """Ruta de Inter-Regular o Inter-SemiBold, o None si no está instalada."""
    for carpeta in CARPETAS_FUENTES:
        if not carpeta:
            continue
        base = os.path.expanduser(carpeta)
        for ext in ("otf", "ttf"):
            patron = os.path.join(base, f"Inter-{peso}.{ext}")
            coincidencias = sorted(glob.glob(patron, recursive=True))
            if coincidencias:
                return coincidencias[0]
    return None


def cargar_fuente(peso, tamano):
    ruta = buscar_fuente(peso)
    if ruta:
        return ImageFont.truetype(ruta, tamano), ruta
    for respaldo in RESPALDO:
        if os.path.exists(respaldo):
            print(f"AVISO: no encontré Inter-{peso}; uso {respaldo}", file=sys.stderr)
            return ImageFont.truetype(respaldo, tamano), respaldo
    sys.exit(f"No encontré Inter-{peso} ni una fuente de respaldo. Define NEXOMARK_FUENTES.")


def texto_centrado(dibujo, y, texto, fuente, color):
    """Dibuja el texto centrado en horizontal con su borde superior visible en y."""
    caja = dibujo.textbbox((0, 0), texto, font=fuente)
    ancho, alto = caja[2] - caja[0], caja[3] - caja[1]
    dibujo.text(((LADO - ancho) / 2 - caja[0], y - caja[1]), texto, font=fuente, fill=color)
    return alto


def medir(dibujo, texto, fuente):
    caja = dibujo.textbbox((0, 0), texto, font=fuente)
    return caja[3] - caja[1]


def dibujar():
    for nombre, fondo, frente in (("titulo", MARINO, TEXTO), ("subtitulo", MARINO, TEXTO_SUAVE)):
        razon = contraste(fondo, frente)
        if razon < 4.5:
            sys.exit(f"El {nombre} no cumple AA: contraste {razon:.2f}:1")

    imagen = Image.new("RGB", (LADO, LADO), MARINO)
    dibujo = ImageDraw.Draw(imagen)
    titulo, ruta_titulo = cargar_fuente("SemiBold", TAM_TITULO)
    subtitulo, _ = cargar_fuente("Regular", TAM_SUBTITULO)

    alto_titulo = medir(dibujo, TITULO, titulo)
    alto_subtitulo = medir(dibujo, SUBTITULO, subtitulo)

    # El cuadrado del icono es del mismo marino que el fondo: se ve la N. Se aplana
    # sobre el marino antes de reducir (así las esquinas transparentes no dejan un
    # borde oscuro) y se centra lo que se ve, la N más los textos.
    maestro = Image.open(ICONO).convert("RGBA")
    plano = Image.new("RGB", maestro.size, MARINO)
    plano.paste(maestro, mask=maestro)
    icono = plano.resize((LADO_ICONO, LADO_ICONO), Image.LANCZOS)
    diferencia = ImageChops.difference(icono, Image.new("RGB", icono.size, MARINO)).convert("L")
    n_arriba, n_abajo = diferencia.point(lambda v: 255 if v > 40 else 0).getbbox()[1::2]
    alto_n = n_abajo - n_arriba

    bloque = alto_n + SEPARACION_ICONO + alto_titulo + SEPARACION_TEXTOS + alto_subtitulo
    y = (LADO - bloque) // 2
    imagen.paste(icono, ((LADO - LADO_ICONO) // 2, y - n_arriba))
    y += alto_n + SEPARACION_ICONO

    texto_centrado(dibujo, y, TITULO, titulo, TEXTO)
    y += alto_titulo + SEPARACION_TEXTOS
    texto_centrado(dibujo, y, SUBTITULO, subtitulo, TEXTO_SUAVE)

    print(f"Fuente: {ruta_titulo}")
    print(f"Contraste titulo {contraste(MARINO, TEXTO):.1f}:1, subtitulo {contraste(MARINO, TEXTO_SUAVE):.1f}:1")
    return imagen


def a_png(imagen):
    # Paleta fija (marino, blanco, turquesa y sus mezclas): sin tramado, el borde
    # de las letras queda limpio y el archivo pesa una fracción del RGB.
    indexada = imagen.quantize(colors=48, method=Image.MEDIANCUT, dither=Image.NONE)
    salida = io.BytesIO()
    indexada.save(salida, format="PNG", optimize=True)
    return salida.getvalue()


def escribir_modulo(png):
    codigo = MODULO.read_text(encoding="utf-8")
    nueva = f'MOCK_IMAGE_B64 = "{base64.b64encode(png).decode("ascii")}"'
    codigo, cambios = re.subn(r'^MOCK_IMAGE_B64 = ".*"$', lambda _: nueva, codigo, flags=re.M)
    if cambios != 1:
        sys.exit(f"No encontré la línea MOCK_IMAGE_B64 en {MODULO}")
    MODULO.write_text(codigo, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--solo-png", action="store_true", help="No tocar mock_assets.py")
    parser.add_argument("--salida", type=Path, default=PNG_SALIDA, help="Ruta del PNG")
    args = parser.parse_args()

    png = a_png(dibujar())
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_bytes(png)
    print(f"PNG: {args.salida} ({len(png) / 1024:.1f} KB)")

    if not args.solo_png:
        escribir_modulo(png)
        print(f"Actualizado {MODULO.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
