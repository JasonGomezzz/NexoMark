"""
MarketMind IA — Servicio de mejora de copy con Gemini (síncrono).

A diferencia del flujo de generación completa (que pasa por n8n para copy +
imagen), este servicio llama a Gemini DIRECTAMENTE para reescribir/mejorar el
texto ya generado, SIN tocar la imagen. Se usa en el botón "Mejorar redacción
con IA" del editor: es una operación rápida (solo texto) y síncrona, por lo que
no necesita la orquestación asíncrona de n8n.

En modo USE_MOCK_AI=True devuelve una mejora simulada (no consume cuota Gemini).
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)


def improve_copy(texto_actual: str, industria: str, tono: str, plataforma: str) -> str:
    """
    Mejora el copy publicitario dado usando Gemini (o un mock en dev).

    Args:
        texto_actual: El copy actual a mejorar.
        industria/tono/plataforma: Contexto de la campaña para guiar el estilo.

    Returns:
        El copy mejorado. Si Gemini falla, devuelve el texto original (nunca
        rompe el flujo del editor).
    """
    texto_actual = (texto_actual or "").strip()
    if not texto_actual:
        return texto_actual

    if settings.USE_MOCK_AI:
        logger.info("USE_MOCK_AI activo — mejora de copy simulada.")
        return (
            f"✨ {texto_actual} "
            "¡No dejes pasar esta oportunidad — actúa hoy!"
        )

    prompt = (
        "Eres un copywriter publicitario senior. Mejora el siguiente copy para "
        f"una campaña de industria '{industria}', tono '{tono}', plataforma "
        f"'{plataforma}'. Hazlo más persuasivo, claro y con mejor gancho, "
        "manteniendo el idioma español y una longitud similar. Conserva los "
        "hashtags y emojis si aportan. Responde SOLO con el copy mejorado, sin "
        "comillas ni explicaciones.\n\nCOPY ACTUAL:\n" + texto_actual
    )

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "thinkingConfig": {"thinkingBudget": 0},
            "maxOutputTokens": 1024,
        },
    }
    url = _GEMINI_URL.format(model=settings.GEMINI_MODEL)

    try:
        response = httpx.post(
            url,
            params={"key": settings.GEMINI_API_KEY},
            json=body,
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        # Gemini 2.5 puede devolver thought parts antes del texto real.
        parts = data["candidates"][0]["content"]["parts"]
        texto = next(
            (p["text"] for p in parts if p.get("text", "").strip()),
            "",
        ).strip()
        return texto or texto_actual
    except (httpx.HTTPError, KeyError, IndexError) as exc:
        logger.warning("Gemini no pudo mejorar el copy: %s", exc)
        return texto_actual


def resumir_para_x(texto_aprobado: str, industria: str, tono: str) -> tuple[str, bool]:
    """
    Resume el copy aprobado para X ("Resumir para X"). No cobra crédito: igual
    que improve_copy, es una edición asistida, y el resultado es una variante
    que el cliente todavía debe aprobar.

    Returns:
        (texto, generado_por_ia). En USE_MOCK_AI, o si Gemini falla o devuelve
        algo que X no acepta (más de 280 ponderados o un enlace), se usa un
        resumen recortado determinista (x_texto.resumen_basico) y
        generado_por_ia es False: nunca se presenta como IA lo que no lo es.
    """
    from services import x_texto

    texto_aprobado = (texto_aprobado or "").strip()
    if not texto_aprobado:
        return "", False

    if settings.USE_MOCK_AI:
        logger.info("USE_MOCK_AI activo — resumen para X determinista, sin Gemini.")
        return x_texto.resumen_basico(texto_aprobado), False

    prompt = (
        "Eres un copywriter publicitario senior. Resume el siguiente copy ya aprobado "
        f"para un post en X (industria '{industria}', tono '{tono}'). Reglas: español, "
        "máximo 240 caracteres, SIN enlaces ni direcciones web, conserva la oferta y como "
        "mucho dos hashtags del original, no inventes datos ni precios. Responde SOLO con "
        "el texto del post, sin comillas ni explicaciones.\n\nCOPY APROBADO:\n" + texto_aprobado
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"thinkingConfig": {"thinkingBudget": 0}, "maxOutputTokens": 512},
    }
    try:
        response = httpx.post(
            _GEMINI_URL.format(model=settings.GEMINI_MODEL),
            params={"key": settings.GEMINI_API_KEY},
            json=body,
            timeout=30.0,
        )
        response.raise_for_status()
        parts = response.json()["candidates"][0]["content"]["parts"]
        resumen = next((p["text"] for p in parts if p.get("text", "").strip()), "").strip().strip('"“”')
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        logger.warning("Gemini no pudo resumir para X: %s", exc)
        return x_texto.resumen_basico(texto_aprobado), False

    if resumen and x_texto.validar(resumen)["valido"]:
        return x_texto.normalizar(resumen), True
    logger.warning("El resumen de Gemini no cumple las reglas de X; se usa el recorte determinista.")
    return x_texto.resumen_basico(texto_aprobado), False
