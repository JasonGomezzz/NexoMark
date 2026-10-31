import { useEffect, useState } from 'react'
import { Check, Wand2 } from 'lucide-react'

/**
 * Generando (dirección "Línea"): el tren sale de Dictar hacia Aprobar y avanza
 * sobre la vía mientras n8n crea el copy y la imagen (suele tardar entre 8 y
 * 30 s). No finge pasos por tiempo: muestra lo que sí se sabe (está generando
 * y cuánto lleva). El crédito ya se descontó y se devuelve si la IA falla.
 * `onCancel` solo deja esta pantalla: la generación sigue en el servidor y la
 * campaña aparece en el paso Generar.
 */
export default function GeneratingState({ onCancel }) {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <section role="status" aria-live="polite" className="mx-auto max-w-3xl py-6 sm:py-12">
      <p className="text-sm font-semibold text-on-surface-variant">Paso 2 de 5 · Generar</p>
      <h1 className="mt-2 text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
        Generando la campaña
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-on-surface-variant">
        La IA está escribiendo el copy y creando la imagen. Suele tardar entre 8 y 30 segundos. Cuando termine, verás la
        pieza lista para enviar al cliente.
      </p>

      {/* La vía: Dictar (hecha) → Generar (el tren avanza) → Aprobar */}
      <div className="relative mt-12" aria-hidden="true">
        <span className="absolute left-5 right-5 top-5 h-1.5 -translate-y-1/2 rounded-full bg-outline-variant" />
        <span className="absolute left-5 top-5 h-1.5 w-1/2 -translate-y-1/2 rounded-full bg-turquoise" />
        <span className="generando-tramo absolute left-1/2 right-5 top-5 h-1.5 -translate-y-1/2 overflow-hidden rounded-full">
          <span className="generando-tren absolute inset-y-0 left-0 w-16 rounded-full bg-turquoise" />
        </span>
        <ol className="relative flex justify-between">
          <li className="flex flex-col items-start gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-turquoise text-navy-deep">
              <Check className="h-4 w-4" strokeWidth={2.75} />
            </span>
            <span className="font-display text-[15px] font-semibold text-on-surface-variant">Dictar</span>
          </li>
          <li className="flex flex-col items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-turquoise text-navy-deep shadow-[0_0_0_4px_var(--color-background),0_0_0_6px_var(--color-turquoise-soft)]">
              <Wand2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <span className="font-display text-[15px] font-extrabold text-on-surface">Generar</span>
          </li>
          <li className="flex flex-col items-end gap-2">
            <span className="h-10 w-10 rounded-full border-4 border-outline-variant bg-background" />
            <span className="font-display text-[15px] font-semibold text-on-surface-variant">Aprobar</span>
          </li>
        </ol>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
        <p className="text-sm text-on-surface-variant">
          Lleva <span className="font-semibold tabular-nums text-on-surface">{segundos} s</span>. Ya se usó 1 crédito; si la IA falla, se devuelve.
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            Dictar otra campaña
          </button>
        )}
      </div>
    </section>
  )
}
