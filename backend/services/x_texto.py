"""
Reglas del texto para X. Misma lógica que frontend/src/services/xTexto.js: los
dos lados se prueban con los casos de apps/social/tests/casos_texto_x.json.

Conteo ponderado de twitter-text v3. Fuentes consultadas el 2026-10-17:
- https://docs.x.com/fundamentals/counting-characters
- https://github.com/twitter/twitter-text/blob/master/config/v3.json
  (maxWeightedTweetLength 280, scale 100, defaultWeight 200,
  transformedURLLength 23, emojiParsingEnabled true y rangos de peso 100).

Reglas:
- Se cuenta sobre el texto normalizado en NFC.
- Peso 1: puntos de código en 0–4351, 8192–8205, 8208–8223 y 8242–8247
  (latín con tildes, signos, griego, cirílico, hebreo, árabe, etc.).
- Peso 2: todo lo demás (CJK, emoji, símbolos).
- Un emoji cuenta 2 aunque sea una secuencia (tono de piel, unión ZWJ,
  bandera, tecla con número).
- Una URL cuenta 23.
- U+FFFE, U+FEFF y U+FFFF hacen inválido el texto.

Aproximaciones (documentadas, no son el código de twitter-text):
- Los emoji se reconocen por rangos de pictogramas, no con la expresión
  completa de twemoji. Un emoji suelto pesa 2 en ambos casos; la diferencia
  solo aparecería en secuencias raras.
- La detección de URL es CONSERVADORA: con protocolo, con "www." o un dominio
  con una extensión frecuente. X cobra US$0.20 por un post con enlace (frente a
  US$0.015 sin él), así que NexoMark no deja publicar texto con enlaces.
  Un correo (nombre@dominio.pe) no es URL, igual que en twitter-text.
"""

import hashlib
import re
import unicodedata

MAXIMO = 280
LARGO_URL = 23
RANGOS_PESO_1 = ((0, 4351), (8192, 8205), (8208, 8223), (8242, 8247))
INVALIDOS = {0xFFFE, 0xFEFF, 0xFFFF}

EXTENSIONES = (
    "com", "net", "org", "info", "biz", "io", "co", "me", "ly", "app", "dev", "ai", "tv", "xyz", "online",
    "site", "shop", "store", "link", "page", "blog", "news", "live", "club", "tech", "lat", "digital",
    "agency", "studio", "media", "pe", "es", "mx", "ar", "cl", "ec", "bo", "uy", "py", "ve", "br", "us",
    "uk", "de", "fr", "it", "gl", "to", "gg", "cc", "ws", "fm", "la", "sh", "edu", "gob", "gov",
)
_ETIQUETA = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
_ANTES = r"(?<![A-Za-z0-9@＠$#＃_.\-/])"
PATRON_URL = (
    r"(?:https?://|ftp://)\S+"
    rf"|{_ANTES}www\.\S+"
    rf"|{_ANTES}{_ETIQUETA}(?:\.{_ETIQUETA})*\.(?:{'|'.join(EXTENSIONES)})(?![a-z0-9-])(?:[/?#]\S*)?"
)
_URL = re.compile(PATRON_URL, re.IGNORECASE)


def normalizar(texto: str | None) -> str:
    return unicodedata.normalize("NFC", texto or "")


def _peso_uno(cp: int) -> bool:
    return any(inicio <= cp <= fin for inicio, fin in RANGOS_PESO_1)


def _indicador_regional(cp: int) -> bool:
    return 0x1F1E6 <= cp <= 0x1F1FF


def _modificador(cp: int) -> bool:
    """Selector de variación emoji, tono de piel o etiqueta (banderas de subdivisión)."""
    return cp == 0xFE0F or 0x1F3FB <= cp <= 0x1F3FF or 0xE0020 <= cp <= 0xE007F


def _pictograma(cp: int) -> bool:
    return (
        0x1F000 <= cp <= 0x1FAFF
        or 0x1FC00 <= cp <= 0x1FFFD
        or 0x2600 <= cp <= 0x27BF
        or 0x2300 <= cp <= 0x23FF
        or 0x2B00 <= cp <= 0x2BFF
        or 0x2190 <= cp <= 0x21FF
        or 0x25A0 <= cp <= 0x25FF
        or cp in (0x203C, 0x2049, 0x2122, 0x2139, 0x24C2, 0x2934, 0x2935, 0x3030, 0x303D, 0x3297, 0x3299)
    )


