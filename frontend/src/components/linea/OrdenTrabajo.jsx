import { Link } from 'react-router-dom'
import { ChartColumn, CheckCheck, Mic, Send, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONOS_PASO = { dictar: Mic, generar: Wand2, aprobar: CheckCheck, publicar: Send, medir: ChartColumn }

/**
 * La orden de trabajo (dirección "Conforme"): el recorrido de la campaña como
 * casillas sobre la mesa. La casilla del paso actual va rellena en turquesa con
 * su ícono; las demás, punteadas, con cuántas campañas esperan en ese paso.
 */
export default function OrdenTrabajo({ estaciones, actual, conteos = {}, onNavigate }) {
  return (
    <ol className="grid gap-1">
      {estaciones.map(({ id, nombre, to }) => {
        const esActual = id === actual
        const Icono = ICONOS_PASO[id]
        const cuenta = conteos[id]
        return (
          <li key={id}>
            <Link
              to={to}
              onClick={onNavigate}
              aria-current={esActual ? 'page' : undefined}
              aria-label={cuenta != null && !esActual ? `${nombre}: ${cuenta} ${cuenta === 1 ? 'campaña' : 'campañas'}` : nombre}
              className={cn(
                'grid min-h-11 grid-cols-[30px_1fr_auto] items-center gap-3 rounded-[10px] py-1.5 pl-1.5 pr-3 text-[15px] font-medium transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-turquoise',
                esActual ? 'bg-cama-2 text-on-navy' : 'text-on-navy-muted hover:bg-cama-2 hover:text-on-navy',
              )}
            >
              <span className={cn('casilla', esActual && 'casilla-actual')} aria-hidden="true">
                {Icono && <Icono className="h-4 w-4" strokeWidth={esActual ? 2.25 : 1.75} />}
              </span>
              <span>{nombre}</span>
              {cuenta != null && <span className="text-[13px] tabular-nums text-on-navy-muted">{cuenta}</span>}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** Móvil: pastilla con el paso actual de la orden («Dictar · 1 de 5»). */
export function PasoActual({ estaciones, actual }) {
  const indice = estaciones.findIndex((e) => e.id === actual)
  if (indice === -1) return null
  const Icono = ICONOS_PASO[actual]
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-cama-2 py-1 pl-1 pr-3 text-sm font-semibold text-on-navy">
      <span className="casilla casilla-actual h-7 w-7" aria-hidden="true">
        {Icono && <Icono className="h-3.5 w-3.5" strokeWidth={2.25} />}
      </span>
      {estaciones[indice].nombre}
      <span className="font-normal text-on-navy-muted">
        {indice + 1} de {estaciones.length}
      </span>
    </span>
  )
}
