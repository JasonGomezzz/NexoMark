/**
 * Redes sociales: etiquetas y mensajes. Lógica pura, probada en tests/social.test.js.
 * Las llamadas a la API están en socialApi.js.
 */

const REDES = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', tiktok: 'TikTok' }

/** Redes que se publican solas al aprobar (Instagram y Facebook, con el login de Meta). */
export const REDES_META = ['instagram', 'facebook']

/** X y TikTok van aparte: no entran en "Publicar ahora / Reintentar". */
const REDES_SIN_REINTENTO = ['x', 'tiktok']

export function etiquetaRed(red) {
  return REDES[red] ?? red
}

const ESTADOS = {
  esperando_aprobacion: { texto: 'Se publicará al aprobar', tono: 'neutral' },
  publicando: { texto: 'Publicando…', tono: 'neutral' },
  publicado: { texto: 'Publicado', tono: 'ok' },
  fallido: { texto: 'No se pudo publicar', tono: 'error' },
  cancelado: { texto: 'Cancelado', tono: 'neutral' },
  // Solo TikTok: el borrador llegó al buzón; la persona termina de publicar en la app de TikTok.
  en_buzon: { texto: 'En el buzón de TikTok', tono: 'buzon' },
}

/** TikTok no publica: envía al buzón. Sus estados intermedios se nombran así. */
const ESTADOS_TIKTOK = {
  publicando: { texto: 'Enviando a TikTok…', tono: 'neutral' },
  fallido: { texto: 'No se pudo enviar', tono: 'error' },
}

export function estadoPublicacion(estado, red) {
  if (red === 'tiktok' && ESTADOS_TIKTOK[estado]) return ESTADOS_TIKTOK[estado]
  return ESTADOS[estado] ?? { texto: estado, tono: 'neutral' }
}

/** Igual que MARGEN_ATASCADA en Django: pasado este tiempo en 'publicando' se asume que el proceso murió. */
const MARGEN_ATASCADA_MS = 5 * 60 * 1000

/** ¿Lleva más de 5 minutos en 'publicando'? Entonces se puede reintentar (el servidor revisa antes de repetir). */
export function publicacionAtascada(publicacion, ahora = new Date()) {
  if (publicacion.estado !== 'publicando' || !publicacion.publicando_desde) return false
  return ahora - new Date(publicacion.publicando_desde) > MARGEN_ATASCADA_MS
}

/**
 * ¿Puede el marketero pulsar "Publicar ahora / Reintentar"? Nunca en X (se publica
 * desde la versión para X, confirmando el costo) ni en TikTok (un envío al buzón
 * no se repite: se consulta su estado).
 */
export function puedeReintentar(publicacion, estadoCampana, ahora = new Date()) {
  if (estadoCampana !== 'aprobado' || REDES_SIN_REINTENTO.includes(publicacion.red)) return false
  if (publicacionAtascada(publicacion, ahora)) return true
  return (
    ['fallido', 'esperando_aprobacion'].includes(publicacion.estado) && (publicacion.intentos ?? 0) < 3
  )
}

/**
 * Lee el fragmento (#) con el que Django devuelve el navegador tras el login de Meta.
 * El code y el state viajan en el fragmento para que no lleguen a ningún servidor.
 * @returns {{ tipo: 'codigo', code: string, state: string } | { tipo: 'error', motivo: string }}
 */
