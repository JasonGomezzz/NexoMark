/**
 * Reglas del texto para X. Misma lógica que backend/services/x_texto.py: los dos
 * lados se prueban con backend/apps/social/tests/casos_texto_x.json.
 * El servidor decide; esto es para el contador en vivo.
 *
 * Conteo ponderado de twitter-text v3 (consultado el 2026-10-17):
 * https://docs.x.com/fundamentals/counting-characters y
 * https://github.com/twitter/twitter-text/blob/master/config/v3.json
 * - Máximo 280, sobre el texto normalizado en NFC.
 * - Peso 1: puntos de código en 0–4351, 8192–8205, 8208–8223 y 8242–8247. Peso 2: el resto.
 * - Un emoji cuenta 2 aunque sea una secuencia (tono de piel, ZWJ, bandera, tecla).
 * - Una URL cuenta 23. U+FFFE, U+FEFF y U+FFFF hacen inválido el texto.
 * La detección de emoji y de enlaces es una aproximación conservadora (ver el archivo de Python).
 */

export const MAXIMO_X = 280
const LARGO_URL = 23
const RANGOS_PESO_1 = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
]
const INVALIDOS = new Set([0xfffe, 0xfeff, 0xffff])

const EXTENSIONES = [
  'com', 'net', 'org', 'info', 'biz', 'io', 'co', 'me', 'ly', 'app', 'dev', 'ai', 'tv', 'xyz', 'online',
  'site', 'shop', 'store', 'link', 'page', 'blog', 'news', 'live', 'club', 'tech', 'lat', 'digital',
  'agency', 'studio', 'media', 'pe', 'es', 'mx', 'ar', 'cl', 'ec', 'bo', 'uy', 'py', 've', 'br', 'us',
  'uk', 'de', 'fr', 'it', 'gl', 'to', 'gg', 'cc', 'ws', 'fm', 'la', 'sh', 'edu', 'gob', 'gov',
]
const ETIQUETA = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const ANTES = '(?<![A-Za-z0-9@＠$#＃_.\\-/])'
const PATRON_URL =
  '(?:https?://|ftp://)\\S+' +
  `|${ANTES}www\\.\\S+` +
  `|${ANTES}${ETIQUETA}(?:\\.${ETIQUETA})*\\.(?:${EXTENSIONES.join('|')})(?![a-z0-9-])(?:[/?#]\\S*)?`

function regexUrl() {
  return new RegExp(PATRON_URL, 'giu')
}

export function normalizar(texto) {
  return (texto ?? '').normalize('NFC')
}

const pesoUno = (cp) => RANGOS_PESO_1.some(([inicio, fin]) => cp >= inicio && cp <= fin)
const indicadorRegional = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff
const modificador = (cp) => cp === 0xfe0f || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0020 && cp <= 0xe007f)
const SUELTOS = new Set([0x203c, 0x2049, 0x2122, 0x2139, 0x24c2, 0x2934, 0x2935, 0x3030, 0x303d, 0x3297, 0x3299])
const pictograma = (cp) =>
  (cp >= 0x1f000 && cp <= 0x1faff) ||
  (cp >= 0x1fc00 && cp <= 0x1fffd) ||
  (cp >= 0x2600 && cp <= 0x27bf) ||
  (cp >= 0x2300 && cp <= 0x23ff) ||
  (cp >= 0x2b00 && cp <= 0x2bff) ||
  (cp >= 0x2190 && cp <= 0x21ff) ||
  (cp >= 0x25a0 && cp <= 0x25ff) ||
  SUELTOS.has(cp)

/** Índices en UTF-16 (como las coincidencias de RegExp); avanzar un punto de código. */
const siguiente = (s, i) => i + (s.codePointAt(i) > 0xffff ? 2 : 1)

function finElemento(s, k) {
  let j = siguiente(s, k)
  while (j < s.length && modificador(s.codePointAt(j))) j = siguiente(s, j)
  return j
}

