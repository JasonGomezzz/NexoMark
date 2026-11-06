import { Check, ChartColumn, CheckCheck, Mic, Send, Wand2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * La orden de trabajo de UNA campaña (dirección "Conforme"): cinco casillas
 * — Dictar, Generar, Aprobar, Publicar, Medir —. Las hechas van selladas con
 * ✓, la actual rellena en turquesa con el ícono del paso y las que faltan,
 * punteadas. Un rechazo sella Aprobar en rojo y devuelve el trabajo a Generar.
 *
 * Mapea el estado FSM (`Campaign.VALID_TRANSITIONS`) sin inventar pasos:
 * "Publicar" y "Medir" solo se marcan hechos cuando `publicada` lo dice.
 */
const PASOS = [
  { id: 'dictar', label: 'Dictar', icono: Mic },
  { id: 'generar', label: 'Generar', icono: Wand2 },
  { id: 'aprobar', label: 'Aprobar', icono: CheckCheck },
  { id: 'publicar', label: 'Publicar', icono: Send },
  { id: 'medir', label: 'Medir', icono: ChartColumn },
]

function recorrido(estado, publicada) {
  switch (estado) {
    case 'borrador':
    case 'pendiente_ia':
      return { actual: 1, detalle: estado === 'pendiente_ia' ? 'Generando' : 'Por generar' }
    case 'generado':
      return { actual: 1, detalle: 'Lista para enviar' }
    case 'pendiente_aprobacion':
      return { actual: 2, detalle: 'En revisión del cliente' }
    case 'rechazado':
      return { actual: 1, detalle: 'Ajustar y regenerar', rechazo: 'Cambios pedidos' }
    case 'fracaso':
      return { actual: 2, detalle: 'Rechazada dos veces', fin: true }
    case 'aprobado':
      return publicada ? { actual: 4, detalle: 'Publicada' } : { actual: 3, detalle: 'Aprobada' }
    default:
      return { actual: 0, detalle: '' }
  }
}

export default function CampaignStepper({ estado, publicada = false }) {
  const { actual, detalle, rechazo, fin } = recorrido(estado, publicada)
  const pasoActual = PASOS[Math.min(actual, PASOS.length - 1)]
  return (
    <div>
      <ol className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Orden de trabajo de esta campaña">
        {PASOS.map(({ id, label, icono: Icono }, i) => {
          const hecha = i < actual
          const esActual = i === actual
          const rechazada = (rechazo && id === 'aprobar') || (fin && esActual)
          return (
            <li key={id} className="flex min-w-0 flex-col gap-2" aria-current={esActual ? 'step' : undefined}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'casilla h-10 w-10 rounded-[9px]',
                    rechazada && 'border-0 bg-error text-on-error',
                    !rechazada && esActual && 'casilla-actual',
                    !rechazada && hecha && 'border-0 bg-primary-fixed text-primary',
                    !rechazada && !hecha && !esActual && 'casilla-pliego',
                  )}
                  aria-hidden="true"
                >
                  {rechazada ? (
                    <X className="h-4 w-4" strokeWidth={2.75} />
                  ) : hecha ? (
                    <Check className="h-4 w-4" strokeWidth={2.75} />
                  ) : (
                    <Icono className="h-[18px] w-[18px]" strokeWidth={esActual ? 2.25 : 1.75} />
                  )}
                </span>
                {i < PASOS.length - 1 && (
                  <span aria-hidden="true" className={cn('hidden h-px flex-1 sm:block', hecha ? 'bg-primary' : 'bg-outline-variant')} />
                )}
              </div>
              {/* En móvil las cinco etiquetas no caben (≈51 px por columna): quedan para el lector
                  de pantalla y el paso actual se lee completo en la línea de abajo. */}
              <span className={cn('sr-only truncate font-display text-[15px] leading-tight sm:not-sr-only',  esActual || rechazada ? 'font-extrabold text-on-surface' : 'font-semibold text-on-surface-variant')}>
                {label}
              </span>
              {(esActual || (rechazada && rechazo)) && (
                <span className={cn('hidden text-[13px] sm:block', rechazada ? 'font-semibold text-error' : 'text-on-surface-variant')}>
                  {rechazada && rechazo ? rechazo : detalle}
                </span>
              )}
              <span className="sr-only">{hecha ? 'hecha' : esActual ? `actual: ${detalle}` : rechazada ? 'rechazada' : 'pendiente'}</span>
            </li>
          )
        })}
      </ol>
      <p aria-hidden="true" className="mt-2 font-display text-[15px] leading-tight text-on-surface sm:hidden">
        <span className={cn('font-extrabold', (rechazo || fin) && 'text-error')}>{rechazo ? 'Aprobar' : pasoActual.label}</span>
        <span className="text-on-surface-variant"> · {rechazo || detalle}</span>
      </p>
    </div>
  )
}
