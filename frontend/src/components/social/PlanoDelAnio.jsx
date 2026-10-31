import { Inbox } from 'lucide-react'
import RedIcon from './RedIcon'
import { etiquetaRed, formatoMetrica, indiceMesActual, metricasDeRed, serieAnual } from '../../services/social'
import { cn } from '@/lib/utils'

/**
 * El año en la línea (estación Medir): una línea por red, con su color, y
 * cada mes como una estación. El número dentro dice cuántas publicaciones
 * hubo; debajo, los me gusta (o reacciones) de esas publicaciones.
 * - Mes sin publicaciones: estación hueca (es un 0 real: se cuentan).
 * - Mes que aún no llega: tramo gris fino, sin estación.
 * - Me gusta que la red no informó: no se dibuja (el detalle dice «sin dato»).
 * Cada estación es un botón que elige el mes del detalle. En móvil las líneas
 * van en vertical. La tabla `sr-only` es la versión para lector de pantalla.
 */
const COLOR = {
  instagram: 'var(--color-chart-instagram)',
  facebook: 'var(--color-chart-facebook)',
  x: 'var(--color-chart-x)',
  tiktok: 'var(--color-chart-tiktok)',
}

// Etiquetas del plano en formato compacto ("1,2 M"): la cifra exacta está en el
// detalle por red y en la tabla para lector de pantalla.
const COMPACTO = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 })
const compacto = (v) => (v === null || v === undefined ? 'sin dato' : COMPACTO.format(v))
// En la columna angosta del móvil, sin decimales ("1 M") para que quepa sin cortarse.
const COMPACTO_MOVIL = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 0 })

function tamano(n) {
  if (n >= 3) return 'h-[38px] w-[38px]'
  if (n === 2) return 'h-8 w-8'
  return 'h-[26px] w-[26px]'
}

function Estacion({ pubs, futuro, seleccionada, onClick, etiqueta, color }) {
  if (futuro) return <span aria-hidden="true" className="h-2 w-2 rounded-full bg-outline-variant" />
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={seleccionada}
      className="relative z-10 grid h-11 w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
    >
      <span
        className={cn(
          'grid place-items-center rounded-full bg-background font-display font-extrabold tabular-nums text-on-surface',
          pubs ? `${tamano(pubs)} border-4 text-[13px]` : 'h-3 w-3 border-[3px]',
        )}
        style={{ borderColor: color }}
      >
        {pubs ? (pubs > 99 ? COMPACTO.format(pubs) : pubs) : null}
      </span>
    </button>
  )
}