/** Índice donde termina el emoji que empieza en i, o i si no empieza uno. */
function finEmoji(s, i) {
  const n = s.length
  const cp = s.codePointAt(i)
  const despues = siguiente(s, i)
  if (indicadorRegional(cp) && despues < n && indicadorRegional(s.codePointAt(despues))) {
    return siguiente(s, despues) // bandera
  }
  if (cp === 0x23 || cp === 0x2a || (cp >= 0x30 && cp <= 0x39)) {
    let k = despues
    if (k < n && s.codePointAt(k) === 0xfe0f) k = siguiente(s, k)
    return k < n && s.codePointAt(k) === 0x20e3 ? siguiente(s, k) : i // tecla: 1️⃣
  }
  if (cp === 0xa9 || cp === 0xae) {
    return despues < n && s.codePointAt(despues) === 0xfe0f ? siguiente(s, despues) : i // ©️ ®️
  }
  if (!pictograma(cp)) return i
  let k = finElemento(s, i)
  while (k < n && s.codePointAt(k) === 0x200d) {
    const unido = siguiente(s, k)
    if (unido >= n || !pictograma(s.codePointAt(unido))) break
    k = finElemento(s, unido) // unión ZWJ: 👩‍💻
  }
  return k
}

/** Primer fragmento que X contaría (y cobraría) como enlace, o null. */
export function buscarUrl(texto) {
  const encontrado = regexUrl().exec(normalizar(texto))
  return encontrado ? encontrado[0] : null
}

export function longitudPonderada(texto) {
  const s = normalizar(texto)
  const urls = new Map()
  for (const m of s.matchAll(regexUrl())) urls.set(m.index, m.index + m[0].length)
  let total = 0
  let i = 0
  while (i < s.length) {
    if (urls.has(i)) {
      total += LARGO_URL
      i = urls.get(i)
      continue
    }
    const fin = finEmoji(s, i)
    if (fin > i) {
      total += 2
      i = fin
      continue
    }
    total += pesoUno(s.codePointAt(i)) ? 1 : 2
    i = siguiente(s, i)
  }
  return total
}

/** {valido, longitud, limite, url, motivo}: mismos mensajes que el servidor. */
export function validarTextoX(texto) {
  const s = normalizar(texto)
  const longitud = longitudPonderada(s)
  const url = buscarUrl(s)
  let motivo = ''
  if (!s.trim()) motivo = 'El texto para X está vacío.'
  else if ([...s].some((c) => INVALIDOS.has(c.codePointAt(0))))
    motivo = 'El texto tiene caracteres invisibles que X no acepta.'
  else if (url)
    motivo =
      `Quita el enlace «${url.slice(0, 40)}»: X cobra US$0.20 por un post con enlace ` +
      '(frente a US$0.015 sin él) y NexoMark no publica enlaces en X.'
  else if (longitud > MAXIMO_X) motivo = `El texto para X tiene ${longitud} de ${MAXIMO_X} caracteres ponderados.`
  return { valido: !motivo, longitud, limite: MAXIMO_X, url, motivo }
}

// ── Estados de la versión para X ─────────────────────────────────────────

const ESTADOS_VARIANTE = {
  borrador: { texto: 'Borrador', tono: 'neutral', ayuda: 'El cliente todavía no la ve. Envíala para que la apruebe.' },
  pendiente_cliente: { texto: 'Esperando al cliente', tono: 'aviso', ayuda: 'El cliente debe aprobar este texto exacto.' },
  aprobada: { texto: 'Aprobada por el cliente', tono: 'ok', ayuda: 'Se publicará exactamente este texto.' },
  rechazada: { texto: 'Rechazada por el cliente', tono: 'error', ayuda: 'Edítala con su comentario y vuelve a enviarla.' },
}

/** Clases de los estados: las mismas parejas de los badges FSM (contraste AA verificado en brandPalette). */
export const TONOS_X = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  aviso: 'bg-warning-container text-tertiary',
  ok: 'bg-success-container text-success',
  error: 'bg-error-container text-error',
}

export function estadoVarianteX(estado) {
  return ESTADOS_VARIANTE[estado] ?? { texto: estado, tono: 'neutral', ayuda: '' }
}

/** Texto de la casilla de confirmación del costo antes de publicar. */
export function textoConfirmacionCosto(config) {
  if (!config) return 'Confirmo publicar en X.'
  return (
    `Confirmo publicar en X (costo aprox. US$${config.costo_post_usd}; ` +
    `quedan ${config.restantes} de ${config.maximo_mes} este mes).`
  )
}

/** ¿Puede el marketero pulsar Publicar? (el servidor vuelve a comprobarlo todo). */
export function puedePublicarX(variante, config, cuentaId, confirmoCosto) {
  return Boolean(
    variante?.estado === 'aprobada' &&
      variante.vigente !== false &&
      config?.habilitado &&
      config.restantes > 0 &&
      cuentaId &&
      confirmoCosto,
  )
}
