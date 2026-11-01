import { Link } from 'react-router-dom'
import { ChartColumn, CheckCheck, Eye, MessageSquareText } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'

/**
 * Ayuda del cliente (dirección "Conforme"): qué pasa con cada decisión, en el
 * orden en que la vive. Pasos numerados en casillas, sin tarjetas.
 */
const PASOS = [
  {
    icono: Eye,
    titulo: 'Revisa la pieza',
    texto: 'Abre una campaña por aprobar. La ves tal como se publicará: imagen, texto y la cuenta donde saldrá.',
  },
  {
    icono: CheckCheck,
    titulo: 'Aprueba con tu sello',
    texto:
      'Al aprobar, tu sello queda en esa versión exacta. Si tu agencia eligió cuentas, se publica sola en ellas; si no, la publica tu agencia.',
  },
  {
    icono: MessageSquareText,
    titulo: 'O pide cambios',
    texto: 'Si algo no encaja, di qué cambiar. Tu agencia recibe el comentario y prepara una nueva versión para que la revises.',
  },
  {
    icono: ChartColumn,
    titulo: 'Mira cómo rinde',
    texto: 'En Medir ves me gusta, comentarios y alcance de lo publicado. Lo que Meta todavía no informa dice «sin dato».',
  },
]

const ESTADOS = [
  ['pendiente_aprobacion', 'Espera tu revisión.'],
  ['aprobado', 'Le diste conforme; es la versión que se publica.'],
  ['rechazado', 'Pediste cambios; tu agencia prepara otra versión.'],
]

export default function ClientHelpPage() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Cómo aprobar</h1>
        <p className="mt-2 text-base text-on-surface-variant">Lo que pasa con cada decisión que tomas en NexoMark.</p>
      </header>

      <ol className="grid border-y border-outline-variant md:grid-cols-2">
        {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
          <li
            key={titulo}
            className={`grid grid-cols-[40px_1fr] gap-4 py-6 md:pr-8 ${i > 0 ? 'border-t border-hairline' : ''} ${i === 1 ? 'md:border-t-0' : ''} ${i % 2 === 1 ? 'md:border-l md:pl-8' : ''}`}
          >
            <span className="casilla casilla-pliego h-10 w-10 font-display text-base font-extrabold text-on-surface" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-on-surface">
                <Icono className="h-4 w-4 text-primary" aria-hidden="true" />
                {titulo}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="regla pt-6" aria-labelledby="estados-titulo">
        <h2 id="estados-titulo" className="text-2xl font-extrabold text-on-surface">
          Qué dice cada estado
        </h2>
        <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
          {ESTADOS.map(([estado, texto]) => (
            <div key={estado} className="grid gap-2 py-3 sm:grid-cols-[200px_1fr] sm:items-center">
              <dt>
                <StatusBadge estado={estado} />
              </dt>
              <dd className="text-[15px] text-on-surface-variant">{texto}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[15px] text-on-surface-variant">
          Tus campañas por aprobar están en{' '}
          <Link to="/client-campaigns" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            Por aprobar
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
