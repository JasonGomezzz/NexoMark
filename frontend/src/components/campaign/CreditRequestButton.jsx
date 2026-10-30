import { useEffect, useState } from 'react'
import { HandCoins } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { resumenSolicitud } from '@/services/creditRequests'

/**
 * Pedir créditos al superadmin (solo marketero): POST /api/auth/credit-requests/.
 * Muestra el estado de la última solicitud; con una pendiente no deja enviar otra.
 * Para otros roles no se muestra nada (el backend respondería 403).
 */
export default function CreditRequestButton({ className = '' }) {
  const esMarketero = localStorage.getItem('user_role') === 'marketero'
  const [ultima, setUltima] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(esMarketero)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!esMarketero) return undefined
    let activo = true
    api
      .get('/api/auth/credit-requests/')
      .then(({ data }) => {
        if (activo) setUltima(data.data?.solicitudes?.[0] ?? null)
      })
      .catch(() => {
        if (activo) setAviso('No se pudo consultar tu última solicitud.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [esMarketero])

  if (!esMarketero) return null

  const pendiente = ultima?.estado === 'pendiente'

  async function enviar(event) {
    event.preventDefault()
    setEnviando(true)
    setAviso('')
    try {
      const { data } = await api.post('/api/auth/credit-requests/', { motivo: motivo.trim() })
      setUltima(data.data.solicitud)
      setAviso(data.message)
      setAbierto(false)
      setMotivo('')
    } catch (err) {
      setAviso(err.response?.data?.message || 'No se pudo enviar la solicitud. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {abierto && !pendiente ? (
        <form onSubmit={enviar} className="space-y-2">
          <label htmlFor="motivo-creditos" className="block text-sm font-medium text-on-surface-variant">
            ¿Para qué los necesitas? <span className="font-normal">(opcional)</span>
          </label>
          <textarea
            id="motivo-creditos"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Ej.: campaña de aniversario para tres clientes"
            className="w-full resize-none rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cargando || pendiente}
          onClick={() => setAbierto(true)}
        >
          <HandCoins className="h-4 w-4" />
          {pendiente ? 'Solicitud pendiente' : 'Pedir créditos al administrador'}
        </Button>
      )}
      <p role="status" className="text-[13px] text-on-surface-variant">
        {aviso || resumenSolicitud(ultima)}
      </p>
    </div>
  )
}
