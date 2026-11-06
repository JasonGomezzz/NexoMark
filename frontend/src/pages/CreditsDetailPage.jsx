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
        <div className="h-10 w-64 rounded esqueleto" />
        <div className="h-40 rounded-[10px] esqueleto" />
        <div className="h-64 rounded-[10px] esqueleto" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
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

  return (
    <div className="space-y-6">
      <PlanesModal open={showPlanes} onClose={() => setShowPlanes(false)} />

      <header>
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Créditos de IA</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Gestión y detalle de consumo de tu cuenta.
        </p>
      </header>

      {/* Saldo y uso de la cuota; a la derecha, el mes en filas finas */}
      <section className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-3">
        <div className="regla relative pt-6 lg:col-span-2">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-outline">
                  Saldo disponible
                </p>
                <h2 className="cifra mt-2 text-[56px] text-on-surface">
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
                className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-outline-variant px-6 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.97]"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Ver planes
              </button>
              <CreditRequestButton className="mt-2" />
            </div>

            {/* Uso de la cuota como barra (no anillo): cuánto se usó de la cuota inicial */}
            <div className="w-full max-w-xs shrink-0">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-on-surface-variant">Usado de la cuota inicial</span>
                <span className="font-semibold tabular-nums text-on-surface">{pctUsado}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-container-high" role="img" aria-label={`Usado ${pctUsado}% de la cuota inicial`}>
                <div className="h-full rounded-full bg-turquoise" style={{ width: `${pctUsado}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* KPIs del mes — todos calculados del historial real */}
        <dl className="regla divide-y divide-hairline pt-2" aria-label="Este mes">
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
        </dl>
      </section>

      {/* Historial de consumo — por campaña, el evento de consumo real del producto */}
      <section className="regla pt-6" aria-labelledby="historial-titulo">
        <h2 id="historial-titulo" className="text-2xl font-extrabold text-on-surface">Historial de consumo</h2>

        {data.historial.length === 0 ? (
          <p className="py-6 text-sm text-on-surface-variant">
            Aún no has generado campañas. Tu historial de consumo aparecerá aquí.
          </p>
        ) : (
          <>
          {/* Móvil: una fila por campaña con todo a la vista, sin desplazar la tabla */}
          <ul className="mt-4 divide-y divide-hairline border-y border-hairline sm:hidden">
            {data.historial.map((c) => (
              <li key={c.id} className="py-3">
                <p className="line-clamp-2 font-medium text-on-surface">{c.titulo}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-on-surface-variant">
                  <span className="tabular-nums">
                    {new Date(c.fecha_creacion).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    {c.tokens_consumidos === 0 ? 'sin costo' : `−${c.tokens_consumidos} ${c.tokens_consumidos === 1 ? 'crédito' : 'créditos'}`}
                  </span>
                  <StatusBadge estado={c.estado} />
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-[13px] text-on-surface-variant">
                  <th className="py-3 pr-4 font-semibold">Campaña</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-right font-semibold">Créditos</th>
                  <th className="py-3 pl-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.historial.map((c) => {
                  const Icon = ESTADO_ICON[c.estado] ?? Megaphone
                  const sinCosto = c.tokens_consumidos === 0
                  return (
                    <tr key={c.id} className="border-b border-hairline last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 text-outline" aria-hidden="true" />
                          <span className="max-w-xs truncate font-medium text-on-surface">
                            {c.titulo}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-on-surface-variant">
                        {new Date(c.fecha_creacion).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-on-surface">
                        {sinCosto ? '0' : `-${c.tokens_consumidos}`}
                      </td>
                      <td className="py-3 pl-4">
                        <StatusBadge estado={c.estado} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <p className="flex items-center gap-2 text-sm text-on-surface-variant">
        <ShieldQuestion className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        ¿Necesitas más créditos? Pídelos al administrador: el SuperAdmin revisa la solicitud desde el
        panel de Usuarios. No hay renovación automática por ciclo de facturación.
      </p>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, suffix }) {
  const sinDato = value == null
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <dt className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Icon className="h-4 w-4 text-outline" aria-hidden="true" />
        {label}
      </dt>
      <dd className={sinDato ? 'text-sm text-on-surface-variant' : 'cifra text-[32px] tabular-nums text-on-surface'}>
        {sinDato ? 'sin dato' : value}
        {!sinDato && suffix && <span className="ml-1 font-sans text-base font-normal text-outline">{suffix}</span>}
      </dd>
    </div>
  )
}
