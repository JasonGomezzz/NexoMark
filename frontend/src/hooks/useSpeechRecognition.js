import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildTranscript,
  dictationSupport,
  getSpeechRecognition,
  idiomasLocales,
  MENSAJE_LOCAL_NO_LISTO,
  planDictado,
  PROCESAMIENTO,
  reaccionErrorDictado,
  soportaDictadoLocal,
  speechErrorMessage,
} from '../services/voiceIntent'

const MENSAJE_DESCARGA_FALLIDA =
  'No se pudo descargar el español para dictar en este equipo. Puedes dictar igual o escribir el brief.'

function planInicial(supported, lang) {
  const modo = supported && soportaDictadoLocal() ? PROCESAMIENTO.COMPROBANDO : PROCESAMIENTO.SERVIDOR
  return { modo, lang, descargable: null, descargando: false }
}

/**
 * Dictado con la Web Speech API del navegador (Chrome, Edge, Safari).
 * A nuestro backend solo llega texto, nunca audio. Si el navegador permite
 * transcribir en el equipo (`processLocally`) y tiene el español instalado,
 * se pide así; si no, `procesamiento` es 'servidor' y la pantalla avisa de
 * que el navegador puede enviar el audio a sus servidores.
 * Si el navegador no permite dictar, `supported` es false y la pantalla
 * ofrece escribir el brief. En Brave también es false (ver dictationSupport).
 *
 * @param {(texto: string) => void} onFinal  recibe cada frase confirmada
 */
export default function useSpeechRecognition(onFinal, lang = 'es-PE') {
  const { supported, reason: unsupportedReason } = dictationSupport()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(() => planInicial(supported, lang))
  const [instalando, setInstalando] = useState(false)
  const recognitionRef = useRef(null)
  const onFinalRef = useRef(onFinal)
  const montadoRef = useRef(true)

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Preguntar al navegador si puede transcribir en el equipo.
  useEffect(() => {
    if (!supported || !soportaDictadoLocal()) return undefined
    let vigente = true
    planDictado(getSpeechRecognition(), idiomasLocales(lang)).then((nuevo) => {
      if (vigente) setPlan(nuevo)
    })
    return () => {
      vigente = false
    }
  }, [lang, supported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!supported || !SpeechRecognition || recognitionRef.current) return
    if (plan.modo === PROCESAMIENTO.COMPROBANDO) return

    const recognition = new SpeechRecognition()
    const local = plan.modo === PROCESAMIENTO.LOCAL
    recognition.lang = local ? plan.lang : lang
    if (local) recognition.processLocally = true
    recognition.continuous = true
    recognition.interimResults = true

    // Solo los resultados nuevos de este evento: los anteriores ya se entregaron.
    recognition.onresult = (event) => {
      const nuevos = Array.from(event.results).slice(event.resultIndex)
      const { finalText, interimText } = buildTranscript(nuevos)
      if (finalText) onFinalRef.current?.(finalText)
      setInterim(interimText)
    }
    recognition.onerror = (event) => {
      if (reaccionErrorDictado(event.error, plan.modo) === 'pasar-a-servidor') {
        setPlan((previo) => ({ ...previo, modo: PROCESAMIENTO.SERVIDOR, lang }))
        setError(MENSAJE_LOCAL_NO_LISTO)
        return
      }
      setError(speechErrorMessage(event.error))
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    setError('')
    setListening(true)
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setListening(false)
      setError(speechErrorMessage('unknown'))
    }
  }, [lang, plan, supported])

  /** Descarga el español para dictar en el equipo (lo pide el usuario con un clic). */
  const instalarIdioma = useCallback(async () => {
    const SpeechRecognition = getSpeechRecognition()
    if (!plan.descargable || typeof SpeechRecognition?.install !== 'function') return
    setInstalando(true)
    setError('')
    try {
      const instalado = await SpeechRecognition.install({
        langs: [plan.descargable],
        processLocally: true,
        quality: 'dictation',
      })
      if (!montadoRef.current) return
      if (!instalado) setError(MENSAJE_DESCARGA_FALLIDA)
      const nuevo = await planDictado(SpeechRecognition, idiomasLocales(lang))
      if (montadoRef.current) setPlan(nuevo)
    } catch {
      if (montadoRef.current) setError(MENSAJE_DESCARGA_FALLIDA)
    } finally {
      if (montadoRef.current) setInstalando(false)
    }
  }, [lang, plan.descargable])

  // Soltar el micrófono al salir de la pantalla.
  useEffect(() => () => recognitionRef.current?.abort(), [])

  return {
    supported,
    unsupportedReason,
    listening,
    interim,
    error,
    start,
    stop,
    procesamiento: plan.modo,
    idiomaDescargable: plan.descargable,
    descargando: plan.descargando || instalando,
    instalarIdioma,
  }
}
