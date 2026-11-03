import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, Mic, Search, Trash2 } from 'lucide-react'
import api from '../services/api'
import { Button, ButtonLink } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import { getAuthItem } from '../services/session'
import { conteosDeLinea, etapaDeEstado, urlDeEtapa } from '@/components/linea/estaciones'
import { cn } from '@/lib/utils'

/**
 * Campañas por paso de la orden de trabajo (Marketero/SuperAdmin). Consume Django con
 * paginación DRF. `?etapa=generar|aprobar|publicar` filtra por estación (lo usa
 * la banda de navegación); sin etapa, todas. El paso se filtra en el servidor
 * (`?estado=`) y sus conteos salen de /stats/; la búsqueda mira la página cargada.
 */
const ETAPAS = {
  generar: { titulo: 'En Generar', desc: 'Por generar, listas para enviar o con cambios pedidos por el cliente.' },
  aprobar: { titulo: 'En Aprobar', desc: 'Enviadas: el cliente las está revisando.' },
  publicar: { titulo: 'En Publicar', desc: 'Aprobadas por el cliente: se publican en las cuentas elegidas.' },
}
const ORDEN = ['dictar', 'generar', 'aprobar', 'publicar', 'medir']

/** Cinco casillas mínimas: en qué paso de la orden va la campaña. */
function MiniRecorrido({ estado }) {
  const etapa = etapaDeEstado(estado)
  const indice = etapa ? ORDEN.indexOf(etapa) : 2
  const rechazo = estado === 'rechazado' || estado === 'fracaso'
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {ORDEN.map((id, i) => (
        <span
          key={id}
          className={cn(
            'h-3 w-3 rounded-[3px]',
            rechazo && id === 'aprobar'
              ? 'bg-error'
              : i < indice
                ? 'bg-primary-fixed ring-1 ring-inset ring-primary/40'
                : i === indice
                  ? 'bg-turquoise'
                  : 'border border-dashed border-outline-variant',
          )}
        />
      ))}
    </span>
  )
}

