import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../services/api'
import useSpeechRecognition from './useSpeechRecognition'
import { appendDictation, briefError } from '../services/voiceIntent'

const segundosDesde = (inicio) => (inicio === null ? 0 : Math.round((Date.now() - inicio) / 1000))

/**
 * Estado del brief dictado o escrito (paso Dictar de la línea).
 *
 * Cada frase final del reconocedor se guarda como una "parada" con su tiempo
 * desde el primer toque. `interpretar` envía el texto a /api/intents/interpret/
 * (no genera ni cobra) con la medición voz contra formulario: origen y
 * captura_ms desde el primer toque del micrófono o la primera tecla.
 *
 * @param {(intent: object) => void} onInterpreted intent devuelto por el backend
 */
export default function useBriefDictado({ onInterpreted }) {
  const [texto, setTextoEstado] = useState('')
  const [dictado, setDictado] = useState(false)
  const [segmentos, setSegmentos] = useState([])
  const [escribiendo, setEscribiendo] = useState(false)
  const [interpretando, setInterpretando] = useState(false)
  const [error, setError] = useState('')
  const [segundos, setSegundos] = useState(0)
  const inicioCaptura = useRef(null)

  const marcarInicio = useCallback(() => {
    if (inicioCaptura.current === null) inicioCaptura.current = Date.now()
  }, [])

  const agregarDictado = useCallback((frase) => {
    setDictado(true)
    setTextoEstado((previo) => appendDictation(previo, frase))
    setSegmentos((previos) => [...previos, { t: segundosDesde(inicioCaptura.current), texto: frase }])
  }, [])
  const voz = useSpeechRecognition(agregarDictado)

  // Reloj de la escucha (solo mientras el micrófono está abierto).
  useEffect(() => {
    if (!voz.listening) return undefined
    const id = setInterval(() => setSegundos(segundosDesde(inicioCaptura.current)), 1000)
    return () => clearInterval(id)
  }, [voz.listening])

  const escribir = useCallback(
    (valor) => {
      marcarInicio()
      setTextoEstado(valor)
    },
    [marcarInicio],
  )

  const empezarDictado = useCallback(() => {
    marcarInicio()
    setSegundos(segundosDesde(inicioCaptura.current))
    voz.start()
  }, [marcarInicio, voz])

  const alternarEscritura = useCallback(() => {
    voz.stop()
    setEscribiendo((v) => !v)
  }, [voz])

  const interpretar = useCallback(async () => {
    const invalido = briefError(texto)
    if (invalido) {
      setError(invalido)
      return
    }
    voz.stop()
    setError('')
    setInterpretando(true)
    try {
      const { data } = await api.post('/api/intents/interpret/', {
        texto: texto.trim(),
        origen: dictado ? 'voz' : 'formulario',
        captura_ms: inicioCaptura.current === null ? null : Math.min(Date.now() - inicioCaptura.current, 3_600_000),
      })
      inicioCaptura.current = null
      onInterpreted(data.data.intent)
    } catch (err) {
      const status = err.response?.status
      if (status === 429) setError('Demasiadas interpretaciones seguidas. Espera un momento.')
      else setError(err.response?.data?.message || 'No se pudo interpretar. Completa el formulario a mano.')
    } finally {
      setInterpretando(false)
    }
  }, [dictado, onInterpreted, texto, voz])

  const reiniciar = useCallback(() => {
    voz.stop()
    inicioCaptura.current = null
    setTextoEstado('')
    setDictado(false)
    setSegmentos([])
    setEscribiendo(false)
    setError('')
    setSegundos(0)
  }, [voz])

  return {
    texto,
    segmentos,
    escribiendo,
    interpretando,
    error,
    segundos,
    voz,
    escribir,
    empezarDictado,
    alternarEscritura,
    interpretar,
    reiniciar,
  }
}
