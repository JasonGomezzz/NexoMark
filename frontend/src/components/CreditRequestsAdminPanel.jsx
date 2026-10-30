import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertCircle, Check, HandCoins, X } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import {
  CREDITOS_SUGERIDOS,
  MAX_CREDITOS,
  etiquetaEstado,
  validarCreditos,
} from '@/services/creditRequests'

const FILTROS = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: '', texto: 'Todas' },
]

const ESTADO_CHIP = {
  pendiente: 'bg-secondary-container text-primary',
  aprobada: 'bg-success-container text-success',
  rechazada: 'bg-error-container text-error',
}

function fecha(valor) {
  return valor
    ? new Date(valor).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'
}

/**
 * Solicitudes de créditos para el SuperAdmin (GET/PATCH /api/admin/credit-requests/).
 * Aprobar suma la cantidad indicada al saldo actual; rechazar no lo cambia.
 * Cada decisión queda registrada con quién y cuándo. No es un pago.
 */
export default function CreditRequestsAdminPanel({ onResolved }) {
  const [filtro, setFiltro] = useState('pendiente')
  const [solicitudes, setSolicitudes] = useState([])
  const [pendientes, setPendientes] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [montos, setMontos] = useState({})
  const [notas, setNotas] = useState({})
  const [ocupado, setOcupado] = useState(null)

  const cargar = useCallback(() => {
    return api
      .get('/api/admin/credit-requests/', { params: filtro ? { estado: filtro } : {} })
      .then(({ data }) => {
        setSolicitudes(data.data?.solicitudes ?? [])
        setPendientes(data.data?.pendientes ?? 0)
        setError('')
      })
      .catch(() => setError('No se pudieron cargar las solicitudes de créditos.'))
      .finally(() => setCargando(false))
  }, [filtro])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function resolver(solicitud, estado) {
    const body = { estado, nota: (notas[solicitud.id] ?? '').trim() }
    if (estado === 'aprobada') {
      const valor = montos[solicitud.id] ?? String(CREDITOS_SUGERIDOS)
      const problema = validarCreditos(valor)
      if (problema) {
        toast.error(problema)
        return
      }
      body.creditos = Number(valor)
    }
    setOcupado(solicitud.id)
    try {
      const { data } = await api.patch(`/api/admin/credit-requests/${solicitud.id}/`, body)
      toast.success(data.message)
      await cargar()
      onResolved?.()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'No se pudo resolver la solicitud.')
      await cargar()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section
      aria-labelledby="solicitudes-creditos"
      className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-6 py-4">
        <div className="flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-primary" />
          <h2 id="solicitudes-creditos" className="text-lg font-semibold text-on-surface">
            Solicitudes de créditos
          </h2>
          {pendientes > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[13px] font-bold tabular-nums text-on-primary">
              {pendientes}
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-container-low p-1" role="group" aria-label="Filtrar solicitudes">
          {FILTROS.map((f) => (
            <button
              key={f.texto}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => {
                setCargando(true)
                setFiltro(f.valor)
              }}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                filtro === f.valor ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      <p className="px-6 pt-3 text-[13px] text-on-surface-variant">
        Aprobar suma los créditos al saldo actual; rechazar no lo modifica. Queda registrado quién decidió y cuándo.
      </p>

      {cargando ? (
        <div className="space-y-2 px-6 py-4">
          <div className="h-14 animate-pulse rounded-lg bg-surface-container-high" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-container-high" />
        </div>
      ) : error ? (
        <div className="m-6 flex items-center gap-2 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button type="button" className="font-semibold underline" onClick={() => { setCargando(true); cargar() }}>
            Reintentar
          </button>
        </div>
      ) : solicitudes.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-on-surface-variant">
          {filtro === 'pendiente' ? 'No hay solicitudes pendientes.' : 'Aún no hay solicitudes.'}
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/60">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-on-surface">
                  {s.solicitante_nombre}{' '}
                  <span className="font-normal text-on-surface-variant">· {s.solicitante_email}</span>
                </p>
                <p className="text-[13px] text-on-surface-variant">
                  {fecha(s.fecha_creacion)} · saldo actual{' '}
                  <span className="tabular-nums">{s.saldo_actual}</span>
                </p>
                {s.motivo && <p className="break-words text-sm text-on-surface">“{s.motivo}”</p>}
                {s.estado !== 'pendiente' && (
                  <p className="text-[13px] text-on-surface-variant">
                    <span className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${ESTADO_CHIP[s.estado] ?? ''}`}>
                      {etiquetaEstado(s.estado)}
                    </span>
                    {s.estado === 'aprobada' && `+${s.creditos_otorgados} créditos (saldo ${s.saldo_resultante}) · `}
                    {s.resuelta_por ?? '—'} · {fecha(s.resuelta_en)}
                    {s.nota_resolucion && ` · ${s.nota_resolucion}`}
                  </p>
                )}
              </div>

              {s.estado === 'pendiente' && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[13px] font-medium text-on-surface-variant">
                    Créditos
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={MAX_CREDITOS}
                      step="1"
                      value={montos[s.id] ?? String(CREDITOS_SUGERIDOS)}
                      onChange={(e) => setMontos({ ...montos, [s.id]: e.target.value })}
                      className="mt-1 block w-24 rounded-lg border border-outline-variant px-2 py-1.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="text-[13px] font-medium text-on-surface-variant">
                    Nota (opcional)
                    <input
                      type="text"
                      maxLength={300}
                      value={notas[s.id] ?? ''}
                      onChange={(e) => setNotas({ ...notas, [s.id]: e.target.value })}
                      className="mt-1 block w-44 rounded-lg border border-outline-variant px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <Button size="sm" disabled={ocupado !== null} onClick={() => resolver(s, 'aprobada')}>
                    <Check className="h-4 w-4" />
                    {ocupado === s.id ? 'Guardando…' : 'Aprobar'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={ocupado !== null} onClick={() => resolver(s, 'rechazada')}>
                    <X className="h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