export default function CampaignListPage() {
  const role = getAuthItem('user_role') || ''
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const etapa = ETAPAS[params.get('etapa')] ? params.get('etapa') : null
  const [busqueda, setBusqueda] = useState('')

  const [campaigns, setCampaigns] = useState([])
  const [count, setCount] = useState(0)
  const [nextUrl, setNextUrl] = useState(null)
  const [prevUrl, setPrevUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Paso al que corresponde la lista mostrada: al cambiar de paso, la anterior no se
  // presenta como si fuera la nueva mientras llega la respuesta.
  const [etapaCargada, setEtapaCargada] = useState(undefined)
  const [conteos, setConteos] = useState({})

  // loadCampaigns solo setea estado en callbacks async (apto para el efecto);
  // fetchCampaigns agrega el reset síncrono y se usa desde handlers.
  function loadCampaigns(url, paraEtapa, vigente = () => true) {
    return api
      .get(url)
      .then(({ data }) => {
        if (!vigente()) return
        setCampaigns(data.results)
        setCount(data.count)
        setNextUrl(data.next)
        setPrevUrl(data.previous)
        setError(false)
      })
      .catch(() => vigente() && setError(true))
      .finally(() => {
        if (!vigente()) return
        setEtapaCargada(paraEtapa)
        setLoading(false)
      })
  }

  function loadConteos() {
    return api
      .get('/api/campaigns/stats/')
      .then(({ data }) => setConteos(conteosDeLinea(role, data?.data)))
      .catch(() => setConteos({}))
  }

  function fetchCampaigns(url = urlDeEtapa(etapa)) {
    setLoading(true)
    setError(false)
    loadCampaigns(url, etapa)
  }

  async function handleDelete(campaign) {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.titulo}"? Esta acción no se puede deshacer.`)) {
      return
    }
    try {
      await api.delete(`/api/campaigns/${campaign.id}/`)
      fetchCampaigns()
      loadConteos()
    } catch (err) {
      window.alert(err.response?.data?.message || 'No se pudo eliminar la campaña.')
    }
  }

  useEffect(() => {
    let vigente = true
    loadCampaigns(urlDeEtapa(etapa), etapa, () => vigente)
    return () => {
      vigente = false
    }
  }, [etapa])

  useEffect(() => {
    loadConteos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargando = loading || etapaCargada !== etapa

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) =>
      [c.titulo, c.cliente_nombre, c.cliente_email].some((v) => (v || '').toLowerCase().includes(q)),
    )
  }, [campaigns, busqueda])
  const sinCampanas = !etapa && count === 0

  const elegirEtapa = (id) => setParams(id ? { etapa: id } : {})

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
            {etapa ? ETAPAS[etapa].titulo : 'Todas las campañas'}
          </h1>
          <p className="mt-2 text-[15px] text-on-surface-variant">
            {etapa ? ETAPAS[etapa].desc : count > 0 ? `${count} ${count === 1 ? 'campaña' : 'campañas'} en total.` : 'Todavía no hay campañas.'}
          </p>
        </div>
        {role === 'marketero' && (
          <ButtonLink to="/campaigns/new">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Dictar una campaña
          </ButtonLink>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full flex-wrap gap-1 rounded-[12px] border border-outline-variant p-1" role="group" aria-label="Filtrar por paso">
          {[[null, 'Todas'], ['generar', 'Generar'], ['aprobar', 'Aprobar'], ['publicar', 'Publicar']].map(([id, texto]) => (
            <button
              key={texto}
              type="button"
              onClick={() => elegirEtapa(id)}
              aria-pressed={etapa === id}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[8px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                etapa === id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
              )}
            >
              {texto}
              {id && conteos[id] != null && <span className="tabular-nums opacity-80">{conteos[id]}</span>}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar por título o cliente</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título o cliente"
            className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest pl-10 pr-4 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          No se pudieron cargar las campañas.
          <button className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => fetchCampaigns()}>
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <ul className="divide-y divide-hairline border-y border-hairline" aria-label="Cargando campañas">
          {[...Array(6)].map((_, i) => (
            <li key={i} className="flex items-center gap-4 py-5">
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-container-high" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-surface-container-high" />
            </li>
          ))}
        </ul>
      ) : !error && visibles.length === 0 ? (
        <div className="regla flex flex-col items-start gap-3 pt-6">
          <h2 className="text-xl font-extrabold text-on-surface">
            {sinCampanas
              ? 'Aún no hay campañas'
              : busqueda
                ? 'Ninguna campaña coincide con la búsqueda'
                : `No hay campañas ${etapa ? ETAPAS[etapa].titulo.toLowerCase() : ''}`}
          </h2>
          <p className="max-w-md text-[15px] text-on-surface-variant">
            {sinCampanas && role === 'marketero'
              ? 'Dicta la primera: la IA propone los campos y crea el copy y la imagen.'
              : busqueda
                ? 'Prueba con otra palabra o quita la búsqueda.'
                : 'Cuando una campaña llegue a este paso, aparecerá aquí.'}
          </p>
          {sinCampanas && role === 'marketero' && (
            <Button className="mt-1" onClick={() => navigate('/campaigns/new')}>
              <Mic className="h-4 w-4" aria-hidden="true" />
              Dictar una campaña
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {visibles.map((c) => (
              <li key={c.id} className="group relative flex items-center gap-4 py-4 transition-colors hover:bg-surface-container-low sm:px-2">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/campaigns/${c.id}`}
                    className="line-clamp-2 font-semibold leading-snug text-on-surface after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-primary"
                  >
                    {c.titulo}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-on-surface-variant">
                    <span>{c.cliente_nombre || 'Cliente sin dato'}</span>
                    <span className="capitalize">{c.plataforma?.replace('_', ' ')}</span>
                    <span className="tabular-nums">{new Date(c.fecha_creacion).toLocaleDateString('es-PE')}</span>
                  </p>
                </div>
                <div className="hidden md:block">
                  <MiniRecorrido estado={c.estado} />
                </div>
                <StatusBadge estado={c.estado} />
                {role === 'marketero' && ['borrador', 'generado'].includes(c.estado) ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    aria-label={`Eliminar «${c.titulo}»`}
                    className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  role === 'marketero' && <span className="w-11 shrink-0" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Fuera de la lista: con una búsqueda sin resultados en esta página, las demás siguen a mano. */}
      {!cargando && (prevUrl || nextUrl) && (
        <div className="mt-4 flex justify-between">
          <Button variant="outline" size="sm" disabled={!prevUrl} onClick={() => fetchCampaigns(prevUrl)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={!nextUrl} onClick={() => fetchCampaigns(nextUrl)}>
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