def _fin_elemento(cps: list[int], k: int) -> int:
    k += 1
    while k < len(cps) and _modificador(cps[k]):
        k += 1
    return k


def _fin_emoji(cps: list[int], i: int) -> int:
    """Índice donde termina el emoji que empieza en i, o i si no empieza uno."""
    n, cp = len(cps), cps[i]
    if _indicador_regional(cp) and i + 1 < n and _indicador_regional(cps[i + 1]):
        return i + 2  # bandera
    if cp in (0x23, 0x2A) or 0x30 <= cp <= 0x39:  # tecla: 1️⃣ #️⃣ *️⃣
        k = i + 1
        if k < n and cps[k] == 0xFE0F:
            k += 1
        return k + 1 if k < n and cps[k] == 0x20E3 else i
    if cp in (0xA9, 0xAE):  # © y ® solo son emoji con el selector FE0F
        return i + 2 if i + 1 < n and cps[i + 1] == 0xFE0F else i
    if not _pictograma(cp):
        return i
    k = _fin_elemento(cps, i)
    while k + 1 < n and cps[k] == 0x200D and _pictograma(cps[k + 1]):  # unión ZWJ: 👩‍💻
        k = _fin_elemento(cps, k + 1)
    return k


def buscar_url(texto: str | None) -> str | None:
    """Primer fragmento que X contaría (y cobraría) como enlace, o None."""
    encontrado = _URL.search(normalizar(texto))
    return encontrado.group(0) if encontrado else None


def longitud_ponderada(texto: str | None) -> int:
    texto = normalizar(texto)
    urls = {m.start(): m.end() for m in _URL.finditer(texto)}
    cps = [ord(c) for c in texto]
    total, i = 0, 0
    while i < len(cps):
        if i in urls:
            total += LARGO_URL
            i = urls[i]
            continue
        fin = _fin_emoji(cps, i)
        if fin > i:
            total += 2
            i = fin
            continue
        total += 1 if _peso_uno(cps[i]) else 2
        i += 1
    return total


def validar(texto: str | None) -> dict:
    """{valido, longitud, limite, url, motivo}. `motivo` explica en español qué corregir."""
    texto = normalizar(texto)
    longitud = longitud_ponderada(texto)
    url = buscar_url(texto)
    motivo = ""
    if not texto.strip():
        motivo = "El texto para X está vacío."
    elif any(ord(c) in INVALIDOS for c in texto):
        motivo = "El texto tiene caracteres invisibles que X no acepta."
    elif url:
        motivo = (
            f"Quita el enlace «{url[:40]}»: X cobra US$0.20 por un post con enlace "
            "(frente a US$0.015 sin él) y NexoMark no publica enlaces en X."
        )
    elif longitud > MAXIMO:
        motivo = f"El texto para X tiene {longitud} de {MAXIMO} caracteres ponderados."
    return {"valido": not motivo, "longitud": longitud, "limite": MAXIMO, "url": url, "motivo": motivo}


def resumen_basico(texto: str | None) -> str:
    """
    Resumen determinista (sin IA): quita enlaces y caracteres inválidos, junta
    espacios y recorta por palabras hasta 280 ponderados con "…". Es el resumen
    del modo USE_MOCK_AI y el respaldo si Gemini falla.
    """
    limpio = _URL.sub("", normalizar(texto))
    limpio = "".join(c for c in limpio if ord(c) not in INVALIDOS)
    limpio = re.sub(r"\s+", " ", limpio).strip()
    if longitud_ponderada(limpio) <= MAXIMO:
        return limpio
    resultado = ""
    for palabra in limpio.split(" "):
        candidato = f"{resultado} {palabra}".strip()
        if longitud_ponderada(candidato + "…") > MAXIMO:
            break
        resultado = candidato
    if not resultado:  # una sola "palabra" enorme (p. ej. texto CJK sin espacios)
        for caracter in limpio:
            if longitud_ponderada(resultado + caracter + "…") > MAXIMO:
                break
            resultado += caracter
    return resultado.rstrip(" ,.;:-") + "…"


def hash_texto(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()
