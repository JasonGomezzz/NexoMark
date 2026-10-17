import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, AlertCircle, Inbox, Search, Star } from 'lucide-react'
import { getMyCampaigns } from '../services/clientCampaigns'
import { Button } from '@/components/ui/button'
import XPendientesCliente from '@/components/social/XPendientesCliente'
import { useClientCampaignSocket } from '../hooks/useClientCampaignSocket'
import { campaignSentAt, relativeTimeFrom } from '../utils/date'
import { getAuthItem } from '../services/session'

export default function ClientCampaignsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    estado: '',
    industria: '',
    plataforma: '',
    valoracion: '',
  })

  function updateFilter(key, value) {
    setLoading(true)
    setError(false)
    setPage(0)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function changePage(nextPage) {
    setLoading(true)
    setError(false)
    setPage(nextPage)
  }

  // Cambios en vivo (otro usuario aprueba/rechaza/envía): actualiza in-place
  // sin recargar. Si la campaña no está en la página/filtro visible, se
  // ignora — recargarla podría reordenar/confundir la paginación en curso.
  const handleStatusChanged = useCallback((campaign) => {
    setData((current) => {
      if (!current?.content?.some((c) => c.id === campaign.id)) return current
      return {
        ...current,
        content: current.content.map((c) => (c.id === campaign.id ? { ...c, ...campaign } : c)),
      }
    })
  }, [])

  const handleCampaignSubmitted = useCallback(
    (campaign) => {
      if (page !== 0 || (filters.estado && filters.estado !== 'pendiente_aprobacion')) return
      const userEmail = getAuthItem('user_email')
      if (!userEmail || campaign.clienteEmail?.toLowerCase() !== userEmail.toLowerCase()) return
      setData((current) => {
        if (!current || current.content.some((c) => c.id === campaign.id)) return current
        return { ...current, content: [campaign, ...current.content].slice(0, 10) }
      })
    },
    [page, filters.estado]
  )

  const handleConnected = useCallback(() => setRevision((value) => value + 1), [setRevision])

  useClientCampaignSocket({
    onConnected: handleConnected,
    onCampaignSubmitted: handleCampaignSubmitted,
    onCampaignStatusChanged: handleStatusChanged,
  })

  useEffect(() => {
    let cancelled = false
    const params = Object.fromEntries(
      Object.entries({ page, size: 10, ...filters }).filter(([, value]) => value !== '')
    )
    getMyCampaigns(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, filters, revision])

  const campaigns = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Campañas pendientes</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Busca, filtra y revisa las campañas enviadas a tu cuenta.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </header>

      <XPendientesCliente />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          No se pudieron cargar las campañas pendientes.
        </div>
      )}

      <section className="glass-soft grid gap-3 rounded-xl p-4 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            placeholder="Buscar campaña, copy o marketero"
            className="h-10 w-full rounded-lg border border-outline-variant bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <select
          value={filters.estado}
          onChange={(e) => updateFilter('estado', e.target.value)}
          className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente_aprobacion">Pendientes</option>
          <option value="aprobado">Aprobadas</option>
          <option value="rechazado">Rechazadas</option>
        </select>
        <select
          value={filters.industria}
          onChange={(e) => updateFilter('industria', e.target.value)}
          className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Industria</option>
          {['tecnologia', 'salud', 'educacion', 'retail', 'gastronomia', 'moda', 'finanzas', 'entretenimiento', 'otro'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          value={filters.plataforma}
          onChange={(e) => updateFilter('plataforma', e.target.value)}
          className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Plataforma</option>
          {['instagram', 'facebook', 'twitter', 'linkedin', 'google_ads', 'tiktok'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          value={filters.valoracion}
          onChange={(e) => updateFilter('valoracion', e.target.value)}
          className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Valoración</option>
          {[5, 4, 3, 2, 1].map((item) => (
            <option key={item} value={item}>{item} estrellas</option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-outline-variant bg-white/70" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-white/50 p-12 text-center">
          <Inbox className="h-10 w-10 text-outline" />
          <h2 className="text-lg font-semibold text-on-surface">No hay campañas para mostrar</h2>
          <p className="max-w-sm text-sm text-on-surface-variant">
            Ajusta la búsqueda o espera nuevas solicitudes del marketero.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="glass-soft flex flex-col gap-4 rounded-xl p-4 shadow-sm md:flex-row md:items-center"
            >
              <div className="h-20 w-full shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:w-24">
                {campaign.imagenB64 ? (
                  <img
                    src={`data:image/png;base64,${campaign.imagenB64}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-on-surface">{campaign.titulo}</h2>
                <p className="truncate text-sm text-on-surface-variant">
                  {campaign.clienteNombre || 'Cliente'} · {campaign.plataforma || '—'} · {campaign.industria || '—'}
                </p>
                <p className="mt-1 text-xs font-medium text-primary">
                  Enviada {relativeTimeFrom(campaignSentAt(campaign))}
                </p>
                {campaign.clienteValoracion && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {campaign.clienteValoracion}/5
                  </p>
                )}
              </div>
              <Button onClick={() => navigate(`/review/${campaign.id}`)}>
                {campaign.estado === 'pendiente_aprobacion' ? 'Revisar' : 'Ver detalle'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => changePage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-on-surface-variant">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => changePage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
