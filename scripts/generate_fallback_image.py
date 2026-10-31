"""Genera el fallback visual de NexoMark y lo incrusta en los workflows n8n."""

from __future__ import annotations

import base64
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "backend" / "services" / "assets" / "nexomark-image-unavailable.png"
WORKFLOWS = (
    ROOT / "n8n" / "marketmind_ia_workflow.json",
)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, text_font, fill: str) -> None:
    box = draw.textbbox((0, 0), text, font=text_font)
    draw.text(((1600 - (box[2] - box[0])) / 2, y), text, font=text_font, fill=fill)


def build_image() -> bytes:
    width, height = 1600, 900
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            blend = (x + y) / (width + height)
            pixels[x, y] = (
                int(17 + 18 * blend),
                int(19 + 19 * blend),
                int(34 + 34 * blend),
            )

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((105, 90, 1495, 810), radius=45, fill="#191c2d", outline="#625bff", width=4)
    draw.rounded_rectangle((105, 90, 1495, 108), radius=9, fill="#625bff")

    # Isotipo simplificado: N conectada + ondas de difusión.
    draw.rounded_rectangle((670, 170, 930, 430), radius=70, fill="#5546e8")
    draw.line((725, 365, 725, 235, 865, 365, 865, 235), fill="white", width=28, joint="curve")
    draw.ellipse((710, 350, 740, 380), fill="#bff6ff")
    draw.ellipse((850, 220, 880, 250), fill="#e8e5ff")
    draw.arc((875, 265, 945, 345), start=-65, end=65, fill="#bff6ff", width=10)
    draw.arc((885, 245, 980, 365), start=-65, end=65, fill="#bff6ff", width=8)
    draw.line((895, 190, 895, 158), fill="#bff6ff", width=9)
    draw.line((879, 174, 911, 174), fill="#bff6ff", width=9)

    centered(draw, 485, "Imagen no disponible", font("segoeuib.ttf", 66), "#f4f4ff")
    centered(
        draw,
        585,
        "Gemini no devolvió una imagen. Reintenta en unos minutos.",
        font("segoeui.ttf", 34),
        "#bfc3d9",
    )
    centered(draw, 725, "NexoMark IA", font("segoeuib.ttf", 28), "#8f88ff")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    return OUTPUT.read_bytes()


def update_workflows(png: bytes) -> None:
    replacement = base64.b64encode(png).decode("ascii")
    pattern = re.compile(r"iVBORw0KGgoAAA[A-Za-z0-9+/=]{1000,}")
    for workflow in WORKFLOWS:
        if not workflow.exists():
            continue
        raw = workflow.read_text(encoding="utf-8")
        updated, count = pattern.subn(replacement, raw)
        if count:
            workflow.write_text(updated, encoding="utf-8")
        print(f"{workflow.name}: {count} fallback(s) actualizado(s)")


if __name__ == "__main__":
    update_workflows(build_image())
    print(OUTPUT)
