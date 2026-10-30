import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Megaphone,
  Coins,
  Sparkles,
  CircleCheck,
  Clock,
  AlertCircle,
  Plus,
  ImageOff,
  Star,
} from 'lucide-react'
import api from '../services/api'
import { STATES } from '@/lib/campaignStates'
import { getAuthItem } from '../services/session'

/**
 * Dashboard de MARKETERO / SUPERADMIN (diseño NexoMark).
 * El rol CLIENTE usa ClientDashboardPage (ruteado por rol en App.jsx).
 * LÓGICA INTACTA: fetch de /api/campaigns/stats/ + /api/auth/me/, cálculos por
 * estado FSM, loading/error/retry, re-fetch por location.key.
 */
export default function DashboardPage() {
  const nombre = getAuthItem('user_nombre') || 'usuario'
  const role = getAuthItem('user_role') || ''

  const [stats, setStats] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [recentApproved, setRecentApproved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const location = useLocation()

  // Sin setState síncrono en el efecto: el estado inicial cubre el primer
  // load; el retry resetea en su handler; la re-navegación (location.key)
  // refresca en silencio manteniendo los datos visibles.
  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const [statsRes, meRes, recentRes] = await Promise.all([
          api.get('/api/campaigns/stats/'),
          api.get('/api/auth/me/'),
          api.get('/api/campaigns/recent-approved/', { params: { limit: 10 } }),
        ])
        if (!cancelled) {
          setStats(statsRes.data.data)
          setTokens(meRes.data.data.user.tokens_disponibles)
          setRecentApproved(recentRes.data.data.campaigns ?? [])
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [retryCount, location.key])

  const activeCampaigns = stats
    ? (stats.generado ?? 0) + (stats.pendiente_aprobacion ?? 0) + (stats.aprobado ?? 0)
    : null

  const iaGenerations = stats
    ? (stats.pendiente_ia ?? 0) +
      (stats.generado ?? 0) +
      (stats.pendiente_aprobacion ?? 0) +
      (stats.aprobado ?? 0) +
      (stats.rechazado ?? 0)
    : null

  const cards = [
    {
      label: 'Campañas activas',
      value: activeCampaigns,
      icon: Megaphone,
      tint: 'bg-primary/10 text-primary',
    },
    {
      label: 'Créditos de IA',
      value: tokens,
      icon: Coins,
      tint: 'bg-tertiary-container text-tertiary',
      warn: tokens === 0,
    },
    {
      label: 'Generaciones IA',
      value: iaGenerations,
      icon: Sparkles,
      tint: 'bg-secondary-container text-primary',
    },
    {
      label: 'Aprobadas',
      value: stats ? (stats.aprobado ?? 0) : null,
      icon: CircleCheck,
      tint: 'bg-success-container text-success',
    },
  ]

  function displayValue(val) {
    if (error) return '—'
    return val ?? 0
  }

  const cardReveal = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Hola, {nombre.split(' ')[0]}
          </h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Gestiona tus campañas y monitorea el rendimiento con IA.
          </p>
        </div>
        {role === 'marketero' && (
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-lg transition-all hover:bg-primary-container active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Link>
        )}
      </div>

      {/* Aviso de cuota agotada (HU24) */}
      {tokens === 0 && !loading && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-fixed px-5 py-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-on-primary-fixed">
            <b>Te quedaste sin créditos de IA.</b> Puedes ver tu historial, pero no
            crear ni regenerar campañas. Contacta a tu administrador para reponer la cuota.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          No se pudieron cargar los datos.
          <button
            className="font-semibold underline"
            onClick={() => {
              setLoading(true)
              setError(false)
              setRetryCount((c) => c + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tint, warn }, index) => (
          <motion.div
            key={label}
            {...cardReveal}
            transition={{ duration: 0.35, delay: index * 0.06 }}
            className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm transition-all hover:shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${tint}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-on-surface-variant">{label}</p>
            {loading ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-surface-container-high" />
            ) : (
              <h3
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  warn ? 'text-error' : 'text-on-surface'
                }`}
              >
                {displayValue(value)}
              </h3>
            )}
          </motion.div>
        ))}
      </div>

      {/* Distribución por estado FSM */}
      {!loading && !error && stats && (
        <div className="mt-8 rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-on-surface">Distribución por estado</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATES).map(([estado, s]) => (
              <StateBadge
                key={estado}
                label={s.label}
                value={stats[estado]}
                className={s.className}
                icon={estado === 'pendiente_ia' ? Clock : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && recentApproved.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">
                Campañas aceptadas recientes
              </h2>
              <p className="text-sm text-on-surface-variant">
                Las últimas 10 aprobadas con valoración del cliente.
              </p>
            </div>
            <CircleCheck className="h-5 w-5 text-success" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {recentApproved.map((campaign) => (
              <Link
                key={campaign.id}
                to={`/campaigns/${campaign.id}`}
                className="group overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
                  {campaign.imagen_b64 ? (
                    <img
                      src={`data:image/png;base64,${campaign.imagen_b64}`}
                      alt={campaign.titulo}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-outline">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}

                  {campaign.cliente_valoracion && (
                    <div className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-black/45 px-2 py-1 text-amber-300">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= campaign.cliente_valoracion ? 'fill-current' : 'text-white/35'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
                    {campaign.titulo}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Pill de estado FSM con su conteo. */
function StateBadge({ label, value, className, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <span className="tabular-nums opacity-80">{value ?? 0}</span>
    </span>
  )
}
