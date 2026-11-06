import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendDictation,
  avisoProcesamiento,
  briefError,
  buildTranscript,
  camposParaFormulario,
  dictationSupport,
  getSpeechRecognition,
  idiomasLocales,
  planDictado,
  PROCESAMIENTO,
  reaccionErrorDictado,
  soportaDictadoLocal,
  speechErrorMessage,
  MAX_BRIEF,
  unsupportedMessage,
} from '../src/services/voiceIntent.js'

const resultado = (transcript, isFinal) => Object.assign([{ transcript }], { isFinal })

test('buildTranscript separates confirmed speech from speech still being recognised', () => {
  const { finalText, interimText } = buildTranscript([
    resultado('quiero una campaña ', true),
    resultado('para una  cafetería', true),
    resultado(' en insta', false),
  ])
  assert.equal(finalText, 'quiero una campaña para una cafetería')
  assert.equal(interimText, 'en insta')
})

test('appendDictation joins phrases with single spaces and respects the brief limit', () => {
  assert.equal(appendDictation('', ' hola '), 'hola')
  assert.equal(appendDictation('quiero una campaña', 'para   Instagram'), 'quiero una campaña para Instagram')
  assert.equal(appendDictation('a'.repeat(MAX_BRIEF), 'extra').length, MAX_BRIEF)
})

test('camposParaFormulario only fills list fields with options the form really has', () => {
  const { valores, completados, pendientes } = camposParaFormulario(
    {
      titulo: ' 2x1 en capuchinos ',
      cliente_nombre: null,
      cliente_email: '',
      industria: 'gastronomia',
      tono: 'juvenil',
      plataforma: 'instagram',
      prompt: 'Campaña 2x1 para universitarios',
      estado: 'aprobado',
    },
    { industria: ['gastronomia'], tono: ['casual'], plataforma: ['instagram'] },
  )
  assert.deepEqual(valores, {
    titulo: '2x1 en capuchinos',
    industria: 'gastronomia',
    plataforma: 'instagram',
    prompt: 'Campaña 2x1 para universitarios',
  })
  assert.deepEqual(completados, ['titulo', 'industria', 'plataforma', 'prompt'])
  assert.deepEqual(pendientes, ['cliente_nombre', 'cliente_email', 'tono'])
  assert.equal('estado' in valores, false)
})

test('camposParaFormulario tolerates a missing or malformed intent', () => {
  assert.equal(camposParaFormulario(null).pendientes.length, 7)
  assert.deepEqual(camposParaFormulario({ titulo: 123 }).valores, {})
})

test('briefError enforces the same length limits as the backend', () => {
  assert.notEqual(briefError('corto'), '')
  assert.notEqual(briefError('x'.repeat(MAX_BRIEF + 1)), '')
  assert.equal(briefError('Campaña para una cafetería'), '')
})

test('speech errors become actionable messages and a user abort stays silent', () => {
  assert.match(speechErrorMessage('not-allowed'), /permiso/)
  assert.match(speechErrorMessage('audio-capture'), /micrófono/)
  assert.equal(speechErrorMessage('aborted'), '')
  assert.notEqual(speechErrorMessage('algo-nuevo'), '')
})

test('getSpeechRecognition finds the prefixed constructor and reports absence', () => {
  class Prefixed {}
  assert.equal(getSpeechRecognition({ webkitSpeechRecognition: Prefixed }), Prefixed)
  assert.equal(getSpeechRecognition({}), null)
})

test('dictationSupport rules out Brave even though it exposes the constructor', () => {
  class Recognizer {}
  assert.deepEqual(dictationSupport({ webkitSpeechRecognition: Recognizer, navigator: {} }), {
    supported: true,
    reason: '',
  })
  assert.equal(dictationSupport({ webkitSpeechRecognition: Recognizer, navigator: { brave: {} } }).reason, 'brave')
  assert.equal(dictationSupport({ navigator: {} }).reason, 'unsupported')
  assert.match(unsupportedMessage('brave'), /Brave/)
  assert.match(unsupportedMessage('unsupported'), /Chrome/)
})

/** Doble de SpeechRecognition con available()/install() según un mapa idioma → estado. */
function reconocedorConIdiomas(estados, { conInstall = true } = {}) {
  const consultas = []
  class Doble {}
  Doble.available = async (opciones) => {
    consultas.push(opciones)
    return estados[opciones.langs[0]] ?? 'unavailable'
  }
  if (conInstall) Doble.install = async () => true
  return { Doble, consultas }
}

