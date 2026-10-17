import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { AlertCircle, ChartColumnIncreasing, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NetworkPanel from '../components/social/NetworkPanel'
import PublicationBadge from '../components/social/PublicationBadge'
import PublicationStatsDrawer from '../components/social/PublicationStatsDrawer'
import RedIcon from '../components/social/RedIcon'
import { useAuth } from '../hooks/useAuth'
import { alcanceDelRol, filtrarPublicaciones, formatoMetrica, metricasDeRed } from '../services/social'
import { socialApi } from '../services/socialApi'

const FILTRO_RED = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'instagram', texto: 'Instagram' },
  { valor: 'facebook', texto: 'Facebook' },
]

const FILTRO_ESTADO = [
  { valor: 'todas', texto: 'Todos los estados' },
  { valor: 'publicado', texto: 'Publicadas' },
  { valor: 'esperando_aprobacion', texto: 'Esperando aprobación' },
  { valor: 'fallido', texto: 'No se pudieron publicar' },
]

/**
 * Estadísticas de publicaciones en Instagram y Facebook (Fase 4).
 * Mismo componente para los tres roles: Django recorta lo que cada uno ve
 * (cliente: lo suyo; marketero: sus clientes; superadmin: todo).
 * Todo lo de la página corresponde al año elegido (por defecto, el actual).
 */
