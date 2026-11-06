/**
 * Lógica pura del dictado de campañas (sin React ni DOM, para poder probarla).
 *
 * El navegador transcribe la voz (en el equipo si lo permite); aquí solo se
 * arma el texto, se decide cómo dictar y qué campos interpretados por el
 * backend pueden volcarse al formulario. Nunca se sube audio.
 */

export const CAMPOS_INTENT = [
  'titulo',
  'cliente_nombre',
  'cliente_email',
  'industria',
  'tono',
  'plataforma',
  'prompt',
]

export const MIN_BRIEF = 10
export const MAX_BRIEF = 2000

/** Constructor de reconocimiento de voz del navegador, o null si no existe. */
export function getSpeechRecognition(scope = globalThis) {
  return scope?.SpeechRecognition || scope?.webkitSpeechRecognition || null
}

/**
 * ¿Se puede dictar en este navegador?
 *
 * Brave expone webkitSpeechRecognition pero bloquea el servicio que la
 * respalda: siempre falla con error 'network'. Se detecta antes para no
 * ofrecer un botón que nunca funciona.
 */
export function dictationSupport(scope = globalThis) {
  if (scope?.navigator?.brave) return { supported: false, reason: 'brave' }
  if (!getSpeechRecognition(scope)) return { supported: false, reason: 'unsupported' }
  return { supported: true, reason: '' }
}

export function unsupportedMessage(reason) {
  if (reason === 'brave') {
    return 'Brave bloquea el dictado por voz. Usa Chrome o Edge, o escribe el brief.'
  }
  return 'Este navegador no permite dictar. Usa Chrome, Edge o Safari, o escribe el brief.'
}

/**
 * Dónde transcribe la voz el navegador. A NexoMark solo llega el texto en
 * todos los casos; lo que cambia es si el audio sale del equipo.
 *
 * - local: `processLocally = true`. El navegador transcribe en el equipo
 *   (Chrome y Edge 139+ de escritorio, con el paquete de idioma instalado).
 * - servidor: el navegador puede enviar el audio a sus servidores (Chrome
 *   lo hace así por defecto).
 * - comprobando: se está preguntando al navegador; no se dicta todavía.
 *
 * Fuentes (MDN, consultadas el 2026-10-16): SpeechRecognition.processLocally,
 * SpeechRecognition.available() y SpeechRecognition.install().
 */
export const PROCESAMIENTO = {
  LOCAL: 'local',
  SERVIDOR: 'servidor',
  COMPROBANDO: 'comprobando',
}

/** Variantes de español aceptables para dictar en el equipo, de más a menos cercana a es-PE. */
export const ESPANOL_CERCANO = ['es-419', 'es-US', 'es-MX', 'es-ES']

/** Idiomas a consultar para el dictado local: el pedido primero y luego variantes cercanas. */
export function idiomasLocales(lang = 'es-PE') {
  return [lang, ...ESPANOL_CERCANO.filter((variante) => variante !== lang)]
}

/** ¿El navegador permite pedir reconocimiento en el equipo? */
export function soportaDictadoLocal(scope = globalThis) {
  return typeof getSpeechRecognition(scope)?.available === 'function'
}

/**
 * Decide cómo dictar preguntando a `SpeechRecognition.available()` por cada idioma.
 *
 * @param {Function|null} SpeechRecognition  constructor del navegador (o un doble en tests)
 * @param {string[]} idiomas  en orden de preferencia; el primero es el que se usa en servidor
 * @returns {Promise<{ modo: string, lang: string, descargable: string|null, descargando: boolean }>}
 */
export async function planDictado(SpeechRecognition, idiomas = idiomasLocales()) {
  const preferido = idiomas[0]
  const enServidor = { modo: PROCESAMIENTO.SERVIDOR, lang: preferido, descargable: null, descargando: false }
  if (typeof SpeechRecognition?.available !== 'function') return enServidor

  const estados = await Promise.all(
    idiomas.map(async (lang) => {
      try {
        return await SpeechRecognition.available({ langs: [lang], processLocally: true, quality: 'dictation' })
      } catch {
        // Lo bloquea un Permissions-Policy o la etiqueta no es válida: se trata como no disponible.
        return 'unavailable'
      }
    }),
  )

  const listo = estados.indexOf('available')
  if (listo >= 0) return { modo: PROCESAMIENTO.LOCAL, lang: idiomas[listo], descargable: null, descargando: false }

  const descargando = estados.includes('downloading')
  const descargable = estados.indexOf('downloadable')
  const puedeInstalar = typeof SpeechRecognition.install === 'function'
  return {
    ...enServidor,
    descargando,
    descargable: !descargando && puedeInstalar && descargable >= 0 ? idiomas[descargable] : null,
  }
}

