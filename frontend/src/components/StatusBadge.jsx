import { cn } from '@/lib/utils'
import { STATES } from '@/lib/campaignStates'

/**
 * Badge de estado FSM. Los 6 estados (labels + estilos) viven en
 * lib/campaignStates.js — fuente única. Úsalo en TODA pantalla que muestre
 * estado para garantizar consistencia (dashboard, listas, detalle, review).
 */

export default function StatusBadge({ estado, className }) {
  const s = STATES[estado] ?? {
    label: estado ?? '—',
    className: 'bg-surface-container-high text-on-surface-variant',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap',
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
