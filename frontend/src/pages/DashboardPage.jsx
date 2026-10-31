import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, ImageOff, Mic, Star } from 'lucide-react'
import api from '../services/api'
import { ButtonLink } from '@/components/ui/button'
import { getAuthItem } from '../services/session'
import { conteosDeLinea } from '@/components/linea/estaciones'

/**
 * Inicio de MARKETERO / SUPERADMIN (dirección "Línea"): la línea entera de un
 * vistazo. Cuántas campañas esperan en cada estación, lo siguiente que hay que
 * hacer (listas para enviar y cambios pedidos) y las últimas aprobadas.
 * El rol CLIENTE usa ClientDashboardPage. Datos: /api/campaigns/stats/,
 * /api/campaigns/ y /api/campaigns/recent-approved/ (se refrescan al navegar).
 */
const ESTACIONES = [
  { id: 'generar', nombre: 'Generar', desc: 'Por generar, listas para enviar o con cambios pedidos.' },
  { id: 'aprobar', nombre: 'Aprobar', desc: 'Enviadas: el cliente las está revisando.' },
  { id: 'publicar', nombre: 'Publicar', desc: 'Aprobadas: se publican en las cuentas elegidas.' },
]

export default function DashboardPage() {
  const nombre = getAuthItem('user_nombre') || ''
  const role = getAuthItem('user_role') || ''

  const [stats, setStats] = useState(null)
  const [siguientes, setSiguientes] = useState([])
  const [recentApproved, setRecentApproved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [statsRes, listaRes, recentRes] = await Promise.all([
          api.get('/api/campaigns/stats/'),
          api.get('/api/campaigns/'),
          api.get('/api/campaigns/recent-approved/', { params: { limit: 10 } }),
        ])
        if (!cancelled) {
          setStats(statsRes.data.data)
          const lista = listaRes.data.results ?? []
          setSiguientes(lista.filter((c) => ['generado', 'rechazado'].includes(c.estado)).slice(0, 4))
          setRecentApproved(recentRes.data.data.campaigns ?? [])
          setError(false)
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

  const conteos = conteosDeLinea(role, stats)
  const tokens = stats?.tokens_disponibles

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
            Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-2 text-[15px] text-on-surface-variant">
            {role === 'superadmin' ? 'Así va la línea en toda la plataforma.' : 'Así va tu línea de campañas.'}
          </p>
        </div>
        {role === 'marketero' && (
          <ButtonLink to="/campaigns/new" size="lg">
            <Mic className="h-5 w-5" aria-hidden="true" />
            Dictar una campaña
          </ButtonLink>
        )}
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          No se pudieron cargar tus campañas.
          <button
            onClick={() => {
              setLoading(true)
              setError(false)
              setRetryCount((c) => c + 1)
            }}
            className="inline-flex min-h-11 items-center font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {role === 'marketero' && tokens === 0 && (
        <p role="status" className="rounded-[10px] bg-warning-container px-4 py-3 text-sm font-medium text-on-tertiary-container">
          Te quedaste sin créditos: no puedes generar campañas. Pídelos desde{' '}
          <Link to="/credits" className="font-semibold underline">
            Créditos de IA
          </Link>
          .
        </p>
      )}

      {/* La línea de un vistazo */}
      <section aria-labelledby="linea-titulo" className="regla pt-5">
        <h2 id="linea-titulo" className="text-2xl font-extrabold text-on-surface">
          En cada estación
        </h2>
        <ol className="relative mt-6 grid gap-8 md:grid-cols-3 md:gap-6">
          <span aria-hidden="true" className="absolute left-[18px] right-[18px] top-[18px] hidden h-1.5 -translate-y-1/2 rounded-full bg-turquoise md:block" />
          {ESTACIONES.map(({ id, nombre: n, desc }) => (
            <li key={id} className="relative">
              <span aria-hidden="true" className="relative z-10 block h-9 w-9 rounded-full border-[5px] border-turquoise bg-background" />
              <Link
                to={`/campaigns?etapa=${id}`}
                className="group mt-4 block rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <span className="flex items-baseline gap-3">
                  <span className="cifra text-[44px] tabular-nums text-on-surface">{loading ? '…' : (conteos[id] ?? 'sin dato')}</span>
                  <span className="font-display text-xl font-extrabold text-on-surface group-hover:text-primary">{n}</span>
                </span>
                <span className="mt-1 block max-w-xs text-[15px] text-on-surface-variant">{desc}</span>
                <span className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
                  Ver {n.toLowerCase()}
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Lo siguiente que hay que hacer */}
      {!loading && !error && (
        <section aria-labelledby="siguiente-titulo" className="regla pt-5">
          <h2 id="siguiente-titulo" className="text-2xl font-extrabold text-on-surface">
            Lo siguiente
          </h2>
          {siguientes.length === 0 ? (
            <p className="mt-2 text-[15px] text-on-surface-variant">
              Nada esperando por ti. {role === 'marketero' ? 'Dicta una campaña nueva cuando quieras.' : ''}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
              {siguientes.map((c) => (
                <li key={c.id} className="relative flex items-center gap-4 py-4 hover:bg-surface-container-low sm:px-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="line-clamp-2 font-semibold leading-snug text-on-surface after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-primary"
                    >
                      {c.titulo}
                    </Link>
                    <p className="mt-1 text-[13px] text-on-surface-variant">{c.cliente_nombre || 'Cliente sin dato'}</p>
                  </div>
                  <span className={c.estado === 'rechazado' ? 'text-sm font-semibold text-error' : 'text-sm font-semibold text-primary'}>
                    {c.estado === 'rechazado' ? 'Cambios pedidos' : 'Lista para enviar'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Las últimas aprobadas */}
      {!loading && !error && recentApproved.length > 0 && (
        <section aria-labelledby="aprobadas-titulo" className="regla pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="aprobadas-titulo" className="text-2xl font-extrabold text-on-surface">
              Aprobadas por tus clientes
            </h2>
            <Link to="/campaigns?etapa=publicar" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {recentApproved.map((campaign) => (
              <li key={campaign.id} className="w-44 shrink-0 snap-start">
                <Link to={`/campaigns/${campaign.id}`} className="group block rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <div className="aspect-square overflow-hidden rounded-[14px] bg-surface-container-low">
                    {campaign.imagen_b64 ? (
                      <img src={`data:image/png;base64,${campaign.imagen_b64}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-outline">
                        <ImageOff className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-on-surface group-hover:text-primary">{campaign.titulo}</p>
                  {campaign.cliente_valoracion ? (
                    <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-on-surface" aria-label={`Valoración ${campaign.cliente_valoracion} de 5`}>
                      <Star className="h-3.5 w-3.5 fill-tertiary text-tertiary" aria-hidden="true" />
                      {campaign.cliente_valoracion}/5
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && stats?.total === 0 && role === 'marketero' && (
        <div className="regla pt-6">
          <h2 className="text-xl font-extrabold text-on-surface">Tu línea está vacía</h2>
          <p className="mt-2 max-w-md text-[15px] text-on-surface-variant">Dicta la primera campaña: la IA propone los campos y crea el copy y la imagen.</p>
          <ButtonLink to="/campaigns/new" className="mt-4">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Dictar una campaña
          </ButtonLink>
        </div>
      )}
    </div>
  )
}
