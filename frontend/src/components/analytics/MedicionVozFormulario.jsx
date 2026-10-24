import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Mic, Keyboard } from 'lucide-react'
import api from '../../services/api'
import { Button } from '@/components/ui/button'
import { formatoNumero, formatoSegundos, formatoTasa, sinDato } from './medicionFormato'

const CAMPO_LABEL = {
  titulo: 'Título',
  cliente_nombre: 'Cliente',
  cliente_email: 'Correo',
  industria: 'Industria',
  tono: 'Tono',
  plataforma: 'Red',
  prompt: 'Instrucciones',
}

// Dos series: identidad (voz / formulario), no estado. Turquesa = la pieza que
// avanza (voz, lo nuevo); marino-gris = el camino de siempre (formulario).
const COLOR = { voz: 'var(--color-primary)', formulario: 'var(--color-secondary)' }

const FILAS = [
  { clave: 'intenciones', label: 'Briefs interpretados', fmt: (v) => formatoNumero(v) },
  { clave: 'tasa_finalizacion', label: 'Terminan en campaña', fmt: formatoTasa },
  { clave: 'captura_mediana_s', label: 'Tiempo para dictar o escribir (mediana)', fmt: formatoSegundos },
  { clave: 'revision_mediana_s', label: 'Tiempo revisando los campos (mediana)', fmt: formatoSegundos },
  { clave: 'total_mediana_s', label: 'Tiempo total hasta confirmar (mediana)', fmt: formatoSegundos },
  { clave: 'campos_corregidos_promedio', label: 'Campos corregidos por campaña', fmt: (v) => formatoNumero(v) },
  { clave: 'campos_vacios_ia_promedio', label: 'Campos que la IA no encontró', fmt: (v) => formatoNumero(v) },
  { clave: 'palabras_mediana', label: 'Palabras del brief (mediana)', fmt: (v) => formatoNumero(v) },
]

/**
 * Voz contra formulario (medición de la tesis). Los dos caminos pasan por la
 * misma intención, así que se comparan con las mismas métricas. Lo que no
 * existe se escribe "sin dato", nunca 0. Datos de GET /api/intents/medicion/.
 */
export default function MedicionVozFormulario() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    let vivo = true
    api
      .get('/api/intents/medicion/')
      .then(({ data }) => vivo && setDatos(data.data))
      .catch(() => vivo && setError('No se pudo cargar la medición.'))
    return () => {
      vivo = false
    }
  }, [])

  async function descargar() {
    setDescargando(true)
    try {
      const { data } = await api.get('/api/intents/medicion/', { params: { formato: 'csv' }, responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'medicion-voz-formulario.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar el CSV.')
    } finally {
      setDescargando(false)
    }
  }

  const voz = datos?.voz
  const form = datos?.formulario
  const correcciones =
    datos?.campos?.map((c) => ({
      campo: CAMPO_LABEL[c] ?? c,
      voz: voz?.correcciones_por_campo?.[c] ?? null,
      formulario: form?.correcciones_por_campo?.[c] ?? null,
    })) ?? []
  const hayConfirmadas = correcciones.some((f) => f.voz !== null || f.formulario !== null)
  const hayCorrecciones = correcciones.some((f) => (f.voz ?? 0) > 0 || (f.formulario ?? 0) > 0)

  return (
    <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm" aria-labelledby="medicion-titulo">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="medicion-titulo" className="text-xl font-semibold text-on-surface">
            Voz contra formulario
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Mismo flujo, dos formas de contar la campaña: dictándola o escribiéndola. Los tiempos son medianas; lo que
            todavía no se midió aparece como «sin dato».
          </p>
        </div>
        <Button type="button" variant="outline" onClick={descargar} disabled={descargando || !datos}>
          <Download className="h-4 w-4" />
          {descargando ? 'Descargando…' : 'Descargar CSV'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-error">
          {error}
        </p>
      )}

      {!datos && !error && <div className="h-48 animate-pulse rounded-lg bg-surface-container-high" />}

      {datos && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Métricas de voz y de formulario</caption>
              <thead>
                <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Métrica
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Mic className="h-4 w-4 text-primary" aria-hidden="true" /> Voz
                    </span>
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Keyboard className="h-4 w-4 text-secondary" aria-hidden="true" /> Formulario
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map((f) => (
                  <tr key={f.clave} className="border-b border-outline-variant/60 last:border-0">
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal text-on-surface-variant">
                      {f.label}
                    </th>
                    {[voz, form].map((grupo, i) => {
                      const valor = grupo?.[f.clave]
                      return (
                        <td
                          key={i}
                          className={`py-2.5 pr-4 tabular-nums ${sinDato(valor) ? 'text-on-surface-variant' : 'font-semibold text-on-surface'}`}
                        >
                          {f.fmt(valor)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Voz: {formatoNumero(voz?.captura_con_dato)} con tiempo de captura medido · Formulario:{' '}
            {formatoNumero(form?.captura_con_dato)}. Los briefs anteriores al 24/10 no tienen ese tiempo.
          </p>

          <h3 className="mb-2 mt-6 text-base font-semibold text-on-surface">Qué campos corrigió la persona</h3>
          {hayCorrecciones ? (
            <div className="h-64" role="img" aria-label="Correcciones por campo, voz y formulario">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={correcciones} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" strokeOpacity={0.6} />
                  <XAxis dataKey="campo" tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-surface-container)' }}
                    formatter={(v, nombre) => [v === null ? 'sin dato' : v, nombre === 'voz' ? 'Voz' : 'Formulario']}
                  />
                  <Legend formatter={(v) => (v === 'voz' ? 'Voz' : 'Formulario')} />
                  <Bar dataKey="voz" fill={COLOR.voz} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="formulario" fill={COLOR.formulario} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              {hayConfirmadas
                ? 'En las campañas confirmadas nadie cambió lo que propuso la IA.'
                : 'Sin dato: todavía no hay campañas confirmadas.'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
