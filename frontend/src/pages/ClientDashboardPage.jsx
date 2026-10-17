import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ClipboardCheck,
  CircleCheck,
  CircleX,
  AlertCircle,
  ArrowRight,
  Inbox,
  X,
  ImageOff,
} from 'lucide-react'
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
  const [detailCampaign, setDetailCampaign] = useState(null)

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

  const porRevisar = summary?.pendientes ?? pending.length

  const stats = [
    {
      key: 'revisar',
      label: 'Por revisar',
      value: porRevisar,
      icon: ClipboardCheck,
      highlight: true,
    },
    { key: 'aprobadas', label: 'Aprobadas', value: summary?.aprobadas ?? null, icon: CircleCheck, tint: 'bg-success-container text-success' },
    { key: 'rechazadas', label: 'Rechazadas', value: summary?.rechazadas ?? null, icon: CircleX, tint: 'bg-error-container text-error' },
  ]

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Hola, {nombre.split(' ')[0]}
        </h1>
        <p className="mt-2 text-base text-on-surface-variant">
          {loading
            ? 'Cargando tus campañas…'
            : porRevisar > 0
              ? `Tienes ${porRevisar} ${porRevisar === 1 ? 'campaña' : 'campañas'} esperando tu revisión.`
              : 'No tienes campañas pendientes por ahora.'}
        </p>
      </header>

      <XPendientesCliente />

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map(({ key, label, value, icon: Icon, highlight, tint }, index) =>
          highlight ? (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="flex h-40 flex-col justify-between rounded-xl border border-primary/20 bg-primary-container p-6 text-on-primary-container shadow-lg transition-transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</span>
                <span className="rounded-lg bg-white/20 p-2">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <div className="text-5xl font-extrabold tabular-nums">
                {loading ? (
                  <span className="inline-block h-10 w-16 animate-pulse rounded bg-white/20" />
                ) : (
                  String(value).padStart(2, '0')
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="flex h-40 flex-col justify-between rounded-xl border border-outline-variant bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {label}
                </span>
                <span className={`rounded-lg p-2 ${tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <div className="text-5xl font-extrabold tabular-nums text-on-surface">
                {value ?? '—'}
              </div>
            </motion.div>
          ),
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          No se pudieron cargar las campañas.
          <button
            className="font-semibold underline"
            onClick={() => {
              setLoading(true)
              setError(false)
              setRetry((c) => c + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de campañas pendientes */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">Campañas recientes</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Las 7 solicitudes más recientes enviadas por marketers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/client-campaigns')}>
            Ver todas
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-outline-variant bg-white" />
            ))}
          </div>
        ) : !error && pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-white/50 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-outline">
              <Inbox className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface">Todo al día</h3>
            <p className="max-w-sm text-sm text-on-surface-variant">
              No tienes campañas esperando revisión. Cuando un marketero envíe una, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pending.map((c) => (
                <motion.article
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-4 rounded-xl border border-outline-variant bg-white p-4 shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
                    {c.imagenB64 ? (
                      <img
                        src={`data:image/png;base64,${c.imagenB64}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-on-surface">{c.titulo}</h3>
                    <p className="truncate text-sm text-on-surface-variant">
                      {c.clienteNombre || 'Cliente'} · {c.plataforma || '—'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-primary">
                      Enviada {relativeTimeFrom(campaignSentAt(c))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailCampaign(c)}>
                      Detalles
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/review/${c.id}`)}>
                      Revisar ahora
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <CampaignDetailsModal
        campaign={detailCampaign}
        onClose={() => setDetailCampaign(null)}
      />
    </div>
  )
}

function CampaignDetailsModal({ campaign, onClose }) {
  if (!campaign) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <div className="min-w-0">
            <h3 id="campaign-details-title" className="truncate text-lg font-semibold text-on-surface">
              {campaign.titulo}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {campaign.clienteNombre || 'Cliente'} · {campaign.plataforma || '—'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Cerrar detalles"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-73px)] gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-outline-variant p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Copy propuesto
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                {campaign.textoGenerado || 'Sin copy generado.'}
              </p>
            </section>

            <section className="rounded-lg border border-outline-variant p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Detalles
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <DetailMeta label="Industria" value={campaign.industria} />
                <DetailMeta label="Tono" value={campaign.tono} />
                <DetailMeta label="Estado" value={campaign.estado} />
                <DetailMeta label="Marketero" value={campaign.marketeroNombre} />
                <DetailMeta label="Enviada" value={relativeTimeFrom(campaignSentAt(campaign))} />
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-outline-variant p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Imagen
            </p>
            {campaign.imagenB64 ? (
              <img
                src={`data:image/png;base64,${campaign.imagenB64}`}
                alt={`Imagen propuesta para ${campaign.titulo}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-surface-container-high text-center text-on-surface-variant">
                <ImageOff className="h-8 w-8 text-outline" />
                <p className="text-sm">Imagen no disponible</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function DetailMeta({ label, value }) {
  return (
    <div>
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="capitalize text-on-surface">{value || '—'}</p>
    </div>
  )
}
