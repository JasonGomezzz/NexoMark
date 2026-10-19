import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Megaphone, CircleCheck, Clock, AlertCircle } from 'lucide-react'
import api from '../services/api'
import { STATES } from '@/lib/campaignStates'

/**
 * Analytics del SuperAdmin (Lumina Creative). Consume Django /api/admin/analytics/.
 * LÓGICA INTACTA: fetch por period, estados_globales, campanas_por_marketero, kpi.
 * Gráficos con datos REALES del backend (no inventa series que no existen).
 * Colores de estado alineados con StatusBadge / DESIGN.md.
 */
const PLATAFORMA_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn (retirada)',
  google_ads: 'Google Ads (retirada)',
  tiktok: 'TikTok',
}

const PERIODS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
]

// Colores FSM para los charts — paleta validada con dataviz (chroma floor,
// banda de luminosidad, separación CVD y contraste ≥3:1 sobre card blanca).
// Recharts no acepta clases Tailwind; los hex viven solo aquí.
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
          color: ESTADO_COLORS[e.estado] ?? '#cbd5e1',
        }))
    : []

  const periodLabel = period === 'week' ? '7 días' : period === 'month' ? '30 días' : '90 días'

  return (
    <div className="space-y-6">
      {/* Header + selector */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Analytics</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Métricas globales de la plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handlePeriodChange(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                period === value
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low'
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
            <div key={i} className="h-28 animate-pulse rounded-xl border border-outline-variant bg-white" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Megaphone}
              tint="bg-primary/10 text-primary"
              label="Total campañas"
              value={data.kpi.total_campanas}
              sub={`Últimos ${periodLabel}`}
            />
            <StatCard
              icon={CircleCheck}
              tint="bg-success-container text-success"
              label="Tasa de aprobación"
              value={`${data.kpi.tasa_aprobacion}%`}
              sub="Aprobadas / total"
            />
            <StatCard
              icon={Clock}
              tint="bg-tertiary-container text-tertiary"
              label="Tiempo prom. aprobación"
              value={
                data.kpi.tiempo_promedio_aprobacion_dias != null
                  ? `${data.kpi.tiempo_promedio_aprobacion_dias}d`
                  : '—'
              }
              sub="De creación a aprobado"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Barras — campañas por marketero */}
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-on-surface">
                Campañas por marketero
              </h3>
              {data.campanas_por_marketero.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
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
                      cursor={{ fill: 'rgba(23, 184, 173, 0.08)' }}
                      contentStyle={{
                        borderRadius: 4,
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

            {/* Dona — distribución de estados FSM */}
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-on-surface">
                Distribución por estado
              </h3>
              {pieData.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  Sin datos en este periodo
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        percent >= 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : null
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="var(--color-surface-container-lowest)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 4,
                        backgroundColor: 'var(--color-surface-container-lowest)',
                        color: 'var(--color-on-surface)',
                        border: '1px solid var(--color-outline-variant)',
                        fontSize: 13,
                      }}
                    />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Campañas por plataforma (barras horizontales — datos reales) */}
          {data.campanas_por_plataforma?.length > 0 && (
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-sm font-semibold text-on-surface">
                Campañas por plataforma
              </h3>
              <PlatformBars rows={data.campanas_por_plataforma} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Barras horizontales de conteo por plataforma, relativas al máximo. */
function PlatformBars({ rows }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.plataforma}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-on-surface">
              {PLATAFORMA_LABELS[r.plataforma] ?? r.plataforma}
            </span>
            <span className="tabular-nums text-on-surface-variant">{r.total}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((r.total / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Stat card según spec del DESIGN.md (misma estructura que Dashboard). */
function StatCard({ icon: Icon, tint, label, value, sub }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm transition-all hover:shadow-lg">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm text-on-surface-variant">{label}</p>
      <h3 className="mt-1 text-3xl font-bold tabular-nums text-on-surface">{value ?? '—'}</h3>
      {sub && <p className="mt-1 text-xs text-on-surface-variant">{sub}</p>}
    </div>
  )
}
