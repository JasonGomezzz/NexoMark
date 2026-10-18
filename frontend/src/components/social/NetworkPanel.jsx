import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import instagramLogo from '@/assets/social/instagram.png'
import facebookLogo from '@/assets/social/facebook.png'
import RedIcon from './RedIcon'
import { etiquetaRed, formatoMetrica, haceCuanto, indiceMesActual, metricasDeRed, serieAnual } from '../../services/social'

const LOGOS = { instagram: instagramLogo, facebook: facebookLogo }

/**
 * Tarjeta del dashboard por red para el año elegido: logo grande, totales de la última
 * lectura de cada publicación y, mes a mes, publicaciones y me gusta (o reacciones).
 * Lo que Meta no informó se muestra "sin dato", nunca como cero.
 */
export default function NetworkPanel({ red, datos, anual, anio, puedeConectar }) {
  const nombre = etiquetaRed(red)
  const { principales, secundarias, sinLectura } = metricasDeRed(red)
  const total = datos?.publicaciones ?? 0
  const mesActual = indiceMesActual(anio)
  const esteAnio = mesActual !== -1
  const nombreMeGusta = principales[0]?.[1]

  return (
    <article className="flex flex-col rounded-3xl border border-outline-variant bg-white p-6 shadow-sm sm:p-8">
      <header className="flex items-center gap-4">
        {LOGOS[red] ? (
          <img src={LOGOS[red]} alt="" aria-hidden="true" className="h-14 w-14 rounded-2xl shadow-md" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-on-surface text-surface shadow-md">
            <RedIcon red={red} className="h-7 w-7" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-on-surface">{nombre}</h2>
          <p className="text-sm text-on-surface-variant">
            {total === 1 ? '1 publicación' : `${total} publicaciones`} en {anio}
            {total > 0 && esteAnio && ` · ${datos.publicaciones_mes} este mes`}
          </p>
        </div>
      </header>

      {total === 0 ? (
        <div className="mt-6 flex flex-1 flex-col justify-center rounded-2xl bg-surface-container-low px-6 py-8">
          {esteAnio ? (
            <>
              <p className="font-semibold text-on-surface">Aún no hay publicaciones en {nombre} este año</p>
              <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
                {sinLectura
                  ? `Aparecen aquí cuando el marketero publica la versión para ${nombre} que aprobó el cliente.`
                  : `Aparecen aquí cuando el cliente aprueba una campaña que tiene ${nombre} como destino.`}
              </p>
              {puedeConectar && (
                <Link to="/settings" className="mt-3 text-sm font-semibold text-primary hover:underline">
                  Revisar redes conectadas
                </Link>
              )}
            </>
          ) : (
            <p className="font-semibold text-on-surface">No hubo publicaciones en {nombre} en {anio}</p>
          )}
        </div>
      ) : sinLectura ? (
        <>
          <p className="mt-6 rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
            En {nombre} solo se cuentan las publicaciones: leer sus métricas cuesta en la API de pago por uso,
            así que NexoMark no las consulta.
          </p>
          <BarrasMensuales
            titulo="Publicaciones por mes"
            anio={anio}
            mesActual={mesActual}
            serie={serieAnual(anual, red, 'publicaciones')}
            describir={(m) => `${m.total} ${m.total === 1 ? 'publicación' : 'publicaciones'}`}
          />
        </>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-4">
            {principales.map(([campo, etiqueta]) => (
              <Cifra key={campo} etiqueta={etiqueta} valor={datos[campo]} grande />
            ))}
          </dl>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-outline-variant/60 pt-5">
            {secundarias.map(([campo, etiqueta]) => (
              <Cifra key={campo} etiqueta={etiqueta} valor={datos[campo]} />
            ))}
          </dl>
          <BarrasMensuales
            titulo="Publicaciones por mes"
            anio={anio}
            mesActual={mesActual}
            serie={serieAnual(anual, red, 'publicaciones')}
            describir={(m) => `${m.total} ${m.total === 1 ? 'publicación' : 'publicaciones'}`}
          />
          <BarrasMensuales
            titulo={`${nombreMeGusta} por mes`}
            anio={anio}
            mesActual={mesActual}
            serie={serieAnual(anual, red, 'me_gusta')}
            describir={(m) => describirMeGusta(m, nombreMeGusta.toLowerCase())}
            nota="Suma de la última lectura de cada publicación, según el mes en que salió. —: Meta no informó la cifra."
          />
          <p className="mt-5 text-xs text-on-surface-variant">
            {datos.con_metricas === 0
              ? 'Meta todavía no entregó métricas de estas publicaciones.'
              : `Totales de ${datos.con_metricas} de ${total} ${total === 1 ? 'publicación' : 'publicaciones'}` +
                ` · leídos de Meta ${haceCuanto(datos.metricas_al)}`}
          </p>
        </>
      )}
    </article>
  )
}

function describirMeGusta(m, unidad) {
  if (!m.publicaciones) return 'sin publicaciones'
  const publicaciones = m.publicaciones === 1 ? '1 publicación' : `${m.publicaciones} publicaciones`
  if (m.total === null) return `sin dato de Meta (${publicaciones})`
  return `${formatoMetrica(m.total)} ${unidad} · ${m.conDato} de ${publicaciones} con dato`
}

function Cifra({ etiqueta, valor, grande = false }) {
  const sinDato = valor === null || valor === undefined
  return (
    <div className="min-w-0">
      <dt className="text-sm text-on-surface-variant">{etiqueta}</dt>
      <dd
        className={
          sinDato
            ? `mt-1 font-medium text-on-surface-variant ${grande ? 'text-base leading-10' : 'text-sm'}`
            : `mt-1 font-bold tabular-nums text-on-surface ${grande ? 'text-4xl tracking-tight' : 'text-base'}`
        }
      >
        {formatoMetrica(valor)}
      </dd>
    </div>
  )
}

/**
 * Doce columnas de un año. Una sola serie: el título dice qué se mide, sin leyenda.
 * Solo se rotulan el mes en curso y el máximo; el resto, al pasar el cursor. Para
 * lectores de pantalla, la misma serie va en una tabla oculta.
 * Columna vacía = 0 (o sin publicaciones); "—" = hubo publicaciones pero Meta no dio la cifra.
 */
function BarrasMensuales({ titulo, anio, mesActual, serie, describir, nota }) {
  const [activo, setActivo] = useState(null)
  const idTitulo = useId()
  const valores = serie.map((m) => m.total ?? 0)
  const mayor = Math.max(0, ...valores)
  const escala = Math.max(1, mayor)
  // Un 0 medido en el mes en curso también se rotula: sin rótulo parecería un mes vacío.
  const medido = (m) => m.total !== null && (m.total > 0 || m.conDato > 0)
  const rotulados = new Set([mesActual, mayor > 0 ? valores.indexOf(mayor) : -1].filter((i) => i >= 0 && medido(serie[i])))
  const sinDato = (m) => m.total === null && m.publicaciones > 0

  return (
    <figure className="mt-8" aria-labelledby={idTitulo}>
      <figcaption id={idTitulo} className="text-sm font-medium text-on-surface">
        {titulo} · {anio}
      </figcaption>
      <div className="relative mt-3" aria-hidden="true" onMouseLeave={() => setActivo(null)}>
        {activo !== null && (
          <div
            className={`pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg bg-on-surface px-2.5 py-1.5 text-xs whitespace-nowrap text-surface shadow-md ${
              activo < 3 ? '' : activo > 8 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${((activo + (activo < 3 ? 0 : activo > 8 ? 1 : 0.5)) / serie.length) * 100}%` }}
          >
            <span className="font-semibold capitalize">{serie[activo].nombreMes}</span>: {describir(serie[activo])}
          </div>
        )}
        <div className="flex h-28 items-end gap-1 border-b border-outline-variant">
          {serie.map((m, i) => (
            <div
              key={m.mes}
              onMouseEnter={() => setActivo(i)}
              className={`flex h-full flex-1 flex-col items-center justify-end rounded-t-md transition-colors ${
                activo === i ? 'bg-surface-container-low' : ''
              }`}
            >
              {rotulados.has(i) && (
                <span className="mb-1 text-xs font-semibold tabular-nums text-on-surface-variant">
                  {formatoMetrica(m.total)}
                </span>
              )}
              {valores[i] > 0 ? (
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-primary"
                  style={{ height: `${Math.max(6, (valores[i] / escala) * 78)}%` }}
                />
              ) : (
                sinDato(m) && <span className="mb-0.5 text-xs text-on-surface-variant">—</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          {serie.map((m, i) => (
            <span
              key={m.mes}
              className={`flex-1 text-center text-[11px] sm:text-xs ${
                i === mesActual ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {m.etiqueta}
            </span>
          ))}
        </div>
      </div>
      {nota && <p className="mt-2 text-xs text-on-surface-variant">{nota}</p>}
      <table className="sr-only">
        <caption>
          {titulo} en {anio}
        </caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((m) => (
            <tr key={m.mes}>
              <th scope="row">{m.nombreMes}</th>
              <td>{describir(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