/** Aviso breve y honesto de dónde se transcribe la voz. */
export function avisoProcesamiento(modo) {
  switch (modo) {
    case PROCESAMIENTO.LOCAL:
      return 'Tu navegador transcribe la voz en este equipo. NexoMark solo recibe el texto.'
    case PROCESAMIENTO.COMPROBANDO:
      return 'Comprobando si tu navegador puede transcribir en este equipo…'
    default:
      return 'Tu navegador puede enviar el audio a sus servidores para transcribirlo (Chrome lo hace así por defecto). NexoMark solo recibe el texto.'
  }
}

/**
 * Qué hacer ante un error del reconocimiento. Si el dictado local no tiene el
 * idioma listo se pasa al modo servidor, pero no se reinicia solo: el usuario
 * vuelve a pulsar Dictar sabiendo que el audio puede salir del equipo.
 */
export function reaccionErrorDictado(code, modo) {
  if (modo === PROCESAMIENTO.LOCAL && code === 'language-not-supported') return 'pasar-a-servidor'
  return 'mostrar'
}

export const MENSAJE_LOCAL_NO_LISTO =
  'El español no está listo para dictar en este equipo. Pulsa Dictar otra vez: tu navegador puede enviar el audio a sus servidores para transcribirlo.'

/**
 * Separa lo ya confirmado por el navegador de lo que aún está reconociendo.
 * `results` es un SpeechRecognitionResultList (o un arreglo con la misma forma).
 */
export function buildTranscript(results) {
  let finalText = ''
  let interimText = ''
  for (let i = 0; i < results.length; i += 1) {
    const texto = results[i][0]?.transcript ?? ''
    if (results[i].isFinal) finalText += texto
    else interimText += texto
  }
  return { finalText: limpiar(finalText), interimText: limpiar(interimText) }
}

/** Une el texto previo con lo nuevo dictado, sin duplicar espacios. */
export function appendDictation(previo, nuevo) {
  return limpiar(`${previo ?? ''} ${nuevo ?? ''}`).slice(0, MAX_BRIEF)
}

function limpiar(texto) {
  return texto.replace(/\s+/g, ' ').trim()
}

/** Mensaje para el usuario según el código de error del reconocimiento. */
export function speechErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No hay permiso para usar el micrófono. Actívalo en el navegador o escribe el brief.'
    case 'no-speech':
      return 'No se escuchó nada. Intenta de nuevo, más cerca del micrófono.'
    case 'audio-capture':
      return 'No se encontró un micrófono. Puedes escribir el brief.'
    case 'network':
      return 'El servicio de dictado del navegador no respondió. Revisa la conexión o usa Chrome o Edge; también puedes escribir el brief.'
    case 'language-not-supported':
      return 'Tu navegador no puede dictar en español. Escribe el brief.'
    case 'aborted':
      return ''
    default:
      return 'El dictado se interrumpió. Intenta de nuevo o escribe el brief.'
  }
}

/**
 * Decide qué campos interpretados se vuelcan al formulario.
 *
 * Un valor de lista (industria, tono, plataforma) solo se acepta si existe
 * como opción en el formulario; lo demás queda para que el usuario lo complete.
 *
 * @param {object} campos   campos_finales del intent
 * @param {object} opciones { industria: [...], tono: [...], plataforma: [...] } con los `value` válidos
 * @returns {{ valores: object, completados: string[], pendientes: string[] }}
 */
export function camposParaFormulario(campos, opciones = {}) {
  const valores = {}
  const completados = []
  const pendientes = []

  for (const campo of CAMPOS_INTENT) {
    const valor = typeof campos?.[campo] === 'string' ? campos[campo].trim() : ''
    const permitidos = opciones[campo]
    if (valor && (!permitidos || permitidos.includes(valor))) {
      valores[campo] = valor
      completados.push(campo)
    } else {
      pendientes.push(campo)
    }
  }
  return { valores, completados, pendientes }
}

/** Valida el brief antes de enviarlo a interpretar. Devuelve '' si es válido. */
export function briefError(texto) {
  const largo = (texto ?? '').trim().length
  if (largo < MIN_BRIEF) return `Cuéntame un poco más (mínimo ${MIN_BRIEF} caracteres).`
  if (largo > MAX_BRIEF) return `El brief no puede superar ${MAX_BRIEF} caracteres.`
  return ''
}
