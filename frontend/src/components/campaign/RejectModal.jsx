import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Modal "Rechazar campaña" con feedback OBLIGATORIO (HU15).
 * Portado de Stitch: rechazar_campa_a_feedback_modal.
 * Spring valida el feedback entre 10 y 500 caracteres — misma regla aquí
 * (UX, no barrera de seguridad: el backend es quien decide).
 * El feedback dispara email al marketero vía n8n.
 */
const MIN_CHARS = 10
const MAX_CHARS = 500

const MOTIVOS = [
  'El copy no convence',
  'La imagen no encaja',
  'Tono equivocado',
  'No cumple el brief',
]

export default function RejectModal({
  open,
  onConfirm,
  onCancel,
  busy,
  titulo = '¿Por qué rechazas esta campaña?',
  descripcion = 'Tu feedback ayuda al marketero a regenerar el contenido.',
  nota = 'El marketero recibirá un email con tu feedback.',
  motivos = MOTIVOS,
}) {
  const [feedback, setFeedback] = useState('')
  const textareaRef = useRef(null)

  const valid = feedback.trim().length >= MIN_CHARS && feedback.length <= MAX_CHARS

  // Foco al abrir + cierre con Esc (accesibilidad)
  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  function addMotivo(motivo) {
    setFeedback((f) => {
      const base = f.trim()
      const next = base ? `${base} ${motivo}.` : `${motivo}.`
      return next.slice(0, MAX_CHARS)
    })
    textareaRef.current?.focus()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-liquid w-full max-w-lg rounded-3xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h3 id="reject-title" className="text-xl font-semibold text-on-surface">
            {titulo}
          </h3>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 text-sm text-on-surface-variant">{descripcion}</p>

        {/* Motivos rápidos */}
        <div className="mb-4 flex flex-wrap gap-2">
          {motivos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => addMotivo(m)}
              disabled={busy}
              className="rounded-full border border-outline-variant bg-white/70 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              {m}
            </button>
          ))}
        </div>

        {/* Feedback obligatorio */}
        <div className="mb-2">
          <textarea
            ref={textareaRef}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, MAX_CHARS))}
            disabled={busy}
            rows={4}
            placeholder="Explica qué debería cambiar…"
            className="w-full resize-y rounded-xl border border-outline-variant bg-white px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
          />
          <div className="mt-1 flex items-center justify-between px-1 text-xs">
            <span
              className={
                feedback.length > 0 && feedback.trim().length < MIN_CHARS
                  ? 'text-error'
                  : 'text-on-surface-variant'
              }
            >
              {feedback.trim().length < MIN_CHARS
                ? `Mínimo ${MIN_CHARS} caracteres`
                : nota}
            </span>
            <span className="tabular-nums text-on-surface-variant">
              {feedback.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-error hover:bg-error/90"
            disabled={!valid || busy}
            onClick={() => onConfirm(feedback.trim())}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Enviando…' : 'Confirmar rechazo'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
