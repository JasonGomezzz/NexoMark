import { useEffect, useState } from 'react'
import CampaignStepper from '@/components/CampaignStepper'

const TARDA_NORMAL_S = 30

/**
 * Generando (dirección "Conforme"). En vez de un spinner, responde lo que un spinner
 * no dice:
 * - ¿Qué viene? La forma de la pieza: el marco de la imagen y las líneas del copy.
 * - ¿Cuánto falta? Lo que lleva y lo que suele tardar (8–30 s). No inventa pasos:
 *   n8n no informa etapas, así que no hay barra de avance ni "escribiendo el copy…".
 * El contador va fuera de la región viva para que el lector de pantalla no lo lea
 * cada segundo. `onCancel` solo deja esta pantalla: la generación sigue en el
 * servidor y la campaña aparece en el paso Generar.
 */
export default function GeneratingState({ titulo, onCancel }) {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const tarda = segundos > TARDA_NORMAL_S

  return (
    <section aria-labelledby="generando-titulo" className="mx-auto max-w-3xl py-6 sm:py-10">
      <p className="text-sm font-semibold text-on-surface-variant">Paso 2 de 5 · Generar</p>
      <h1 id="generando-titulo" className="mt-2 text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
        Generando la campaña
      </h1>
      <p role="status" className="mt-3 max-w-xl text-[15px] leading-relaxed text-on-surface-variant">
        {tarda
          ? 'Está tardando más de lo normal. La generación sigue en el servidor: puedes dictar otra y volver a esta desde el paso Generar.'
          : 'La IA está escribiendo el copy y creando la imagen. Cuando termine, verás la pieza lista para enviar al cliente.'}
      </p>

      <div className="mt-8">
        <CampaignStepper estado="pendiente_ia" />
      </div>

      {/* La prueba que viene: misma forma que la pieza del detalle, sin contenido todavía. */}
      <div aria-hidden="true" className="mt-8 grid gap-6 rounded-[14px] border border-hairline p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:p-6">
        <div className="relative">
          <div className="esqueleto aspect-square rounded-[12px]" />
          <span className="absolute inset-x-0 bottom-3 text-center text-[13px] text-on-surface-variant">La imagen</span>
        </div>
        <div className="min-w-0">
          {titulo ? (
            <p className="line-clamp-2 font-display text-xl font-bold text-on-surface">{titulo}</p>
          ) : (
            <div className="esqueleto h-6 w-3/5 rounded" />
          )}
          <p className="mt-3 text-[13px] text-on-surface-variant">El copy</p>
          <div className="mt-2 space-y-2.5">
            {['w-full', 'w-11/12', 'w-full', 'w-3/4'].map((ancho, i) => (
              <div key={i} className={`esqueleto h-3.5 rounded ${ancho}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
        <p className="text-sm text-on-surface-variant">
          Lleva <span className="font-semibold tabular-nums text-on-surface">{segundos} s</span>
          {tarda ? '.' : ' · suele tardar entre 8 y 30 s.'} Ya se usaron 4 créditos; si la IA falla, se devuelven.
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
