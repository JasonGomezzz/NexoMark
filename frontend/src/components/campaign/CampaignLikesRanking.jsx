import { Link } from 'react-router-dom'
import { campaignLikesRanking, comparisonPlatforms } from '@/services/publicationStatistics'

export default function CampaignLikesRanking({ rows, year, platform }) {
  const ranking = campaignLikesRanking(rows, year, platform)
  const label = comparisonPlatforms.find(item => item.key === platform)?.label ?? 'Todas las redes'
  return <section className="mt-8 space-y-4" aria-labelledby="campaign-likes-ranking-title">
    <div>
      <h3 id="campaign-likes-ranking-title" className="text-lg font-semibold text-on-surface">Campañas con más Me gusta</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Hasta 3 campañas · {label} · publicaciones de {year}</p>
    </div>
    {ranking.incomplete && <p className="bg-warning-container p-3 text-sm text-on-surface">Comparación incompleta: faltan mediciones de algunas publicaciones. Las posiciones pueden cambiar al obtener esos datos.</p>}
    {ranking.campaigns.length === 0 ? <p className="bg-surface-container-low p-5 text-sm text-on-surface-variant">
      {ranking.total === 0 ? 'No hay publicaciones confirmadas para este filtro.' : 'Todavía no hay campañas con mediciones de Me gusta para ordenar.'}
    </p> : <ol className="grid gap-4 lg:grid-cols-3" aria-label={`Ranking de campañas · ${label} · ${year}`}>
      {ranking.campaigns.map(row => <li key={row.campaignId} className="min-w-0 bg-surface-container-low p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-primary">Puesto {row.rank}{row.tied ? ' · empate' : ''}</span>
          {row.partial && <span className="text-xs text-on-surface-variant">Datos parciales</span>}
        </div>
        <h4 className="mt-3 break-words font-semibold text-on-surface">
          <Link to={`/campaigns/${row.campaignId}`} className="underline decoration-outline-variant underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">{row.title}</Link>
        </h4>
        <p className="mt-4 text-3xl font-bold tabular-nums text-on-surface">{row.likes.toLocaleString('es-PE')} <span className="text-sm font-normal text-on-surface-variant">Me gusta registrados</span></p>
        <p className="mt-2 text-xs text-on-surface-variant">{row.covered}/{row.publications} publicaciones con medición</p>
      </li>)}
    </ol>}
    {ranking.excluded > 0 && <p className="text-xs text-on-surface-variant">{ranking.excluded} campaña(s) sin mediciones de Me gusta, excluidas del ranking; no se consideran cero.</p>}
    {ranking.tiedAtCutoff && <p className="text-xs text-on-surface-variant">Hay más campañas empatadas en el corte. Se muestran como máximo tres; en los empates se ordenan por identificador de campaña ascendente.</p>}
    <p className="max-w-4xl text-xs leading-relaxed text-on-surface-variant">Se suma el último contador acumulado de cada publicación registrada en el año, incluidas versiones anteriores. No son likes recibidos exclusivamente en ese año ni personas únicas. Más Me gusta no demuestra más ventas o rentabilidad. Este ranking usa mediciones guardadas; no actualiza las redes automáticamente.</p>
  </section>
}