test('local dictation is only offered by browsers that expose SpeechRecognition.available', () => {
  class ConDisponible {
    static available() {}
  }
  assert.equal(soportaDictadoLocal({ SpeechRecognition: ConDisponible }), true)
  assert.equal(soportaDictadoLocal({ webkitSpeechRecognition: class {} }), false)
  assert.equal(soportaDictadoLocal({}), false)
})

test('idiomasLocales asks for es-PE first and then close Spanish variants without repeating', () => {
  assert.deepEqual(idiomasLocales('es-PE'), ['es-PE', 'es-419', 'es-US', 'es-MX', 'es-ES'])
  assert.deepEqual(idiomasLocales('es-US'), ['es-US', 'es-419', 'es-MX', 'es-ES'])
})

test('planDictado asks for on-device dictation and picks the closest installed Spanish', async () => {
  const { Doble, consultas } = reconocedorConIdiomas({ 'es-US': 'available', 'es-ES': 'available' })
  const plan = await planDictado(Doble, idiomasLocales('es-PE'))
  assert.deepEqual(plan, { modo: PROCESAMIENTO.LOCAL, lang: 'es-US', descargable: null, descargando: false })
  assert.ok(consultas.every((opciones) => opciones.processLocally === true && opciones.quality === 'dictation'))
})

test('planDictado falls back to the server and offers a download when a pack can be installed', async () => {
  const { Doble } = reconocedorConIdiomas({ 'es-ES': 'downloadable' })
  assert.deepEqual(await planDictado(Doble, idiomasLocales()), {
    modo: PROCESAMIENTO.SERVIDOR,
    lang: 'es-PE',
    descargable: 'es-ES',
    descargando: false,
  })

  const sinInstall = reconocedorConIdiomas({ 'es-ES': 'downloadable' }, { conInstall: false })
  assert.equal((await planDictado(sinInstall.Doble, idiomasLocales())).descargable, null)

  const bajando = reconocedorConIdiomas({ 'es-PE': 'downloading', 'es-ES': 'downloadable' })
  const plan = await planDictado(bajando.Doble, idiomasLocales())
  assert.equal(plan.descargando, true)
  assert.equal(plan.descargable, null)
})

test('planDictado treats a blocked or missing availability check as server dictation', async () => {
  class Bloqueado {
    static available() {
      throw new DOMException('bloqueado por Permissions-Policy', 'NotAllowedError')
    }
  }
  assert.equal((await planDictado(Bloqueado, idiomasLocales())).modo, PROCESAMIENTO.SERVIDOR)
  assert.equal((await planDictado(class {}, idiomasLocales())).modo, PROCESAMIENTO.SERVIDOR)
  assert.equal((await planDictado(null, idiomasLocales())).modo, PROCESAMIENTO.SERVIDOR)
})

test('the processing notice never promises more privacy than the browser gives', () => {
  assert.match(avisoProcesamiento(PROCESAMIENTO.LOCAL), /en este equipo/)
  assert.doesNotMatch(avisoProcesamiento(PROCESAMIENTO.LOCAL), /servidores/)
  assert.match(avisoProcesamiento(PROCESAMIENTO.SERVIDOR), /puede enviar el audio a sus servidores/)
  for (const modo of [PROCESAMIENTO.LOCAL, PROCESAMIENTO.SERVIDOR]) {
    assert.match(avisoProcesamiento(modo), /NexoMark solo recibe el texto/)
  }
})

test('a missing local language pack switches to server mode without restarting on its own', () => {
  assert.equal(reaccionErrorDictado('language-not-supported', PROCESAMIENTO.LOCAL), 'pasar-a-servidor')
  assert.equal(reaccionErrorDictado('language-not-supported', PROCESAMIENTO.SERVIDOR), 'mostrar')
  assert.equal(reaccionErrorDictado('no-speech', PROCESAMIENTO.LOCAL), 'mostrar')
  assert.match(speechErrorMessage('language-not-supported'), /español/)
})

test('Brave stays blocked even if it exposes the on-device API', () => {
  class ConDisponible {
    static available() {}
  }
  const scope = { navigator: { brave: {} }, SpeechRecognition: ConDisponible }
  assert.deepEqual(dictationSupport(scope), { supported: false, reason: 'brave' })
})
