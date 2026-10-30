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
  titulo = '¿Qué debería cambiar?',
  descripcion = 'Tu comentario llega al marketero para que prepare una nueva versión.',
  nota = 'El marketero recibe tu comentario por correo.',
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center sm:p-4"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
    >
      <motion.div
        initial={{ opacity: 0, transform: 'translateY(16px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] border border-outline-variant bg-surface-container-lowest p-6 shadow-xl sm:rounded-[22px] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h3 id="reject-title" className="font-display text-2xl font-extrabold text-on-surface">
            {titulo}
          </h3>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="inline-flex min-h-11 items-center rounded-full border border-outline-variant px-4 text-[13px] font-medium text-on-surface transition-colors hover:border-primary hover:bg-primary-fixed hover:text-on-primary-fixed"
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
            className="w-full resize-y rounded-[14px] border border-outline bg-surface-container-lowest px-4 py-3 text-base text-on-surface outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-1 flex items-center justify-between px-1 text-[13px]">
            <span
              className={
                feedback.length > 0 && feedback.trim().length < MIN_CHARS
                  ? 'text-error'
                  : 'text-on-surface-variant'
              }
            >
              {feedback.trim().length < MIN_CHARS
                ? `Escribe al menos ${MIN_CHARS} caracteres`
                : nota}
            </span>
            <span className="tabular-nums text-on-surface-variant">
              {feedback.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-error text-on-error hover:bg-error/90"
            disabled={!valid || busy}
            onClick={() => onConfirm(feedback.trim())}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Enviando…' : 'Enviar comentario'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
