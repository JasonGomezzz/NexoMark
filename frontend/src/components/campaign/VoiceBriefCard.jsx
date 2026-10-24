import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Wand2, Loader2, TriangleAlert, CircleCheck, Cloud, Laptop } from 'lucide-react'
import api from '../../services/api'
import { Button } from '@/components/ui/button'
import useSpeechRecognition from '../../hooks/useSpeechRecognition'
import {
  appendDictation,
  avisoProcesamiento,
  briefError,
  MAX_BRIEF,
  PROCESAMIENTO,
  unsupportedMessage,
} from '../../services/voiceIntent'

/**
 * Paso previo al formulario: el marketero dicta (o escribe) el brief y la IA
 * propone los campos. Interpretar no genera la campaña ni consume créditos;
 * eso ocurre al confirmar el formulario.
 *
 * @param {(intent: object) => void} onInterpreted  intent devuelto por el backend
 * @param {object|null} resumen  { completados, pendientes, advertencias } tras interpretar
 */
export default function VoiceBriefCard({ onInterpreted, resumen, disabled }) {
  const [texto, setTexto] = useState('')
  const [dictado, setDictado] = useState(false)
  const [interpretando, setInterpretando] = useState(false)
  const [error, setError] = useState('')
  // Medición voz vs. formulario: desde el primer toque del micrófono o la primera tecla.
  const inicioCaptura = useRef(null)
  const marcarInicio = () => {
    if (inicioCaptura.current === null) inicioCaptura.current = Date.now()
  }

  const agregarDictado = useCallback((frase) => {
    setDictado(true)
    setTexto((previo) => appendDictation(previo, frase))
  }, [])
  const voz = useSpeechRecognition(agregarDictado)

  async function interpretar() {
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
  }

  const ocupado = disabled || interpretando

  return (
    <section className="mb-5 rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mic className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-on-surface">Cuéntame la campaña</h2>
          <p className="text-sm text-on-surface-variant">
            Dicta o escribe la idea y completo el formulario por ti. Aún no se usa ningún crédito.
          </p>
        </div>
      </div>

      <div className="relative">
        <textarea
          rows={4}
          value={texto}
          onChange={(e) => {
            marcarInicio()
            setTexto(e.target.value.slice(0, MAX_BRIEF))
          }}
          disabled={ocupado}
          aria-label="Brief de la campaña"
          placeholder="Ej: Quiero una campaña para una cafetería en Instagram, tono casual, con un 2x1 en capuchinos para universitarios."
          className="w-full resize-y rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary"
        />
        {voz.listening && (
          <p aria-live="polite" className="mt-1 min-h-5 text-sm italic text-on-surface-variant">
            {voz.interim || 'Escuchando…'}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {voz.supported ? (
          <Button
            type="button"
            variant={voz.listening ? 'secondary' : 'outline'}
            onClick={
              voz.listening
                ? voz.stop
                : () => {
                    marcarInicio()
                    voz.start()
                  }
            }
            disabled={ocupado || voz.procesamiento === PROCESAMIENTO.COMPROBANDO}
            aria-pressed={voz.listening}
          >
            {voz.listening ? (
              <>
                <Square className="h-4 w-4" />
                Detener
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Dictar
              </>
            )}
          </Button>
        ) : (
          <p className="text-xs text-on-surface-variant">{unsupportedMessage(voz.unsupportedReason)}</p>
        )}

        <Button type="button" onClick={interpretar} disabled={ocupado || !texto.trim()}>
          {interpretando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {interpretando ? 'Interpretando…' : 'Completar formulario'}
        </Button>

        <span className="ml-auto text-xs text-on-surface-variant">
          {texto.length}/{MAX_BRIEF}
        </span>
      </div>

      {voz.supported && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
          <p className="flex items-start gap-1.5">
            {voz.procesamiento === PROCESAMIENTO.LOCAL ? (
              <Laptop className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Cloud className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            {avisoProcesamiento(voz.procesamiento)}
          </p>
          {voz.descargando ? (
            <span>Descargando español para dictar en este equipo…</span>
          ) : (
            voz.idiomaDescargable && (
              <button
                type="button"
                onClick={voz.instalarIdioma}
                disabled={ocupado || voz.listening}
                className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              >
                Descargar español para dictar sin enviar audio
              </button>
            )
          )}
        </div>
      )}

      {(error || voz.error) && (
        <p role="alert" className="mt-3 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {error || voz.error}
        </p>
      )}

      {resumen && (
        <div className="mt-4 space-y-2 rounded-lg bg-surface-container-low p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-on-surface">
            <CircleCheck className="h-4 w-4 text-primary" />
            Completé {resumen.completados.length} de 7 campos. Revísalos antes de generar.
          </p>
          {resumen.pendientes.length > 0 && (
            <p className="text-on-surface-variant">
              Te falta completar: {resumen.pendientes.join(', ')}.
            </p>
          )}
          {resumen.advertencias.map((aviso) => (
            <p key={aviso} className="flex items-start gap-2 text-on-tertiary-container">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {aviso}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
