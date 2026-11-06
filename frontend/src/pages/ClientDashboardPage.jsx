import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, ImageOff } from 'lucide-react'
import { getPendingCampaigns, getCampaignSummary } from '../services/clientCampaigns'
import { Button } from '@/components/ui/button'
import XPendientesCliente from '@/components/social/XPendientesCliente'
import { useClientCampaignSocket } from '../hooks/useClientCampaignSocket'
import { campaignSentAt, relativeTimeFrom } from '../utils/date'
import { getAuthItem } from '../services/session'

/**
 * Dashboard del rol CLIENTE. Consume Spring Boot :8080 (arquitectura políglota).
 * Muestra: Por revisar / Aprobadas / Rechazadas + lista de campañas pendientes.
 * El cliente revisa/aprueba, NO crea campañas.
 */
export default function ClientDashboardPage() {
  const nombre = getAuthItem('user_nombre') || 'usuario'
  const navigate = useNavigate()
  const location = useLocation()

  const [pending, setPending] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  const handleRealtimeCampaign = useCallback((campaign) => {
    if (campaign.estado !== 'pendiente_aprobacion') return
    const userEmail = getAuthItem('user_email')
    if (!userEmail || campaign.clienteEmail?.toLowerCase() !== userEmail.toLowerCase()) return
    setPending((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== campaign.id)
      return [campaign, ...withoutDuplicate].slice(0, 7)
    })
    setSummary((current) => (
      current
        ? { ...current, pendientes: (current.pendientes ?? 0) + 1 }
        : current
    ))
  }, [])

  const handleStatusChanged = useCallback((campaign) => {
    const userEmail = getAuthItem('user_email')
    if (!userEmail || campaign.clienteEmail?.toLowerCase() !== userEmail.toLowerCase()) return
    setPending((current) => current.filter((item) => item.id !== campaign.id))
    setSummary((current) => {
      if (!current) return current
      const next = { ...current, pendientes: Math.max(0, (current.pendientes ?? 0) - 1) }
      if (campaign.estado === 'aprobado') next.aprobadas = (current.aprobadas ?? 0) + 1
      else if (campaign.estado === 'rechazado' || campaign.estado === 'fracaso') {
        next.rechazadas = (current.rechazadas ?? 0) + 1
      }
      return next
    })
  }, [])

  const handleConnected = useCallback(() => setRetry((value) => value + 1), [setRetry])

  useClientCampaignSocket({
    onConnected: handleConnected,
    onCampaignSubmitted: handleRealtimeCampaign,
    onCampaignStatusChanged: handleStatusChanged,
  })

  // Sin setState síncrono en el efecto: el estado inicial cubre el primer
  // load; el retry resetea en su handler; location.key refresca en silencio.
  useEffect(() => {
    let cancelled = false

    getPendingCampaigns({ page: 0, size: 7 })
      .then((data) => {
        if (!cancelled) setPending(data?.content ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // Conteos para las stat cards — si falla, las cards muestran "—" sin romper el feed
    getCampaignSummary()
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [retry, location.key])

  const porRevisar = summary?.pendientes ?? (loading ? null : pending.length)

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
          Hola{nombre && nombre !== 'usuario' ? `, ${nombre.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-2 text-[15px] text-on-surface-variant">
          Aquí apruebas lo que tu agencia publica en tus redes. Lo que apruebes es exactamente lo que sale.
        </p>
      </header>

      <XPendientesCliente />

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          No se pudieron cargar tus campañas.
          <button
            onClick={() => {
              setLoading(true)
              setError(false)
              setRetry((value) => value + 1)
            }}
            className="inline-flex min-h-11 items-center font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      )}

      <section aria-labelledby="por-aprobar-titulo" className="regla pt-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="cifra text-[44px] tabular-nums text-on-surface">{porRevisar ?? '…'}</span>
          <h2 id="por-aprobar-titulo" className="text-2xl font-extrabold text-on-surface">
            {porRevisar === 1 ? 'campaña por aprobar' : 'campañas por aprobar'}
          </h2>
        </div>
        {!loading && pending.length === 0 ? (
          <p className="mt-2 text-[15px] text-on-surface-variant">Todo al día. Cuando tu agencia te envíe una campaña, aparecerá aquí y te avisaremos.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
            {loading &&
              [0, 1, 2].map((i) => (
                <li key={`esqueleto-${i}`} role="status" aria-label="Cargando campañas" className="flex items-center gap-4 py-4 sm:px-2">
                  <span className="esqueleto h-16 w-16 shrink-0 rounded-[10px]" />
                  <span className="flex-1 space-y-2">
                    <span className="esqueleto block h-4 w-3/5 rounded" />
                    <span className="esqueleto block h-3 w-2/5 rounded" />
                  </span>
                </li>
              ))}
            {(loading ? [] : pending).map((c) => (
              <li key={c.id} className="relative flex items-center gap-4 py-4 hover:bg-surface-container-low sm:px-2">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-container-high">
                  {c.imagenB64 ? (
                    <img src={`data:image/png;base64,${c.imagenB64}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-outline">
                      <ImageOff className="h-6 w-6" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/review/${c.id}`)}
                    className="line-clamp-2 text-left font-semibold leading-snug text-on-surface after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-primary"
                  >
                    {c.titulo}
                  </button>
                  <p className="mt-1 text-[13px] text-on-surface-variant">
                    {c.marketeroNombre ? `De ${c.marketeroNombre} · ` : ''}enviada {relativeTimeFrom(campaignSentAt(c))}
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-sm font-semibold text-primary sm:inline-flex">
                  Revisar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </li>
            ))}
          </ul>
        )}
        {loading && <div className="mt-4 h-24 rounded-[14px] esqueleto" />}
      </section>

      <section aria-labelledby="historial-titulo" className="regla pt-5">
        <h2 id="historial-titulo" className="text-2xl font-extrabold text-on-surface">
          Lo que ya decidiste
        </h2>
        <dl className="mt-4 grid max-w-xl grid-cols-2 gap-6">
          <div>
            <dt className="text-sm text-on-surface-variant">Aprobadas</dt>
            <dd className="cifra mt-1 text-[32px] tabular-nums text-on-surface">{summary ? summary.aprobadas ?? 'sin dato' : '…'}</dd>
          </div>
          <div>
            <dt className="text-sm text-on-surface-variant">Con cambios pedidos</dt>
            <dd className="cifra mt-1 text-[32px] tabular-nums text-on-surface">{summary ? summary.rechazadas ?? 'sin dato' : '…'}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate('/client-campaigns?etapa=publicar')}>
            Ver aprobadas
          </Button>
          <Button variant="outline" onClick={() => navigate('/stats')}>
            Ver cómo rinden
          </Button>
        </div>
      </section>
    </div>
  )
}
