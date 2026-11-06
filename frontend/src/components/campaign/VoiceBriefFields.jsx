import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Mic, Square } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import useSpeechRecognition from '@/hooks/useSpeechRecognition'
import { appendDictation, avisoProcesamiento, briefError, MAX_BRIEF, PROCESAMIENTO, unsupportedMessage } from '@/services/voiceIntent'

export default function VoiceBriefFields({ disabled, onInterpreted, onBusy }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notices, setNotices] = useState([])
  const started = useRef(null)
  const dictated = useRef(false)
  const request = useRef(null)
  const voice = useSpeechRecognition((phrase) => {
    setText((current) => appendDictation(current, phrase))
  })

  useEffect(() => () => request.current?.abort(), [])

  function startDictation() {
    started.current ??= performance.now()
    dictated.current = true
    voice.start()
  }

  async function interpret() {
    const validation = briefError(text)
    setError(validation)
    if (validation) return
    setBusy(true)
    onBusy(true)
    setNotices([])
    const controller = new AbortController()
    request.current = controller
    try {
      const { data } = await api.post('/api/intents/interpret/', {
        texto: text.trim(),
        origen: dictated.current ? 'voz' : 'formulario',
        captura_ms: started.current === null ? null : Math.min(3600000, Math.round(performance.now() - started.current)),
      }, { signal: controller.signal })
      if (controller.signal.aborted) return
      const intent = data.data.intent
      onInterpreted(intent)
      setNotices([
        'Revisa los datos propuestos en el formulario y completa los campos pendientes antes de generar.',
        ...(intent.advertencias || []),
      ])
      started.current = null
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.response?.data?.message || 'No se pudo interpretar la idea. Intenta de nuevo o completa el formulario.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }

  return (
    <section aria-label="Crear campaña desde una idea" className="mb-5 space-y-3 bg-surface-container-low p-5 text-on-surface">
      <h2 className="text-lg font-semibold">Cuéntanos tu campaña</h2>
      <p className="text-sm text-on-surface-variant">
        Dicta o escribe el producto, cliente, objetivo, tono y redes. La IA propondrá los datos del formulario.
      </p>
      <label htmlFor="campaign-brief" className="block text-sm font-medium">Tu idea</label>
      <textarea
        id="campaign-brief"
        rows={4}
        maxLength={MAX_BRIEF}
        value={text}
        disabled={disabled || busy || voice.listening}
        onChange={(event) => {
          started.current ??= performance.now()
          setText(event.target.value)
        }}
        placeholder="Una campaña para una cafetería, promoción 2×1 para universitarios, tono casual, en Instagram y Facebook…"
        className="w-full border border-outline-variant bg-surface-container-lowest p-3 text-sm focus:ring-2 focus:ring-primary"
      />
      {voice.interim && <p aria-live="polite" className="text-sm text-on-surface-variant">{voice.interim}</p>}
      <div className="flex flex-wrap gap-3">
        {voice.supported && (
          <Button type="button" variant="outline" disabled={disabled || busy || voice.procesamiento === PROCESAMIENTO.COMPROBANDO}
            onClick={voice.listening ? voice.stop : startDictation}>
            {voice.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {voice.listening ? 'Terminar dictado' : 'Dictar idea'}
          </Button>
        )}
        <Button type="button" onClick={interpret} disabled={disabled || busy || voice.listening || !text.trim()}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ? 'Interpretando…' : 'Completar formulario con IA'}
        </Button>
      </div>
      <p className="text-xs text-on-surface-variant">
        {voice.supported ? avisoProcesamiento(voice.procesamiento) : unsupportedMessage(voice.unsupportedReason)}
      </p>
      <p className="text-xs text-on-surface-variant">Interpretar la idea no consume créditos del producto. Generar texto e imagen consume 4 créditos.</p>
      {(error || voice.error) && <p role="alert" className="text-sm text-error">{error || voice.error}</p>}
      {notices.length > 0 && <ul role="status" className="list-inside list-disc text-sm">{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}
    </section>
  )
}
