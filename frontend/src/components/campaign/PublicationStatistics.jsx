import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import PlatformIcon from './PlatformIcon'
import PlatformComparison from './PlatformComparison'

const labels = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter / X', tiktok: 'TikTok' }
const metrics = { likes: 'Me gusta', shares: 'Compartidos', views: 'Vistas' }
const number = value => value == null ? 'No disponible' : value.toLocaleString('es-PE')

export default function PublicationStatistics({ campaignId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const base = campaignId ? `/api/campaigns/${campaignId}/publication-statistics/` : '/api/campaigns/publication-statistics/'
  useEffect(() => {
    let active = true
    api.get(base, { params: { year } }).then(res => {
      if (active) { setData(res.data.data); setError('') }
    }).catch(() => { if (active) setError('No se pudieron cargar las estadísticas.') })
    return () => { active = false }
  }, [base, year, refresh])

  async function update(row) {
    setBusy(`${row.platform}-${row.publication_id}`)
    setNotice('')
    try {
      const res = await api.post(`/api/campaigns/${row.campaign_id}/publication-statistics/refresh/`,
        { platform: row.platform, publication_id: row.publication_id })
      setNotice(res.data.message || 'Métricas actualizadas.')
      setRefresh(v => v + 1)
    } catch (e) {
      setNotice(e.response?.data?.message || 'No se pudieron actualizar. Se conservan los datos anteriores.')
    } finally { setBusy('') }
  }

  return <section className="my-8 rounded-xl border border-outline-variant bg-white p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-on-surface">Estadísticas de publicaciones</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{campaignId ? 'Publicaciones e interacciones registradas, separadas por plataforma.' : 'Compara el rendimiento registrado en tus cuatro redes sociales.'}</p>
      </div>
      <label className="text-sm text-on-surface-variant">Año de estadísticas <select aria-label="Año de estadísticas"
        className="ml-2 rounded-lg border border-outline-variant p-2" value={year} onChange={e => setYear(Number(e.target.value))}>
        {[0, 1, 2, 3, 4].map(n => new Date().getFullYear() - n).map(y => <option key={y}>{y}</option>)}
      </select></label>
    </div>
    {error && <p role="alert" className="text-error">{error} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Reintentar</button></p>}
    {(!data || data.year !== year) && !error && <p role="status">Cargando estadísticas…</p>}
    {data && data.year === year && <>
      {!campaignId && <PlatformComparison platforms={data.platforms} year={data.year} />}
      {campaignId && <div className="grid gap-6 xl:grid-cols-2">
        {Object.entries(labels).map(([platform, label]) => {
          const group = data.platforms[platform]
          return <article key={platform} className="min-w-0 rounded-xl bg-surface-container-low p-5">
            <div className="mb-4 flex items-center gap-3"><PlatformIcon platform={platform} className="!h-10 !w-10" /><h3 className="text-lg font-semibold">{label}</h3></div>
            <p className="mb-4 text-xs text-on-surface-variant">Totales acumulados · publicaciones de {data.year}</p>
            {group.pending > 0 && <p className="mb-4 text-sm text-on-surface-variant">{group.pending} envío(s) sin confirmación de publicación. No se incluyen en el total confirmado.</p>}
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><dt className="text-sm text-on-surface-variant">Publicaciones</dt><dd className="text-2xl font-bold tabular-nums">{number(group.publications)}</dd></div>
              {Object.entries(metrics).map(([key, text]) => <div key={key}>
                <dt className="text-sm text-on-surface-variant">{platform === 'twitter' && key === 'views' ? 'Impresiones' : platform === 'twitter' && key === 'shares' ? 'Reposts' : text}</dt>
                <dd className="font-semibold tabular-nums">{number(group.metrics[key].value)}</dd>
                <dd className="text-xs text-on-surface-variant">{group.metrics[key].covered}/{group.publications} publicaciones con dato</dd>
              </div>)}
            </dl>
          </article>
        })}
      </div>}
      <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">{data.note}</p>
      {notice && <p role="status" className="my-3 text-sm">{notice}</p>}
      {data.publications.length === 0 ? <p className="mt-5 text-sm">Aún no hay publicaciones confirmadas para mostrar.</p> :
        <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="mb-3 text-left font-semibold">Historial de publicaciones · incluye versiones anteriores</caption>
          <thead><tr className="border-b border-outline-variant">
            <th className="p-2">Publicación</th><th className="p-2">Me gusta</th><th className="p-2">Compartidos / Reposts</th><th className="p-2">Medición</th>
          </tr></thead>
          <tbody>{data.publications.map(row => <tr key={`${row.platform}-${row.publication_id}`} className="border-b border-outline-variant">
            <td className="p-2"><span className="flex items-center gap-2"><PlatformIcon platform={row.platform} />{labels[row.platform]} · {row.destination}</span>
              <Link className="underline" to={`/campaigns/${row.campaign_id}`}>{row.title}</Link><p className="text-xs">Versión {row.version}</p>
              {row.confirmation_source === 'user_confirmed_display_api' && <p className="text-xs">Publicación existente vinculada por el propietario y verificada por API; estado del envío original: {row.delivery_status}.</p>}
              {row.publication_count > 1 && <p className="text-xs">{row.publication_count} posts públicos confirmados para este envío · contadores sumados</p>}</td>
            {['likes', 'shares'].map(k => <td className="p-2 tabular-nums" key={k}>{number(row.metrics[k])}</td>)}
            <td className="p-2"><p className="mb-1 text-xs">{row.measured_at ? new Date(row.measured_at).toLocaleString('es-PE') : 'Sin consultar'}</p>
              {row.refresh_cost_note && <p className="mb-2 max-w-xs text-xs text-on-surface-variant">{row.refresh_cost_note}</p>}
              {row.can_refresh ? <button disabled={!!busy} onClick={() => update(row)} className="rounded-lg border border-outline-variant px-3 py-2 disabled:opacity-50">
                {busy === `${row.platform}-${row.publication_id}` ? 'Consultando…' : 'Consultar métricas'}
              </button> : <span className="text-xs">{row.refresh_note || 'Consulta de interacciones pendiente'}</span>}</td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>
}
