import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Planchas, PiezasSelladas } from '../components/social/PlanchasRedes'
import PublicationBadge from '../components/social/PublicationBadge'
import PublicationStatsDrawer from '../components/social/PublicationStatsDrawer'
import RedIcon from '../components/social/RedIcon'
import { useAuth } from '../hooks/useAuth'
import {
  alcanceDelRol,
  filtrarPublicaciones,
  formatoMetrica,
  metricasDeRed,
  mostrarTikTok,
  mostrarX,
} from '../services/social'
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
  const [xConfig, setXConfig] = useState(null)
  const [tiktokConfig, setTiktokConfig] = useState(null)

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

  // X y TikTok son opcionales: si el servidor no responde, simplemente no se muestran.
  useEffect(() => {
    let vigente = true
    socialApi
      .xConfig()
      .then((c) => vigente && setXConfig(c))
      .catch(() => {})
    socialApi
      .tiktokConfig()
      .then((c) => vigente && setTiktokConfig(c))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

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
  // Si el año nuevo no cargó, se deja de atenuar y se dice de qué año son los datos de abajo.
  const atenuar = cambiandoAnio && !error
  const anios = resumen?.anual?.anios?.includes(anio) ? resumen.anual.anios : [anio, ...(resumen?.anual?.anios ?? [])]
  const conCliente = rol !== 'cliente'
  const conX = mostrarX({ xConfig, resumen, publicaciones })
  const conTikTok = mostrarTikTok({ tiktokConfig, resumen, publicaciones })
  const redesPanel = ['instagram', 'facebook', ...(conX ? ['x'] : []), ...(conTikTok ? ['tiktok'] : [])]
  const filtrosRed = [
    ...FILTRO_RED,
    ...(conX ? [{ valor: 'x', texto: 'X' }] : []),
    ...(conTikTok ? [{ valor: 'tiktok', texto: 'TikTok' }] : []),
  ]
  const filtrosEstado = conTikTok
    ? [...FILTRO_ESTADO, { valor: 'en_buzon', texto: 'En el buzón de TikTok' }]
    : FILTRO_ESTADO
  const conMarketero = rol === 'superadmin'

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[13px] text-on-surface-variant">Informe del año</p>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.025em] text-on-surface sm:text-[40px]">Métricas de {anio}</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-on-surface-variant">
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
                className="h-11 appearance-none rounded-[10px] border border-outline bg-surface-container-lowest pr-10 pl-4 text-sm font-semibold text-on-surface tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {cambiandoAnio
            ? `No se pudieron cargar las estadísticas de ${anio}. Abajo siguen las de ${resumen.anual.anio}.`
            : error}
          <button onClick={() => setRecarga((n) => n + 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}

      {cargando && <Esqueleto />}

      {resumen && (
        <div
          aria-busy={atenuar}
          className={`space-y-8 transition-opacity duration-200 ${atenuar ? 'opacity-50' : ''}`}
        >
          <section aria-labelledby="planchas-titulo">
            <h2 id="planchas-titulo" className="text-2xl font-extrabold text-on-surface">
              Una plancha por red
            </h2>
            <p className="mb-5 mt-1 text-[15px] text-on-surface-variant">Totales de {resumen.anual.anio} con la última lectura de cada publicación.</p>
            <Planchas redes={redesPanel} resumen={resumen} puedeConectar={rol !== 'superadmin'} />
          </section>

          <PiezasSelladas publicaciones={publicaciones} rol={rol} onAbrir={abrir} />

          <section aria-labelledby="publicaciones-titulo" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="publicaciones-titulo" className="text-2xl font-extrabold text-on-surface">
                Cada publicación de {resumen.anual.anio}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex max-w-full flex-wrap gap-1 rounded-[12px] border border-outline-variant p-1" role="group" aria-label="Filtrar por red">
                  {filtrosRed.map((f) => (
                    <button
                      key={f.valor}
                      onClick={() => setRed(f.valor)}
                      aria-pressed={red === f.valor}
                      className={`min-h-10 shrink-0 rounded-[8px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                    className="h-11 appearance-none rounded-[10px] border border-outline bg-surface-container-lowest pr-10 pl-4 text-sm text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {filtrosEstado.map((f) => (
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
              <p className="border-y border-hairline py-6 text-[15px] text-on-surface-variant">
                Ninguna publicación coincide con estos filtros. Prueba con «Todas».
              </p>
            ) : (
              <TablaPublicaciones
                publicaciones={visibles}
                red={red}
                conCliente={conCliente}
                conMarketero={conMarketero}
                conX={conX}
                conTikTok={conTikTok}
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

function TablaPublicaciones({ publicaciones, red, conCliente, conMarketero, conX, conTikTok, onAbrir }) {
  // Facebook llama "reacciones" a lo que Instagram llama "me gusta"; X no tiene lectura.
  const encabezadoMeGusta =
    red === 'todas' || red === 'x' || red === 'tiktok' ? 'Me gusta / reacciones' : metricasDeRed(red).principales[0][1]
  return (
    <div>
      {/* Móvil: lista con estado y cifras a la vista */}
      <ul className="divide-y divide-hairline border-y border-hairline md:hidden">
        {publicaciones.map((p) => {
          const m = p.ultima_metrica
          const hayLectura = Boolean(m) || p.red === 'tiktok'
          const [meGusta = ['me_gusta', 'Me gusta']] = metricasDeRed(p.red).principales
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full items-start gap-3 py-4 text-left">
                <RedIcon red={p.red} className="mt-0.5 h-8 w-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-on-surface">{p.campaign_titulo}</span>
                  <span className="block text-[13px] text-on-surface-variant">
                    {p.cuenta_nombre}
                    {conCliente && p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <PublicationBadge estado={p.estado} red={p.red} />
                    {hayLectura && (
                      <span className="text-[13px] tabular-nums text-on-surface">
                        {formatoMetrica(m?.me_gusta)} {meGusta[1].toLowerCase()} · {formatoMetrica(m?.comentarios)} comentarios
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto border-y border-outline-variant md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-container-low text-left text-[13px] font-semibold whitespace-nowrap text-on-surface-variant">
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
              const [meGusta = ['me_gusta', 'Me gusta']] = metricasDeRed(p.red).principales
              return (
                <tr
                  key={p.id}
                  onClick={() => onAbrir(p.id)}
                  className="cursor-pointer border-t border-hairline transition-colors hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <RedIcon red={p.red} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="max-w-60 truncate font-semibold text-on-surface">{p.campaign_titulo}</p>
                        <p className="text-[13px] text-on-surface-variant">
                          {p.cuenta_nombre}
                          {p.publicado_at && ` · ${new Date(p.publicado_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  {conCliente && <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{p.cliente_nombre}</td>}
                  {conMarketero && <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{p.marketero_nombre}</td>}
                  <td className="px-4 py-3">
                    <PublicationBadge estado={p.estado} red={p.red} />
                    {p.version_aprobada != null && (
                      <p className="mt-1 text-[13px] whitespace-nowrap text-on-surface-variant">
                        Versión {p.version_aprobada} aprobada
                      </p>
                    )}
                  </td>
                  {/* TikTok nunca entrega métricas: "sin dato" en vez de "todavía no se leyeron". */}
                  <CeldaMetrica valor={m?.me_gusta} titulo={meGusta[1]} hayLectura={Boolean(m) || p.red === 'tiktok'} />
                  <CeldaMetrica valor={m?.comentarios} hayLectura={Boolean(m) || p.red === 'tiktok'} />
                  <CeldaMetrica valor={m?.compartidos} hayLectura={Boolean(m) || p.red === 'tiktok'} />
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrir(p.id)
                      }}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-primary hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      <p className="mt-3 text-[13px] text-on-surface-variant">
        — todavía no se leyeron métricas{conX && ' (en X no se leen para no generar costo)'} · sin dato: la red no
        informa esa cifra{conTikTok && ' (TikTok no entrega métricas con los permisos actuales)'}
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
      className={`px-4 py-3 text-right tabular-nums ${sinDato ? 'text-[13px] text-on-surface-variant' : 'font-semibold text-on-surface'}`}
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
    <div className="border-y border-hairline py-6">
      <h3 className="text-lg font-extrabold text-on-surface">
        {esteAnio ? 'Aún no hay publicaciones' : `No hubo publicaciones en ${anio}`}
      </h3>
      {esteAnio && <p className="mt-1 max-w-md text-[15px] text-on-surface-variant">{VACIO[rol] ?? VACIO.cliente}</p>}
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-[14px] bg-surface-container-high" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-[14px] bg-surface-container-high" />
    </div>
  )
}
