import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle } from 'lucide-react'
import api from '../services/api'
import MedicionVozFormulario from '@/components/analytics/MedicionVozFormulario'
import { STATES } from '@/lib/campaignStates'

/**
 * Analytics del SuperAdmin (diseño NexoMark). Consume Django /api/admin/analytics/.
 * LÓGICA INTACTA: fetch por period, estados_globales, campanas_por_marketero, kpi.
 * Gráficos con datos REALES del backend (no inventa series que no existen).
 * Colores de estado alineados con StatusBadge / DESIGN.md.
 */
const PLATAFORMA_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  google_ads: 'Google Ads',
}

const PERIODS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
]

// Colores FSM para los charts: tokens del tema (claro y oscuro), cada uno con
// contraste ≥3:1 sobre la tarjeta; la leyenda nombra cada estado.
// Recharts no acepta clases Tailwind, así que recibe var(--color-*).
const ESTADO_COLORS = {
  borrador: 'var(--color-outline)',
  pendiente_ia: 'var(--color-primary)',
  generado: 'var(--color-secondary)',
  pendiente_aprobacion: 'var(--color-warning)',
  aprobado: 'var(--color-success)',
  rechazado: 'var(--color-error)',
}


export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // El reset de loading/error ocurre en el handler del selector (no en el
  // efecto): el efecto solo dispara el fetch y setea estado async.
  useEffect(() => {
    api
      .get('/api/admin/analytics/', { params: { period } })
      .then((res) => setData(res.data.data))
      .catch(() => setError('No se pudo cargar el analytics. Verifica tu sesión.'))
      .finally(() => setLoading(false))
  }, [period])

  function handlePeriodChange(value) {
    setPeriod(value)
    setLoading(true)
    setError(null)
  }

  const pieData = data
    ? data.estados_globales
        .filter((e) => e.total > 0)
        .map((e) => ({
          name: STATES[e.estado]?.label ?? e.estado,
          value: e.total,
          color: ESTADO_COLORS[e.estado] ?? 'var(--color-outline-variant)',
        }))
    : []

  const periodLabel = period === 'week' ? '7 días' : period === 'month' ? '30 días' : '90 días'

  return (
    <div className="space-y-6">
      {/* Header + selector */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Analítica</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Métricas globales de la plataforma.
          </p>
        </div>
        <div className="flex gap-1 rounded-[12px] border border-outline-variant p-1" role="group" aria-label="Periodo">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => handlePeriodChange(value)}
              className={`inline-flex min-h-10 items-center rounded-[8px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                period === value
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[10px] bg-surface-container-high" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total campañas"
              value={data.kpi.total_campanas}
              sub={`Últimos ${periodLabel}`}
            />
            <StatCard
              label="Tasa de aprobación"
              value={`${data.kpi.tasa_aprobacion}%`}
              sub="Aprobadas / total"
            />
            <StatCard
              label="Tiempo prom. aprobación"
              value={
                data.kpi.tiempo_promedio_aprobacion_dias == null
                  ? 'sin dato'
                  : data.kpi.tiempo_promedio_aprobacion_dias < 1
                    ? 'menos de 1 día'
                    : `${data.kpi.tiempo_promedio_aprobacion_dias} días`
              }
              sub="De creación a aprobado"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Barras — campañas por marketero */}
            <div className="regla pt-5">
              <h3 className="mb-4 text-sm font-semibold text-on-surface">
                Campañas por marketero
              </h3>
              {data.campanas_por_marketero.length === 0 ? (
                <p className="py-8 text-sm text-on-surface-variant">
                  Sin datos en este periodo
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={data.campanas_por_marketero}
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" vertical={false} />
                    <XAxis
                      dataKey="marketero"
                      tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgb(23 184 173 / 0.1)' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid var(--color-outline-variant)',
                        backgroundColor: 'var(--color-surface-container-lowest)',
                        color: 'var(--color-on-surface)',
                        fontSize: 13,
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name="Campañas"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Distribución por estado: barras horizontales (se comparan largos, no ángulos) */}
            <div className="regla pt-5">
              <h3 className="mb-5 text-sm font-semibold text-on-surface">
                Distribución por estado
              </h3>
              {pieData.length === 0 ? (
                <p className="py-8 text-sm text-on-surface-variant">
                  Sin datos en este periodo
                </p>
              ) : (
                <Barras
                  rows={pieData.map((e) => ({ clave: e.name, etiqueta: e.name, total: e.value, color: e.color }))}
                  conPorcentaje
                />
              )}
            </div>
          </div>

          {/* Campañas por plataforma (barras horizontales — datos reales) */}
          {data.campanas_por_plataforma?.length > 0 && (
            <div className="regla pt-5">
              <h3 className="mb-5 text-sm font-semibold text-on-surface">
                Campañas por plataforma
              </h3>
              <Barras
                rows={data.campanas_por_plataforma.map((r) => ({
                  clave: r.plataforma,
                  etiqueta: PLATAFORMA_LABELS[r.plataforma] ?? r.plataforma,
                  total: r.total,
                }))}
              />
            </div>
          )}
        </>
      )}

      <MedicionVozFormulario />
    </div>
  )
}

/** Barras horizontales de conteo, relativas al máximo; el número va escrito al lado. */
function Barras({ rows, conPorcentaje = false }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  const suma = rows.reduce((acc, r) => acc + r.total, 0) || 1
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.clave}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-on-surface">{r.etiqueta}</span>
            <span className="tabular-nums text-on-surface-variant">
              <span className="font-semibold text-on-surface">{r.total}</span>
              {conPorcentaje && ` · ${Math.round((r.total / suma) * 100)} %`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, Math.round((r.total / max) * 100))}%`, background: r.color ?? 'var(--color-primary)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Cifra de la plataforma: regla, rótulo y número grande; sin ícono decorativo. */
function StatCard({ label, value, sub }) {
  return (
    <div className="regla pt-5">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className="cifra mt-2 text-[36px] text-on-surface">{value ?? 'sin dato'}</p>
      {sub && <p className="mt-1 text-[13px] text-on-surface-variant">{sub}</p>}
    </div>
  )
}
