import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Coins,
  Megaphone,
  TrendingUp,
  ShieldQuestion,
  AlertCircle,
  ShoppingCart,
  FileEdit,
  Image as ImageIcon,
  CircleAlert,
  Sparkles,
} from 'lucide-react'
import api from '../services/api'
import StatusBadge from '@/components/StatusBadge'
import PlanesModal from '@/components/campaign/PlanesModal'
import CreditRequestButton from '@/components/campaign/CreditRequestButton'

/**
 * Detalle de créditos de IA (solo marketero/superadmin — ruta /credits).
 * Consume GET /api/campaigns/credits-detail/: saldo real, métricas del mes
 * en curso y el historial de consumo POR CAMPAÑA (no hay tabla de
 * "transacciones" ni facturación en el backend — no se inventan datos que
 * el producto no tiene: SIN fecha de renovación automática, SIN nombre de
 * "plan" comercial — eso no existe en el modelo User, ver CLAUDE.md).
 * Diseño: réplica fiel de Downloads/creditosia (donut de uso + bento de
 * KPIs + tabla), diseño NexoMark. Glass SOLO en el modal de planes.
 */
const QUOTA_DEFAULT = 100 // tokens_disponibles default del modelo User

const ESTADO_ICON = {
  borrador: FileEdit,
  pendiente_ia: Sparkles,
  generado: ImageIcon,
  pendiente_aprobacion: Megaphone,
  aprobado: Megaphone,
  rechazado: CircleAlert,
}

export default function CreditsDetailPage() {
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [showPlanes, setShowPlanes] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/campaigns/credits-detail/')
      .then(({ data: res }) => {
        if (!cancelled) setData(res.data)
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
  }, [retryCount, location.key])

  // Refresca el saldo si el usuario compra créditos (PlanesModal) mientras
  // está en esta página — mismo evento que ya usa AppLayout.jsx.
  useEffect(() => {
    function onCreditsUpdated() {
      setRetryCount((c) => c + 1)
    }
    window.addEventListener('credits-updated', onCreditsUpdated)
    return () => window.removeEventListener('credits-updated', onCreditsUpdated)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-container-high" />
        <div className="h-40 animate-pulse rounded-xl border border-outline-variant bg-white" />
        <div className="h-64 animate-pulse rounded-xl border border-outline-variant bg-white" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
        <AlertCircle className="h-4 w-4" />
        No se pudo cargar el detalle de créditos.
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
    )
  }

  const pctUsado = Math.max(
    0,
    Math.min(100, Math.round(((QUOTA_DEFAULT - data.tokens_disponibles) / QUOTA_DEFAULT) * 100)),
  )
  // Longitud del arco del donut (stroke-dasharray: usado, resto de 100)
  const dashArray = `${pctUsado}, 100`

  return (
    <div className="space-y-6">
      <PlanesModal open={showPlanes} onClose={() => setShowPlanes(false)} />

      <header>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">Créditos de IA</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Gestión y detalle de consumo de tu cuenta.
        </p>
      </header>

      {/* Bento hero: saldo + donut de uso, y KPIs apilados a la derecha */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-outline-variant bg-white p-8 shadow-sm lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:justify-between">
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <p className="text-[13px] font-semiboldr text-outline">
                  Saldo disponible
                </p>
                <h2 className="mt-2 text-5xl font-extrabold tracking-tight text-primary">
                  {data.tokens_disponibles}{' '}
                  <span className="text-xl font-normal text-outline">créditos</span>
                </h2>
              </div>
              <p className="max-w-md text-sm text-on-surface-variant">
                Cada crédito equivale a 1 generación o regeneración de IA exitosa. Al llegar a 0,
                la creación se bloquea hasta que se añadan créditos a tu cuenta.
              </p>
              <button
                onClick={() => setShowPlanes(true)}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-6 py-3 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container active:scale-95"
              >
                <ShoppingCart className="h-4 w-4" />
                Ver planes
              </button>
              <CreditRequestButton className="mt-2" />
            </div>

            {/* Donut de uso (SVG puro, sin dependencias) */}
            <div className="w-32 shrink-0 text-center">
              <svg viewBox="0 0 36 36" className="h-32 w-32 text-primary">
                <path
                  className="fill-none stroke-surface-container-high"
                  strokeWidth="3.8"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="fill-none stroke-current"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text
                  x="18"
                  y="20.35"
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-[9px] font-semibold"
                >
                  {pctUsado}%
                </text>
              </svg>
              <p className="mt-1 text-[13px] font-medium text-outline">Usado</p>
            </div>
          </div>
        </div>

        {/* KPIs del mes — todos calculados del historial real */}
        <div className="flex flex-col gap-4">
          <MetricCard
            icon={Coins}
            label="Consumidos este mes"
            value={data.consumidos_mes}
          />
          <MetricCard
            icon={Megaphone}
            label="Campañas generadas"
            value={data.campanas_mes}
          />
          <MetricCard
            icon={TrendingUp}
            label="Promedio / campaña"
            value={data.promedio_por_campana_mes}
            suffix="cr"
          />
        </div>
      </section>

      {/* Historial de consumo — por campaña, el evento de consumo real del producto */}
      <section className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
        <div className="border-b border-outline-variant px-6 py-4">
          <h2 className="text-lg font-semibold text-on-surface">Historial de consumo</h2>
        </div>

        {data.historial.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
            Aún no has generado campañas. Tu historial de consumo aparecerá aquí.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-[13px] text-on-surface-variant">
                  <th className="px-6 py-3 font-semibold">Nombre de campaña</th>
                  <th className="px-6 py-3 font-semibold">Fecha</th>
                  <th className="px-6 py-3 font-semibold">Créditos</th>
                  <th className="px-6 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.historial.map((c) => {
                  const Icon = ESTADO_ICON[c.estado] ?? Megaphone
                  const sinCosto = c.tokens_consumidos === 0
                  return (
                    <tr key={c.id} className="border-b border-outline-variant/60 last:border-0">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="max-w-xs truncate font-medium text-on-surface">
                            {c.titulo}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-on-surface-variant">
                        {new Date(c.fecha_creacion).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-on-surface">
                        {sinCosto ? '0' : `-${c.tokens_consumidos}`}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge estado={c.estado} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-sm text-on-surface-variant">
        <ShieldQuestion className="h-4 w-4 text-primary" />
        ¿Necesitas más créditos? Pídelos al administrador: el SuperAdmin revisa la solicitud desde el
        panel de Usuarios. No hay renovación automática por ciclo de facturación.
      </p>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, suffix }) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
      <div>
        <p className="text-[13px] font-medium text-outline">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-on-surface">
          {value ?? '—'}
          {suffix && <span className="ml-1 text-base font-normal text-outline">{suffix}</span>}
        </p>
      </div>
      <Icon className="h-5 w-5 text-secondary" />
    </div>
  )
}
