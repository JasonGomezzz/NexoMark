import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RedIcon from './RedIcon'
import SelloConforme from '@/components/SelloConforme'
import api from '../../services/api'
import { etiquetaRed, formatoMetrica, haceCuanto, indiceMesActual, metricasDeRed, serieAnual } from '../../services/social'
import { cn } from '@/lib/utils'

/**
 * Métricas como planchas de imprenta (dirección "Conforme"): una por red, lado
 * a lado. Cifras grandes del año, filas finas con el resto de métricas y barras
 * de 12 meses (me gusta o reacciones; en TikTok y X, publicaciones).
 * - Lo que la red no informó dice «sin dato», nunca 0.
 * - Mes sin publicaciones: raya en la base. Mes que aún no llega: nada.
 * - Red sin publicaciones en el año: no se dibujan barras vacías.
 * Las barras son CSS (alto en %) y llevan su tabla para lector de pantalla.
 */
const COLOR = {
  instagram: 'var(--color-chart-instagram)',
  facebook: 'var(--color-chart-facebook)',
  x: 'var(--color-chart-x)',
  tiktok: 'var(--color-chart-tiktok)',
}
const COMPACTO = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 })

function BarrasMes({ serie, anio, color, titulo }) {
  const mesActual = indiceMesActual(anio)
  const valores = serie.map((m) => m.total)
  const max = Math.max(1, ...valores.filter((v) => typeof v === 'number'))
  const pico = valores.reduce((iMax, v, i) => (typeof v === 'number' && v > (valores[iMax] ?? -1) ? i : iMax), 0)
  return (
    <figure className="mt-1">
      <figcaption className="mb-2 text-[13px] text-on-surface-variant">{titulo}</figcaption>
      <div className="mt-6 flex h-24 items-end gap-[3px] border-b border-outline-variant" aria-hidden="true">
        {serie.map((m, i) => {
          const futuro = mesActual !== -1 && i > mesActual
          const v = m.total
          return (
            <div key={m.mes} className="relative flex h-full flex-1 flex-col items-center justify-end">
              {!futuro && typeof v === 'number' && v > 0 ? (
                <>
                  {i === pico && (
                    <span className="absolute -top-0.5 text-[12px] font-semibold tabular-nums text-on-surface" style={{ bottom: `calc(${(v / max) * 100}% + 2px)`, top: 'auto' }}>
                      {COMPACTO.format(v)}
                    </span>
                  )}
                  <span className="w-[62%] max-w-3 rounded-t-[3px]" style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: color }} />
                </>
              ) : !futuro ? (
                <span className="mb-0.5 h-[2px] w-[62%] max-w-3 rounded-full bg-outline" />
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-center text-[12px] text-on-surface-variant" aria-hidden="true">
        {serie.map((m, i) => (
          <span key={m.mes} className={cn('flex-1', i === mesActual && 'font-bold text-on-surface')}>
            {m.etiqueta.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>
          {serie.map((m, i) => (
            <tr key={m.mes}>
              <th scope="row">{m.nombreMes}</th>
              <td>{mesActual !== -1 && i > mesActual ? 'aún no llega' : formatoMetrica(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function Planchas({ redes, resumen, puedeConectar }) {
  const anio = resumen.anual.anio
  return (
    <div className="grid border-y border-outline-variant md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      {redes.map((red, i) => {
        const datos = resumen.redes[red] ?? {}
        const { principales, secundarias, sinLectura, motivoSinLectura } = metricasDeRed(red)
        const total = datos.publicaciones ?? 0
        const [campoGrande, etiquetaGrande] = principales[0] ?? []
        const filas = [...principales.slice(1), ...secundarias]
        const serie = sinLectura ? serieAnual(resumen.anual, red, 'publicaciones') : serieAnual(resumen.anual, red, 'me_gusta')
        return (
          <section
            key={red}
            aria-labelledby={`plancha-${red}`}
            className={cn('min-w-0 py-6 md:pr-7', i > 0 && 'border-t border-hairline md:border-l md:border-t-0 md:pl-7')}
          >
            <h3 id={`plancha-${red}`} className="flex items-center gap-3 font-display text-xl font-bold text-on-surface">
              <RedIcon red={red} className="h-10 w-10 rounded-[10px]" />
              {etiquetaRed(red)}
            </h3>
            <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
              <div>
                <dt className="text-[13px] text-on-surface-variant">{red === 'tiktok' ? 'Enviadas al buzón' : 'Publicaciones'}</dt>
                <dd className="cifra mt-1 text-[44px] tabular-nums text-on-surface">{total}</dd>
              </div>
              {!sinLectura && campoGrande && (
                <div>
                  <dt className="text-[13px] text-on-surface-variant">{etiquetaGrande}</dt>
                  <dd className={cn('cifra mt-1 tabular-nums', datos[campoGrande] == null ? 'text-[22px] text-on-surface-variant' : 'text-[44px] text-on-surface')}>
                    {formatoMetrica(datos[campoGrande])}
                  </dd>
                </div>
              )}
            </dl>
            {total === 0 ? (
              <p className="mt-4 text-sm text-on-surface-variant">
                Aún no hay publicaciones en {etiquetaRed(red)} en {anio}.{' '}
                {puedeConectar && (
                  <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
                    Revisar redes conectadas
                  </Link>
                )}
              </p>
            ) : sinLectura ? (
              <p className="mt-4 text-sm text-on-surface-variant">{motivoSinLectura}</p>
            ) : (
              <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
                {filas.map(([campo, etiqueta]) => (
                  <div key={campo} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <dt className="text-on-surface-variant">{etiqueta}</dt>
                    <dd className={datos[campo] == null ? 'text-on-surface-variant' : 'font-semibold tabular-nums text-on-surface'}>{formatoMetrica(datos[campo])}</dd>
                  </div>
                ))}
              </dl>
            )}
            {total > 0 && (
            <div className="mt-5">
              <BarrasMes
                serie={serie}
                anio={anio}
                color={COLOR[red]}
                titulo={sinLectura ? (red === 'tiktok' ? 'Enviadas por mes' : 'Publicaciones por mes') : `${etiquetaGrande} por mes`}
              />
            </div>
            )}
            {total > 0 && datos.metricas_al && <p className="mt-3 text-[13px] text-on-surface-variant">Leídas de Meta {haceCuanto(datos.metricas_al)}</p>}
          </section>
        )
      })}
    </div>
  )
}

/** Miniatura de la campaña (solo personal: el cliente no usa la API de campañas de Django). */
function Miniatura({ campaignId, red, permitida }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!permitida || !campaignId) return undefined
    let vigente = true
    let objeto = null
    api
      .get(`/api/campaigns/${campaignId}/miniatura/`, { responseType: 'blob' })
      .then(({ data }) => {
        if (!vigente) return
        objeto = URL.createObjectURL(data)
        setUrl(objeto)
      })
      .catch(() => {})
    return () => {
      vigente = false
      if (objeto) URL.revokeObjectURL(objeto)
    }
  }, [campaignId, permitida])
  if (url) return <img src={url} alt="" className="h-28 w-28 rounded-[12px] object-cover" />
  return (
    <span className="grid h-28 w-28 place-items-center rounded-[12px] bg-surface-container-high">
      <RedIcon red={red} className="h-10 w-10 rounded-[10px]" />
    </span>
  )
}

/** Lo publicado, con su sello: cada pieza salió tal como el cliente la aprobó. */
export function PiezasSelladas({ publicaciones, rol, onAbrir }) {
  const publicadas = publicaciones.filter((p) => p.estado === 'publicado').slice(0, 6)
  if (!publicadas.length) return null
  return (
    <section aria-labelledby="sellados-titulo">
      <h2 id="sellados-titulo" className="text-2xl font-extrabold text-on-surface">
        Lo publicado, con su sello
      </h2>
      <p className="mt-1 text-[15px] text-on-surface-variant">Cada pieza salió tal como el cliente la aprobó. El sello dice qué versión.</p>
      <ul className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {publicadas.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onAbrir(p.id)} className="group grid w-full grid-cols-[112px_1fr] items-center gap-5 rounded-[12px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <span className="relative">
                <Miniatura campaignId={p.campaign} red={p.red} permitida={rol !== 'cliente'} />
                <SelloConforme version={p.version_aprobada} tamano={56} className="absolute -bottom-3 -right-4" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 font-display text-base font-bold leading-snug text-on-surface group-hover:text-primary">{p.campaign_titulo}</span>
                <span className="mt-1 block text-[13px] text-on-surface-variant">
                  {p.cuenta_nombre} · {etiquetaRed(p.red)}
                  {p.publicado_at ? ` · ${new Date(p.publicado_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}` : ''}
                </span>
                <span className="mt-1.5 block text-[13px] font-semibold tabular-nums text-on-surface">
                  {p.ultima_metrica
                    ? `${formatoMetrica(p.ultima_metrica.me_gusta)} ${metricasDeRed(p.red).principales[0]?.[1]?.toLowerCase() ?? 'me gusta'} · ${formatoMetrica(p.ultima_metrica.comentarios)} comentarios`
                    : 'Métricas todavía sin leer'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
