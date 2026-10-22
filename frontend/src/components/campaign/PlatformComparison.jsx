import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import PlatformIcon from './PlatformIcon'
import { comparisonPlatforms, platformComparisonData } from '@/services/publicationStatistics'

const charts = [
  { key: 'publications', title: 'Publicaciones', description: 'Envíos confirmados registrados durante el año.' },
  { key: 'likes', title: 'Me gusta', description: 'Último contador acumulado de las publicaciones de ese año.' },
  { key: 'shares', title: 'Compartidos / Reposts', description: 'Compartidos registrados; en X se cuentan los reposts.' },
]
const color = platform => `var(--color-chart-${platform})`
const format = value => value == null ? 'No disponible' : value.toLocaleString('es-PE')

export default function PlatformComparison({ platforms, year }) {
  return <div className="space-y-5">
    <div>
      <h3 className="text-lg font-semibold text-on-surface">Comparativa entre redes · {year}</h3>
      <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">La misma métrica y el mismo año para las cuatro plataformas. Solo se incluyen publicaciones registradas en NexoMark.</p>
      <ul aria-label="Colores por plataforma" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {comparisonPlatforms.map(({ key, label }) => <li key={key} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3" style={{ backgroundColor: color(key) }} />{label}
        </li>)}
      </ul>
    </div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-3">
      {charts.map(({ key, title, description }) => {
        const rows = platformComparisonData(platforms, key)
        const hasData = rows.some(row => row.value != null)
        const pending = key === 'publications'
          ? comparisonPlatforms.reduce((total, { key: platform }) => total + (platforms[platform]?.pending ?? 0), 0) : 0
        return <article key={key} className="min-w-0 bg-surface-container-low p-4 sm:p-5" aria-label={`${title}: comparativa de ${year}`}>
          <h4 className="text-base font-semibold text-on-surface">{title}</h4>
          <p className="mt-1 min-h-12 text-xs leading-relaxed text-on-surface-variant">{description}</p>
          {hasData ? <div className="mt-4 h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 16, right: 4, left: -22, bottom: 0 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis allowDecimals={false} domain={[0, 'auto']} axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip content={<ComparisonTooltip title={title} />} cursor={{ fill: 'var(--color-surface-container-high)' }} />
                <Bar dataKey="value" name={title} maxBarSize={48} isAnimationActive={false}>
                  {rows.map(row => <Cell key={row.platform} fill={color(row.platform)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div> : <p className="mt-4 flex h-56 items-center justify-center text-center text-sm text-on-surface-variant">No hay mediciones disponibles para comparar.</p>}
          <dl className="mt-4 space-y-3" aria-label={`Cifras de ${title.toLowerCase()} por plataforma`}>
            {rows.map(row => <div key={row.platform}>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-sm"><PlatformIcon platform={row.platform} />{row.name}</dt>
                <dd className={`${row.value == null ? 'text-xs text-on-surface-variant' : 'text-xl font-semibold text-on-surface'} tabular-nums`}>{format(row.value)}{row.partial && <span className="ml-1 text-xs font-normal">(parcial)</span>}</dd>
              </div>
              <dd className="mt-0.5 text-right text-xs text-on-surface-variant">{row.status === 'No disponible' ? 'Sin medición registrada' : row.status}</dd>
            </div>)}
          </dl>
          {pending > 0 && <p className="mt-4 text-xs text-on-surface-variant">{pending} envío(s) sin confirmar, excluidos de las barras.</p>}
          {rows.some(row => row.partial) && <p className="mt-4 text-xs text-on-surface-variant">Los valores parciales suman solo publicaciones con medición; su cobertura es distinta.</p>}
        </article>
      })}
    </div>
    <p className="max-w-4xl text-xs leading-relaxed text-on-surface-variant">Una barra ausente no equivale a cero: revisa las cifras y su cobertura. Los Me gusta y compartidos son contadores acumulados de publicaciones del año seleccionado, no interacciones recibidas exclusivamente en ese año. Las vistas y las impresiones no se comparan aquí porque no son la misma métrica.</p>
  </div>
}

function ComparisonTooltip({ active, payload, title }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return <div className="p-3 text-sm shadow-lg" style={{ backgroundColor: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}>
    <p className="font-semibold">{row.name}</p>
    <p>{title}: {format(row.value)}{row.partial ? ' (parcial)' : ''}</p>
    <p className="mt-1 text-xs text-on-surface-variant">{row.status}</p>
  </div>
}
