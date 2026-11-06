import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, AlertCircle, Inbox, Search, Star } from 'lucide-react'
import { getMyCampaigns } from '../services/clientCampaigns'
import { Button } from '@/components/ui/button'
import XPendientesCliente from '@/components/social/XPendientesCliente'
import { useClientCampaignSocket } from '../hooks/useClientCampaignSocket'
import { campaignSentAt, relativeTimeFrom } from '../utils/date'
import { getAuthItem } from '../services/session'

// La estación de la línea fija el estado: Aprobar = pendientes, Publicar = aprobadas.
const ESTADO_DE_ETAPA = { aprobar: 'pendiente_aprobacion', publicar: 'aprobado' }
const TITULO_DE_ETAPA = {
  aprobar: ['Por aprobar', 'Revisa cada pieza: lo que apruebes es exactamente lo que se publica.'],
  publicar: ['Aprobadas', 'Las campañas que aprobaste. En Medir ves dónde se publicaron y cómo les va.'],
}

export default function ClientCampaignsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const etapa = params.get('etapa') === 'publicar' ? 'publicar' : 'aprobar'
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    estado: ESTADO_DE_ETAPA[etapa],
    industria: '',
    plataforma: '',
    valoracion: '',
  })

  // Al cambiar de estación en la banda se ajusta el estado (derivado en el render, sin efecto).
  const [etapaPrevia, setEtapaPrevia] = useState(etapa)
  if (etapaPrevia !== etapa) {
    setEtapaPrevia(etapa)
    setFilters((current) => ({ ...current, estado: ESTADO_DE_ETAPA[etapa] }))
    setPage(0)
    setLoading(true)
    setError(false)
  }

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
    <div className="space-y-8">
      <header>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="-ml-3 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Inicio
        </button>
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">{TITULO_DE_ETAPA[etapa][0]}</h1>
        <p className="mt-2 text-[15px] text-on-surface-variant">{TITULO_DE_ETAPA[etapa][1]}</p>
      </header>

      <XPendientesCliente />

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          No se pudieron cargar tus campañas. Revisa tu conexión e intenta de nuevo.
        </div>
      )}

      <section aria-label="Buscar y filtrar" className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar campaña, copy o marketero</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden="true" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            placeholder="Buscar campaña, copy o marketero"
            className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest pl-10 pr-4 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select value={filters.estado} onChange={(e) => updateFilter('estado', e.target.value)} className="h-11 rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
            <option value="">Todos los estados</option>
            <option value="pendiente_aprobacion">Pendientes</option>
            <option value="aprobado">Aprobadas</option>
            <option value="rechazado">Rechazadas</option>
            <option value="fracaso">Rechazadas dos veces (cerradas)</option>
          </select>
        </label>
        <details className="group w-full sm:w-auto">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-4 text-sm font-semibold text-primary hover:bg-surface-container-low">
            Más filtros
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <label>
              <span className="sr-only">Industria</span>
              <select value={filters.industria} onChange={(e) => updateFilter('industria', e.target.value)} className="h-11 rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
                <option value="">Toda industria</option>
                {['tecnologia', 'salud', 'educacion', 'retail', 'gastronomia', 'moda', 'finanzas', 'entretenimiento', 'otro'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Plataforma</span>
              <select value={filters.plataforma} onChange={(e) => updateFilter('plataforma', e.target.value)} className="h-11 rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
                <option value="">Toda plataforma</option>
                {['instagram', 'facebook', 'twitter', 'linkedin', 'google_ads', 'tiktok'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Valoración</span>
              <select value={filters.valoracion} onChange={(e) => updateFilter('valoracion', e.target.value)} className="h-11 rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30">
                <option value="">Cualquier valoración</option>
                {[5, 4, 3, 2, 1].map((item) => (
                  <option key={item} value={item}>{item} estrellas</option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-24 rounded-[14px] esqueleto" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="regla flex flex-col items-start gap-2 pt-6">
          <Inbox className="h-8 w-8 text-outline" aria-hidden="true" />
          <h2 className="text-xl font-extrabold text-on-surface">
            {etapa === 'aprobar' && filters.estado === 'pendiente_aprobacion' && !filters.q ? 'Todo al día' : 'No hay campañas para mostrar'}
          </h2>
          <p className="max-w-md text-[15px] text-on-surface-variant">
            {etapa === 'aprobar' && filters.estado === 'pendiente_aprobacion' && !filters.q
              ? 'No tienes campañas por aprobar. Cuando tu agencia te envíe una, aparecerá aquí.'
              : 'Prueba con otra búsqueda o quita los filtros.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex items-center gap-4 py-4"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-container-high">
                {campaign.imagenB64 ? (
                  <img
                    src={`data:image/png;base64,${campaign.imagenB64}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-semibold leading-snug text-on-surface">{campaign.titulo}</h2>
                <p className="truncate text-sm text-on-surface-variant">
                  {campaign.clienteNombre || 'Cliente'} · {campaign.plataforma || '—'} · {campaign.industria || '—'}
                </p>
                <p className="mt-1 text-[13px] font-medium text-primary">
                  Enviada {relativeTimeFrom(campaignSentAt(campaign))}
                </p>
                {campaign.clienteValoracion && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-tertiary">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {campaign.clienteValoracion}/5
                  </p>
                )}
              </div>
              <Button
                variant={campaign.estado === 'pendiente_aprobacion' ? 'default' : 'outline'}
                onClick={() => navigate(`/review/${campaign.id}`)}
                aria-label={`${campaign.estado === 'pendiente_aprobacion' ? 'Revisar' : 'Ver'} «${campaign.titulo}»`}
              >
                <span className="hidden sm:inline">{campaign.estado === 'pendiente_aprobacion' ? 'Revisar' : 'Ver'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
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