export function leerRetornoMeta(hash) {
  const params = new URLSearchParams((hash ?? '').replace(/^#/, ''))
  const error = params.get('error')
  if (error) return { tipo: 'error', motivo: error }
  const code = params.get('code')
  const state = params.get('state')
  if (code && state) return { tipo: 'codigo', code, state }
  return { tipo: 'error', motivo: 'sin_datos' }
}

const MOTIVOS_RETORNO_META = {
  cancelado: 'Cancelaste la conexión con Meta. No se conectó ninguna cuenta.',
  sesion: 'El enlace de conexión caducó o ya se usó. Vuelve a conectar la cuenta desde Redes conectadas.',
  sin_codigo: 'Meta no devolvió la autorización. Vuelve a intentarlo.',
  sin_datos: 'No llegaron los datos de Meta. Vuelve a conectar la cuenta desde Redes conectadas.',
}

export function mensajeMotivoRetornoMeta(motivo) {
  return MOTIVOS_RETORNO_META[motivo] ?? 'No se pudo conectar la cuenta.'
}

const MOTIVOS_RETORNO_X = {
  cancelado: 'Cancelaste la conexión con X. No se conectó ninguna cuenta.',
  sesion: 'El enlace de conexión caducó o ya se usó. Vuelve a conectar la cuenta desde Redes conectadas.',
  sin_codigo: 'X no devolvió la autorización. Vuelve a intentarlo.',
  sin_datos: 'No llegaron los datos de X. Vuelve a conectar la cuenta desde Redes conectadas.',
  desactivado: 'X está desactivado en este servidor.',
}

export function mensajeMotivoRetornoX(motivo) {
  return MOTIVOS_RETORNO_X[motivo] ?? 'No se pudo conectar la cuenta de X.'
}

const MOTIVOS_RETORNO_TIKTOK = {
  cancelado: 'Cancelaste la conexión con TikTok. No se conectó ninguna cuenta.',
  sesion: 'El enlace de conexión caducó o ya se usó. Vuelve a conectar la cuenta desde Redes conectadas.',
  sin_codigo: 'TikTok no devolvió la autorización. Vuelve a intentarlo.',
  sin_datos: 'No llegaron los datos de TikTok. Vuelve a conectar la cuenta desde Redes conectadas.',
}

export function mensajeMotivoRetornoTikTok(motivo) {
  return MOTIVOS_RETORNO_TIKTOK[motivo] ?? 'No se pudo conectar la cuenta de TikTok.'
}

export function textoCuentasConectadas(cantidad) {
  const n = Number(cantidad) || 0
  return n === 1 ? 'Se conectó 1 cuenta.' : `Se conectaron ${n} cuentas.`
}

// ── Estadísticas (Fase 4) ────────────────────────────────────────────────

/** Métricas que muestra cada red, en orden. Facebook llama "reacciones" a sus me gusta. */
const METRICAS = {
  instagram: {
    principales: [
      ['me_gusta', 'Me gusta'],
      ['comentarios', 'Comentarios'],
      ['compartidos', 'Compartidos'],
    ],
    secundarias: [
      ['alcance', 'Alcance'],
      ['vistas', 'Vistas'],
      ['guardados', 'Guardados'],
      ['interacciones', 'Interacciones'],
    ],
  },
  facebook: {
    principales: [
      ['me_gusta', 'Reacciones'],
      ['comentarios', 'Comentarios'],
      ['compartidos', 'Compartidos'],
    ],
    secundarias: [
      ['alcance', 'Alcance'],
      ['vistas', 'Vistas'],
      ['interacciones', 'Clics'],
    ],
  },
  // En X no se leen métricas: cada lectura de la API cuesta (pago por uso).
  x: {
    principales: [],
    secundarias: [],
    sinLectura: true,
    motivoSinLectura:
      'En X solo se cuentan las publicaciones: leer sus métricas cuesta en la API de pago por uso, así que NexoMark no las consulta.',
  },
  // TikTok con los permisos actuales (enviar al buzón) no entrega métricas: todo es "sin dato".
  tiktok: {
    principales: [
      ['me_gusta', 'Me gusta'],
      ['comentarios', 'Comentarios'],
      ['compartidos', 'Compartidos'],
    ],
    secundarias: [],
    sinLectura: true,
    motivoSinLectura:
      'TikTok no entrega métricas con los permisos actuales (solo envío al buzón): sus cifras quedan como «sin dato». Se cuentan las publicaciones.',
  },
}

export function metricasDeRed(red) {
  return METRICAS[red] ?? METRICAS.instagram
}

const NUMERO = new Intl.NumberFormat('es-PE')

/** Un dato que Meta no informa (null/undefined) es "sin dato", nunca 0. */
export function formatoMetrica(valor) {
  if (valor === null || valor === undefined) return 'sin dato'
  return NUMERO.format(valor)
}

const ALCANCE = {
  cliente: 'Solo tus publicaciones aprobadas.',
  marketero: 'Las publicaciones de todos tus clientes.',
  superadmin: 'Todas las publicaciones de la plataforma.',
}

export function alcanceDelRol(rol) {
  return ALCANCE[rol] ?? ALCANCE.cliente
}

/**
 * X es opcional: su panel y su filtro aparecen si está encendida en el servidor
 * o si ya hay publicaciones en X (aunque después se haya apagado).
 */
export function mostrarX({ xConfig, resumen, publicaciones = [] } = {}) {
  return Boolean(xConfig?.habilitado || resumen?.redes?.x?.publicaciones || publicaciones.some((p) => p.red === 'x'))
}

/**
 * TikTok aparece en estadísticas si el servidor lo tiene configurado o si ya hay
 * envíos a TikTok (aunque después se haya quitado la configuración).
 */
export function mostrarTikTok({ tiktokConfig, resumen, publicaciones = [] } = {}) {
  return Boolean(
    tiktokConfig?.configurado || resumen?.redes?.tiktok?.publicaciones || publicaciones.some((p) => p.red === 'tiktok'),
  )
}

/** TikTok cuenta el texto en unidades UTF-16, igual que `String.length` en JavaScript. */
export const MAX_TEXTO_TIKTOK = 4000

export function largoTextoTikTok(texto) {
  return (texto ?? '').trim().length
}

/** Lo que se enviaría a TikTok: el texto aprobado debe tener entre 1 y el máximo de caracteres. */
export function textoTikTokValido(texto, maximo = MAX_TEXTO_TIKTOK) {
  const largo = largoTextoTikTok(texto)
  return largo > 0 && largo <= maximo
}

/** Cuentas de TikTok (por nombre) a las que ya se envió esta campaña: no se reenvía. */
export function cuentasTikTokEnviadas(publicaciones = []) {
  return new Set(publicaciones.filter((p) => p.red === 'tiktok').map((p) => p.cuenta_nombre))
}

/** ¿Tiene sentido preguntar a TikTok por este envío? Solo mientras no terminó. */
export function puedeConsultarTikTok(publicacion) {
  return publicacion?.red === 'tiktok' && ['publicando', 'en_buzon'].includes(publicacion.estado)
}

/** Filtros de la tabla. `estado` acepta 'todas' o un estado de publicación. */
export function filtrarPublicaciones(lista, { red = 'todas', estado = 'todas' } = {}) {
  return lista.filter(
    (p) => (red === 'todas' || p.red === red) && (estado === 'todas' || p.estado === estado),
  )
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Los 12 meses de un año para una red, a partir de `anual` del resumen de Django.
 * - `publicaciones`: conteo propio, así que 0 es real.
 * - `me_gusta`: suma de la última lectura de cada publicación del mes; `null` si
 *   ninguna tenía el dato (no es 0). Lleva cuántas publicaciones tenían dato.
 * @param {{ publicaciones_por_mes?: object[], me_gusta_por_mes?: object[] } | undefined} anual
 * @param {'publicaciones' | 'me_gusta'} medida
 */
export function serieAnual(anual, red, medida = 'publicaciones') {
  const filas = (medida === 'me_gusta' ? anual?.me_gusta_por_mes : anual?.publicaciones_por_mes) ?? []
  return filas.map((fila) => {
    const indice = Number(fila.mes.slice(5, 7)) - 1
    const valor = fila[red]
    return {
      mes: fila.mes,
      etiqueta: MESES_CORTOS[indice],
      nombreMes: MESES_LARGOS[indice],
      total: medida === 'me_gusta' ? (valor ?? null) : (valor ?? 0),
      conDato: fila[`${red}_con_dato`] ?? null,
      publicaciones: fila[`${red}_publicaciones`] ?? null,
    }
  })
}

/** Índice del mes en curso si la serie es del año actual; si no, -1 (ningún mes "actual"). */
export function indiceMesActual(anio, hoy = new Date()) {
  return Number(anio) === hoy.getFullYear() ? hoy.getMonth() : -1
}

/** "hace 5 min", "hace 3 h", "hace 2 días" o la fecha corta. */
export function haceCuanto(fechaIso, ahora = new Date()) {
  if (!fechaIso) return null
  const fecha = new Date(fechaIso)
  const minutos = Math.floor((ahora - fecha) / 60000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
  return fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}
