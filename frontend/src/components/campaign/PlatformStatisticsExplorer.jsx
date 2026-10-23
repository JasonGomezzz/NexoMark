import { useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PlatformComparison from './PlatformComparison'
import PlatformIcon from './PlatformIcon'
import { comparisonPlatforms, platformComparisonData, platformMonthlyData } from '@/services/publicationStatistics'

const format = value => value == null ? 'No disponible' : value.toLocaleString('es-PE')

export default function PlatformStatisticsExplorer({ data, selected, onSelect }) {
  const heading = useRef(null)
  const label = comparisonPlatforms.find(row => row.key === selected)?.label
  useEffect(() => {
    if (selected) heading.current?.focus({ preventScroll: true })
  }, [selected])
  const rows = label ? platformMonthlyData(data, selected) : []
  const group = label ? data.platforms[selected] : null
  return <div className="space-y-6">
    <nav aria-label="Vista de estadísticas" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={!selected} onClick={() => onSelect(null)}
        className={`px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${!selected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'}`}>
        {selected ? 'Volver a comparativa' : 'Comparativa general'}
      </button>
      {comparisonPlatforms.map(({ key, label: name }) => <button key={key} type="button" aria-pressed={selected === key}
        onClick={() => onSelect(key)} aria-label={`Ver estadísticas de ${name}`}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected === key ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'}`}>
        <PlatformIcon platform={key} />{name}
      </button>)}
    </nav>
    {!label ? <PlatformComparison platforms={data.platforms} year={data.year} /> : <section aria-labelledby="platform-statistics-heading" className="space-y-5">
      <div>
        <h3 id="platform-statistics-heading" ref={heading} tabIndex={-1} className="flex items-center gap-3 text-xl font-semibold text-on-surface">
          <PlatformIcon platform={selected} />{label} · {data.year}
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">Totales acumulados de las publicaciones registradas en {data.year}.</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['publications', 'Publicaciones'], ['likes', 'Me gusta'],
          ['shares', selected === 'twitter' ? 'Reposts' : 'Compartidos'],
          ['views', selected === 'twitter' ? 'Impresiones' : 'Vistas'],
        ].map(([metric, title]) => {
          const row = platformComparisonData(data.platforms, metric).find(item => item.platform === selected)
          return <div key={metric} className="bg-surface-container-low p-4">
            <dt className="text-sm text-on-surface-variant">{title}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{format(row.value)}</dd>
            <dd className="mt-1 text-xs text-on-surface-variant">{row.partial ? 'Parcial · ' : ''}{row.status === 'No disponible' ? 'Sin medición registrada' : row.status}</dd>
          </div>
        })}
      </dl>
      {group?.pending > 0 && <p className="text-sm text-on-surface-variant">{group.pending} envío(s) sin confirmar, excluidos del total de publicaciones.</p>}
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <MonthlyChart rows={rows} metric="publications" title="Publicaciones por mes" platform={selected} />
        <MonthlyChart rows={rows} metric="likes" title="Me gusta por mes" platform={selected} />
      </div>
      <p className="text-xs leading-relaxed text-on-surface-variant">Los meses corresponden al registro de las publicaciones, no a la fecha en que recibieron cada like. Me gusta muestra el último contador acumulado; una medición nueva puede cambiar meses anteriores. Los meses sin medición no equivalen a cero.</p>
      <p className="text-xs leading-relaxed text-on-surface-variant">{selected === 'twitter' ? 'X informa impresiones y reposts (sin citas); no se presentan como vistas ni como alcance único.'
        : selected === 'instagram' ? 'Vistas y compartidos de Instagram requieren Insights; se muestra «No disponible» si no hay medición.'
          : 'Solo se muestran contadores que la plataforma haya devuelto y que NexoMark tenga registrados.'}</p>
    </section>}
  </div>
}

function MonthlyChart({ rows, metric, title, platform }) {
  const hasData = rows.some(row => row[metric] != null)
  return <article className="min-w-0 bg-surface-container-low p-4 sm:p-5" aria-label={title}>
    <h4 className="font-semibold">{title}</h4>
    <p className="mt-1 text-xs text-on-surface-variant">{metric === 'likes' ? 'Contadores acumulados de las publicaciones de cada mes.' : 'Publicaciones confirmadas según su mes de registro.'}</p>
    {hasData ? <div className="mt-4 h-60" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 0, left: -22, bottom: 10 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" strokeDasharray="3 3" />
          <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={40} axisLine={false} tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-on-surface-variant)' }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
          <Tooltip content={<MonthlyTooltip metric={metric} title={title} />} cursor={{ fill: 'var(--color-surface-container-high)' }} />
          <Bar dataKey={metric} name={title} fill={`var(--color-chart-${platform})`} maxBarSize={32} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <p className="flex h-60 items-center justify-center text-sm text-on-surface-variant">Sin mediciones disponibles para este año.</p>}
    <p className="text-center text-xs text-on-surface-variant">Meses</p>
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-primary">Consultar valores exactos de {title.toLowerCase()}</summary>
      <table className="mt-3 w-full text-left text-xs">
        <caption className="sr-only">{title}: valores y cobertura mensual</caption>
        <thead><tr><th className="py-2">Mes</th><th>Valor</th>{metric === 'likes' && <th>Con medición</th>}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.month}>
          <th scope="row" className="py-1 font-normal">{row.name}</th>
          <td className="tabular-nums">{format(row[metric])}</td>
          {metric === 'likes' && <td>{row.covered}/{row.total ?? '—'}{row.likes != null && row.covered < row.total ? ' · parcial' : ''}</td>}
        </tr>)}</tbody>
      </table>
    </details>
  </article>
}

function MonthlyTooltip({ active, payload, metric, title }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return <div className="p-3 text-sm shadow-lg" style={{ backgroundColor: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}>
    <p className="font-semibold">{row.name}</p><p>{title}: {format(row[metric])}</p>
    {metric === 'likes' && <p className="mt-1 text-xs">{row.covered}/{row.total ?? '—'} publicaciones con dato</p>}
  </div>
}
