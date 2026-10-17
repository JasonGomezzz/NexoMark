import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import { socialApi } from '../../services/socialApi'

/**
 * Aviso para el cliente: versiones para X de campañas ya aprobadas que esperan
 * su revisión. No se muestra si X está apagada o si no hay ninguna pendiente.
 */
export default function XPendientesCliente() {
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState([])

  useEffect(() => {
    let vigente = true
    socialApi
      .xConfig()
      .then(async (config) => {
        if (!config.habilitado || !vigente) return
        const lista = await socialApi.variantesX({ estado: 'pendiente_cliente' })
        if (vigente) setPendientes(lista)
      })
      .catch(() => vigente && setPendientes([]))
    return () => {
      vigente = false
    }
  }, [])

  if (!pendientes.length) return null

  return (
    <section aria-labelledby="x-pendientes" className="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
      <h2 id="x-pendientes" className="mb-1 flex items-center gap-2 text-base font-semibold text-on-surface">
        <RedIcon red="x" className="h-4 w-4 text-on-surface" />
        {pendientes.length === 1 ? 'Una versión para X espera tu aprobación' : `${pendientes.length} versiones para X esperan tu aprobación`}
      </h2>
      <p className="mb-3 text-sm text-on-surface-variant">
        Son textos cortos de campañas que ya aprobaste. Nada se publica en X sin tu visto bueno.
      </p>
      <ul className="space-y-2">
        {pendientes.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">{v.campaign_titulo}</span>
            <Button size="sm" onClick={() => navigate(`/review/${v.campaign}`)}>
              Revisar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
