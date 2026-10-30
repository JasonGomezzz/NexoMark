import { Check, ChartColumn, CheckCheck, Mic, Send, Wand2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * El viaje de UNA campaña por la línea: Dictar → Generar → Aprobar → Publicar
 * → Medir. Las estaciones recorridas van rellenas, la actual lleva el anillo y
 * el ícono del paso, las que faltan son anillos huecos. Un rechazo marca la
 * estación Aprobar en rojo y devuelve el tren a Generar.
 *
 * Mapea el estado FSM (`Campaign.VALID_TRANSITIONS`) sin inventar pasos:
 * "Publicar" y "Medir" solo se marcan como hechos cuando `publicada` lo dice.
 */
const ESTACIONES = [
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
      return { actual: 1, detalle: 'Ajustar y regenerar', rechazo: 'Rechazada' }
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
  return (
    <ol className="relative grid grid-cols-5" aria-label="Recorrido de esta campaña">
      {/* La vía: tramo recorrido en turquesa, el que falta en gris */}
      <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[17px] h-1.5 rounded-full bg-outline-variant" />
      <span
        aria-hidden="true"
        className="absolute left-[10%] top-[17px] h-1.5 rounded-full bg-turquoise"
        style={{ width: `${(Math.min(actual, 4) / 4) * 80}%` }}
      />
      {ESTACIONES.map(({ id, label, icono: Icono }, i) => {
        const hecha = i < actual
        const esActual = i === actual
        const rechazada = (rechazo && id === 'aprobar') || (fin && esActual)
        return (
          <li key={id} className="relative flex flex-col items-center gap-2 text-center" aria-current={esActual ? 'step' : undefined}>
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 items-center justify-center rounded-full',
                rechazada && 'bg-error text-on-error shadow-[0_0_0_4px_var(--color-background),0_0_0_6px_color-mix(in_srgb,var(--color-error)_40%,transparent)]',
                !rechazada && esActual && 'bg-turquoise text-navy-deep shadow-[0_0_0_4px_var(--color-background),0_0_0_6px_var(--color-turquoise-soft)]',
                !rechazada && hecha && 'bg-turquoise text-navy-deep',
                !rechazada && !hecha && !esActual && 'border-4 border-outline-variant bg-background',
              )}
            >
              {rechazada ? (
                <X className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
              ) : esActual ? (
                <Icono className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
              ) : hecha ? (
                <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
              ) : null}
            </span>
            <span className={cn('font-display text-[15px] leading-tight', esActual || rechazada ? 'font-extrabold text-on-surface' : 'font-semibold text-on-surface-variant')}>
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
  )
}
