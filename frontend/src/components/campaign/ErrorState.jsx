import { AlertCircle, Info, RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Estado de error de generación IA (portado de Stitch: error_total_generacion_fallida).
 * El backend devolvió el crédito (atomic), guardó ia_error_message y la campaña
 * volvió a borrador. Reintentos hasta 3 (intentos_generacion). Sin `onRetry` (no se
 * sabe qué campaña falló) no se ofrece reintentar.
 */
export default function ErrorState({ message, attempt = 1, maxAttempts = 3, onRetry, onEditBrief }) {
  return (
    <section className="regla pt-6" aria-labelledby="error-generacion" role="alert">
      <p className="flex items-center gap-2 text-sm font-semibold text-error">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Intento {attempt} de {maxAttempts}
      </p>
      <h2 id="error-generacion" className="mt-2 text-[26px] font-extrabold leading-tight text-on-surface">
        No pudimos generar tu campaña
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-on-surface-variant">
        {message || 'El servicio de IA no respondió a tiempo.'}
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
        <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        Se te devolvió el crédito de este intento.
      </p>

      {/* Intentos como casillas: las usadas en rojo */}
      <div className="mt-5 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <span key={i} className={`h-3 w-8 rounded-[3px] ${i < attempt ? 'bg-error' : 'border border-dashed border-outline-variant'}`} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {onRetry && (
          <Button onClick={onRetry} disabled={attempt >= maxAttempts}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar generación
          </Button>
        )}
        <Button variant="outline" onClick={onEditBrief}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar la ficha
        </Button>
      </div>
    </section>
  )
}
