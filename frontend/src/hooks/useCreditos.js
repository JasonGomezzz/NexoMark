import { useEffect, useState } from 'react'
import api from '../services/api'
import { GENERATION_CREDIT_COST } from '@/lib/credits'

/**
 * Saldo de créditos y costo por generación, sin caché (GET /api/auth/me/).
 * Se refresca cuando una página dispara 'credits-updated'. Mientras carga,
 * `saldo` es null y `costo` usa el respaldo de lib/credits.js.
 */
export default function useCreditos() {
  const [estado, setEstado] = useState({ saldo: null, costo: GENERATION_CREDIT_COST })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const refrescar = () => setTick((t) => t + 1)
    window.addEventListener('credits-updated', refrescar)
    return () => window.removeEventListener('credits-updated', refrescar)
  }, [])

  useEffect(() => {
    let cancelado = false
    api
      .get('/api/auth/me/')
      .then(({ data }) => {
        const user = data?.data?.user
        if (cancelado || !user) return
        const costo = Number.isInteger(user.costo_generacion) && user.costo_generacion > 0
          ? user.costo_generacion
          : GENERATION_CREDIT_COST
        setEstado({ saldo: user.tokens_disponibles ?? null, costo })
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [tick])

  return estado
}