export default function PublicationsStatsPage() {
  const { getRole } = useAuth()
  const rol = getRole() || 'cliente'
  const [params, setParams] = useSearchParams()
  const [resumen, setResumen] = useState(null)
  const [publicaciones, setPublicaciones] = useState([])
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [actualizando, setActualizando] = useState(false)
  const [red, setRed] = useState('todas')
  const [estado, setEstado] = useState('todas')
  const [anio, setAnio] = useState(() => new Date().getFullYear())

  const abierta = Number(params.get('publicacion')) || null

  useEffect(() => {
    let vigente = true
    Promise.all([socialApi.resumen(anio), socialApi.publicacionesDelAnio(anio)])
      .then(([r, lista]) => {
        if (!vigente) return
        setResumen(r)
        setPublicaciones(lista)
        setError(null)
      })
      .catch(() => vigente && setError('No se pudieron cargar las estadísticas.'))
    return () => {
      vigente = false
    }
  }, [recarga, anio])

  async function actualizarMetricas() {
    setActualizando(true)
    try {
      const { actualizadas } = await socialApi.actualizarMetricas()
      toast.success(
        actualizadas === 0
          ? 'No hay publicaciones para actualizar'
          : `Métricas al día (${actualizadas} ${actualizadas === 1 ? 'publicación' : 'publicaciones'})`,
      )
      setRecarga((n) => n + 1)
    } catch {
      toast.error('No se pudieron actualizar las métricas')
    } finally {
      setActualizando(false)
    }
  }

  const abrir = (id) => setParams({ publicacion: String(id) })
  const cerrarDetalle = useCallback(() => setParams({}), [setParams])

  // Al leer una publicación en el detalle, su fila muestra la cifra recién traída de Meta.
  const alActualizarDetalle = useCallback((p) => {
    setPublicaciones((lista) => lista.map((x) => (x.id === p.id ? { ...x, ...p } : x)))
  }, [])

  const visibles = useMemo(() => filtrarPublicaciones(publicaciones, { red, estado }), [publicaciones, red, estado])
  const cargando = !resumen && !error
  // Al cambiar de año se deja la vista anterior atenuada hasta que llegan los datos nuevos.
  const cambiandoAnio = Boolean(resumen) && resumen.anual?.anio !== anio
  const anios = resumen?.anual?.anios?.includes(anio) ? resumen.anual.anios : [anio, ...(resumen?.anual?.anios ?? [])]
  const conCliente = rol !== 'cliente'
  const conMarketero = rol === 'superadmin'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-balance text-on-surface">Estadísticas</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            {alcanceDelRol(rol)} Las cifras vienen de Meta y pueden tardar hasta 48 horas en aparecer.
          </p>
          {resumen && <LineaDeEstado resumen={resumen} />}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            Año
            <span className="relative">
              <select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="appearance-none rounded-full border border-outline-variant bg-white py-2 pr-10 pl-4 text-sm font-semibold text-on-surface tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              />
            </span>
          </label>
          <Button variant="outline" onClick={actualizarMetricas} disabled={actualizando || cargando}>
            <RefreshCw className={`h-4 w-4 ${actualizando ? 'animate-spin' : ''}`} />
            {actualizando ? 'Actualizando…' : 'Actualizar métricas'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setRecarga((n) => n + 1)} className="font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}

      {cargando && <Esqueleto />}

      {resumen && (
        <div
          aria-busy={cambiandoAnio}
          className={`space-y-8 transition-opacity duration-200 ${cambiandoAnio ? 'opacity-50' : ''}`}
        >
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-label={`Resumen por red en ${resumen.anual.anio}`}>
            {['instagram', 'facebook'].map((r) => (
              <NetworkPanel
                key={r}
                red={r}
                datos={resumen.redes[r]}
                anual={resumen.anual}
                anio={resumen.anual.anio}
                puedeConectar={rol !== 'superadmin'}
              />
            ))}
          </section>

          <section aria-labelledby="publicaciones-titulo" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="publicaciones-titulo" className="text-2xl font-semibold text-on-surface">
                Publicaciones de {resumen.anual.anio}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-full border border-outline-variant bg-white p-1" role="group" aria-label="Filtrar por red">
                  {FILTRO_RED.map((f) => (
                    <button
                      key={f.valor}
                      onClick={() => setRed(f.valor)}
                      aria-pressed={red === f.valor}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        red === f.valor
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                      }`}
                    >
                      {f.texto}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    aria-label="Filtrar por estado"
                    className="appearance-none rounded-full border border-outline-variant bg-white py-2 pr-10 pl-4 text-sm text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {FILTRO_ESTADO.map((f) => (
                      <option key={f.valor} value={f.valor}>
                        {f.texto}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  />
                </div>
              </div>
            </div>

            {publicaciones.length === 0 ? (
              <SinPublicaciones rol={rol} anio={resumen.anual.anio} />
            ) : visibles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant bg-white/50 px-6 py-10 text-center text-sm text-on-surface-variant">
                Ninguna publicación coincide con estos filtros.
              </p>
            ) : (
              <TablaPublicaciones
                publicaciones={visibles}
                red={red}
                conCliente={conCliente}
                conMarketero={conMarketero}
                onAbrir={abrir}
              />
            )}
          </section>
        </div>
      )}

      <AnimatePresence>
        {abierta && (
          <PublicationStatsDrawer
            key={abierta}
            publicacionId={abierta}
            onClose={cerrarDetalle}
            onActualizada={alActualizarDetalle}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function LineaDeEstado({ resumen }) {
  const partes = [
    [resumen.total_publicaciones, 'publicada', 'publicadas', 'text-on-surface'],
    [resumen.pendientes, 'esperando aprobación', 'esperando aprobación', 'text-on-surface'],
    [resumen.fallidas, 'no se pudo publicar', 'no se pudieron publicar', resumen.fallidas ? 'text-error' : 'text-on-surface'],
  ]
  return (
    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
      {partes.map(([n, uno, varios, color]) => (
        <span key={uno}>
          <strong className={`font-semibold tabular-nums ${color}`}>{n}</strong> {n === 1 ? uno : varios}
        </span>
      ))}
    </p>
  )
}

function TablaPublicaciones({ publicaciones, red, conCliente, conMarketero, onAbrir }) {
  // Facebook llama "reacciones" a lo que Instagram llama "me gusta".
  const encabezadoMeGusta = red === 'todas' ? 'Me gusta / reacciones' : metricasDeRed(red).principales[0][1]
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-container-low text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">Publicación</th>
              {conCliente && <th className="px-4 py-3">Cliente</th>}
              {conMarketero && <th className="px-4 py-3">Marketero</th>}
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right whitespace-normal">{encabezadoMeGusta}</th>
              <th className="px-4 py-3 text-right">Comentarios</th>
              <th className="px-4 py-3 text-right">Compartidos</th>
              <th className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {publicaciones.map((p) => {
              const m = p.ultima_metrica
              const [meGusta] = metricasDeRed(p.red).principales
              return (
                <tr
                  key={p.id}
                  onClick={() => onAbrir(p.id)}
                  className="cursor-pointer border-t border-outline-variant/40 transition-colors hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <RedIcon red={p.red} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="max-w-60 truncate font-semibold text-on-surface">{p.campaign_titulo}</p>
                        <p className="text-xs text-on-surface-variant">
                          {p.cuenta_nombre}
                          {p.publicado_at && ` · ${new Date(p.publicado_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  {conCliente && <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{p.cliente_nombre}</td>}
                  {conMarketero && <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{p.marketero_nombre}</td>}
                  <td className="px-4 py-3">
                    <PublicationBadge estado={p.estado} />
                    {p.version_aprobada != null && (
                      <p className="mt-1 text-xs whitespace-nowrap text-on-surface-variant">
                        Versión {p.version_aprobada} aprobada
                      </p>
                    )}
                  </td>
                  <CeldaMetrica valor={m?.me_gusta} titulo={meGusta[1]} hayLectura={Boolean(m)} />
                  <CeldaMetrica valor={m?.comentarios} hayLectura={Boolean(m)} />
                  <CeldaMetrica valor={m?.compartidos} hayLectura={Boolean(m)} />
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrir(p.id)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold whitespace-nowrap text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Ver estadísticas
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        — todavía no se leyeron métricas · sin dato: Meta no informa esa cifra
      </p>
    </div>
  )
}

/** Sin lectura todavía se deja en blanco; con lectura, lo que Meta no informó es "sin dato". */
function CeldaMetrica({ valor, titulo, hayLectura }) {
  const sinDato = valor === null || valor === undefined
  return (
    <td
      title={titulo}
      className={`px-4 py-3 text-right tabular-nums ${sinDato ? 'text-xs text-on-surface-variant' : 'font-semibold text-on-surface'}`}
    >
      {hayLectura ? (
        formatoMetrica(valor)
      ) : (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">sin lectura todavía</span>
        </>
      )}
    </td>
  )
}

const VACIO = {
  cliente: 'Cuando apruebes una campaña con destino en tus redes, aquí verás cómo le va.',
  marketero: 'Cuando un cliente apruebe una campaña con destino, su publicación y sus métricas aparecerán aquí.',
  superadmin: 'Todavía no hay publicaciones en la plataforma.',
}

function SinPublicaciones({ rol, anio }) {
  const esteAnio = Number(anio) === new Date().getFullYear()
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-white/50 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-outline">
        <ChartColumnIncreasing className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-on-surface">
        {esteAnio ? 'Aún no hay publicaciones' : `No hubo publicaciones en ${anio}`}
      </h3>
      {esteAnio && <p className="max-w-sm text-sm text-on-surface-variant">{VACIO[rol] ?? VACIO.cliente}</p>}
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-3xl border border-outline-variant bg-white" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl border border-outline-variant bg-white" />
    </div>
  )
}
