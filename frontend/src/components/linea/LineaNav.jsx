import { Link } from 'react-router-dom'
import { ChartColumn, CheckCheck, Mic, Send, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONOS = { dictar: Mic, generar: Wand2, aprobar: CheckCheck, publicar: Send, medir: ChartColumn }

/**
 * La línea de navegación: estaciones unidas por una vía sobre la banda marina.
 * La estación actual es el círculo turquesa con el ícono del paso; las demás
 * muestran cuántas campañas esperan en ellas. `mini` es la versión del móvil.
 */
export default function LineaNav({ estaciones, actual, conteos = {}, mini = false, onNavigate, className = '' }) {
  return (
    <ol className={cn('linea', mini && 'linea-mini', className)} style={{ '--n': estaciones.length }}>
      {estaciones.map(({ id, nombre, to }) => {
        const esActual = id === actual
        const Icono = ICONOS[id]
        const cuenta = conteos[id]
        const descripcion = cuenta != null && !esActual ? `${nombre}: ${cuenta} ${cuenta === 1 ? 'campaña' : 'campañas'}` : nombre
        return (
          <li key={id} className="min-w-0">
            <Link
              to={to}
              onClick={onNavigate}
              aria-current={esActual ? 'page' : undefined}
              aria-label={descripcion}
              className="estacion"
            >
              <span className="estacion-punto" aria-hidden="true">
                {esActual && Icono && <Icono className={mini ? 'h-3.5 w-3.5' : 'h-5 w-5'} strokeWidth={2.25} />}
              </span>
              <span className="estacion-nombre">
                {nombre}
                {!mini && cuenta != null && !esActual && <span className="estacion-cuenta">{cuenta}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