export default function PlanoDelAnio({ redes, anual, anio, mesElegido, onElegirMes }) {
  const mesActual = indiceMesActual(anio)
  const filas = redes.map((red) => {
    const pubs = serieAnual(anual, red, 'publicaciones')
    const likes = serieAnual(anual, red, 'me_gusta')
    const sinLectura = metricasDeRed(red).sinLectura
    return { red, pubs, likes, sinLectura, color: COLOR[red] }
  })
  const meses = filas[0]?.pubs ?? []
  const esFuturo = (i) => mesActual !== -1 && i > mesActual
  const etiquetaDe = (fila, i) => {
    const p = fila.pubs[i]
    const l = fila.likes[i]?.total
    const n = p?.total ?? 0
    const nombreLikes = metricasDeRed(fila.red).principales[0]?.[1]?.toLowerCase() ?? 'me gusta'
    return `${etiquetaRed(fila.red)}, ${p?.nombreMes}: ${n} ${n === 1 ? 'publicación' : 'publicaciones'}${
      n && !fila.sinLectura ? `, ${formatoMetrica(l)} ${nombreLikes}` : ''
    }. Ver el detalle de ${p?.nombreMes}`
  }

  return (
    <div>
      {/* Escritorio: líneas horizontales */}
      <div className="hidden md:block" aria-hidden="false">
        <div className="grid grid-cols-[220px_minmax(0,1fr)_120px] items-end gap-5 border-b border-hairline pb-2 text-[13px] text-on-surface-variant">
          <span>Red</span>
          <div className="grid grid-cols-12 text-center">
            {meses.map((m, i) => (
              <span key={m.mes} className={cn(i === mesElegido && 'font-bold text-on-surface')}>
                {m.etiqueta}
              </span>
            ))}
          </div>
          <span className="text-right">Total del año</span>
        </div>
        {filas.map((fila) => (
          <div key={fila.red} className="grid grid-cols-[220px_minmax(0,1fr)_120px] items-center gap-5 border-b border-hairline py-4">
            <div className="flex min-w-0 items-center gap-3">
              <RedIcon red={fila.red} className="h-10 w-10 shrink-0 rounded-[10px]" />
              <div className="min-w-0">
                <p className="font-display text-lg font-extrabold leading-tight text-on-surface">{etiquetaRed(fila.red)}</p>
                {fila.sinLectura && (
                  <p className="flex items-center gap-1 text-[13px] text-on-surface-variant">
                    <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {fila.red === 'tiktok' ? 'No entrega métricas' : 'Solo se cuentan'}
                  </p>
                )}
              </div>
            </div>
            <div className="relative grid h-[72px] grid-cols-12 items-center">
              {/* Vía de la red: color hasta el mes actual; después, tramo gris */}
              <span
                aria-hidden="true"
                className="absolute left-[calc(100%/24)] top-[22px] h-1.5 -translate-y-1/2 rounded-full"
                style={{ background: fila.color, right: mesActual === -1 ? 'calc(100% / 24)' : `calc(100% / 12 * ${11 - mesActual} + 100% / 24)` }}
              />
              {mesActual !== -1 && mesActual < 11 && (
                <span
                  aria-hidden="true"
                  className="absolute right-[calc(100%/24)] top-[22px] h-0.5 -translate-y-1/2 bg-outline-variant"
                  style={{ left: `calc(100% / 12 * ${mesActual} + 100% / 24)` }}
                />
              )}
              {fila.pubs.map((m, i) => {
                const like = fila.likes[i]?.total
                return (
                  <div key={m.mes} className={cn('relative flex h-full flex-col items-center pt-0', i === mesElegido && 'rounded-xl bg-primary-fixed/70')}>
                    <Estacion
                      pubs={m.total}
                      futuro={esFuturo(i)}
                      seleccionada={i === mesElegido}
                      onClick={() => onElegirMes(i)}
                      etiqueta={etiquetaDe(fila, i)}
                      color={fila.color}
                    />
                    {m.total > 0 && !esFuturo(i) && !fila.sinLectura && like != null && (
                      <span aria-hidden="true" className="mt-0.5 text-[12px] font-semibold tabular-nums text-on-surface-variant">
                        {compacto(like)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <TotalAnio fila={fila} />
          </div>
        ))}
      </div>

      {/* Móvil: la misma línea girada, mes a mes hacia abajo */}
      <div className="md:hidden">
        <div className="grid border-b border-hairline" style={{ gridTemplateColumns: `44px repeat(${filas.length}, minmax(0, 1fr))` }}>
          <span />
          {filas.map((fila) => (
            <div key={fila.red} className="flex flex-col items-center gap-1.5 py-3 text-center">
              <RedIcon red={fila.red} className="h-7 w-7 rounded-lg" />
              <span className="font-display text-[13px] font-extrabold leading-tight text-on-surface">{etiquetaRed(fila.red)}</span>
              <span className="text-[13px] tabular-nums text-on-surface-variant">
                {fila.pubs.reduce((t, m) => t + (m.total || 0), 0)} publ.
              </span>
            </div>
          ))}
        </div>
        {meses.map((m, i) => (
          <div
            key={m.mes}
            className={cn('grid', i === mesElegido && 'rounded-xl bg-primary-fixed/70')}
            style={{ gridTemplateColumns: `44px repeat(${filas.length}, minmax(0, 1fr))` }}
          >
            <span className={cn('flex h-12 items-center text-[13px]', i === mesElegido ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>
              {m.etiqueta}
            </span>
            {filas.map((fila) => {
              const p = fila.pubs[i]
              const like = fila.likes[i]?.total
              const futuro = esFuturo(i)
              return (
                <div key={fila.red} className="relative flex h-12 items-center justify-center">
                  <span
                    aria-hidden="true"
                    className={cn('absolute inset-y-0 left-1/2 -translate-x-1/2', futuro ? 'w-0.5 bg-outline-variant' : 'w-[5px]')}
                    style={futuro ? undefined : { background: fila.color }}
                  />
                  <Estacion
                    pubs={p.total}
                    futuro={futuro}
                    seleccionada={i === mesElegido}
                    onClick={() => onElegirMes(i)}
                    etiqueta={etiquetaDe(fila, i)}
                    color={fila.color}
                  />
                  {p.total > 0 && !futuro && !fila.sinLectura && like != null && (
                    <span aria-hidden="true" className="absolute left-[calc(50%+20px)] whitespace-nowrap text-[12px] font-semibold tabular-nums text-on-surface-variant">
                      {COMPACTO_MOVIL.format(like)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-on-surface-variant">
        <span>El número es cuántas publicaciones hubo ese mes; debajo, sus me gusta o reacciones.</span>
        <span>Estación hueca: sin publicaciones. Tramo gris: meses que aún no llegan.</span>
      </p>

      {/* Versión en tabla para lector de pantalla */}
      <table className="sr-only">
        <caption>Publicaciones por mes y por red en {anio}</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            {filas.map((f) => (
              <th key={f.red} scope="col">
                {etiquetaRed(f.red)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meses.map((m, i) => (
            <tr key={m.mes}>
              <th scope="row">{m.nombreMes}</th>
              {filas.map((f) => (
                <td key={f.red}>
                  {esFuturo(i)
                    ? 'aún no llega'
                    : `${f.pubs[i].total} publicaciones${f.sinLectura || !f.pubs[i].total ? '' : `, ${formatoMetrica(f.likes[i]?.total)} me gusta`}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TotalAnio({ fila }) {
  const total = fila.pubs.reduce((t, m) => t + (m.total || 0), 0)
  const conDato = fila.likes.filter((l) => l.total != null)
  const likes = conDato.length ? conDato.reduce((t, l) => t + l.total, 0) : null
  const nombre = metricasDeRed(fila.red).principales[0]?.[1]?.toLowerCase()
  return (
    <div className="text-right">
      <p className="cifra text-[28px] tabular-nums text-on-surface">{total}</p>
      <p className="text-[13px] text-on-surface-variant">{fila.red === 'tiktok' ? 'enviadas al buzón' : total === 1 ? 'publicación' : 'publicaciones'}</p>
      {!fila.sinLectura && total > 0 && (
        <p className="mt-1 font-display text-[15px] font-bold tabular-nums text-on-surface">
          {formatoMetrica(likes)} <span className="font-sans text-[13px] font-normal text-on-surface-variant">{nombre}</span>
        </p>
      )}
    </div>
  )
}
