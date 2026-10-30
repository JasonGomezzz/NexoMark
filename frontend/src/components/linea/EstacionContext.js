import { createContext, useContext, useEffect } from 'react'

/**
 * Permite que una página afine la estación actual de la línea cuando la ruta
 * no basta (por ejemplo, el detalle de una campaña está en la estación de su
 * estado). El marco (AppLayout) provee el setter.
 */
export const EstacionContext = createContext(() => {})

export function useEstacionPagina(estacion) {
  const fijar = useContext(EstacionContext)
  useEffect(() => {
    fijar(estacion ?? null)
    return () => fijar(null)
  }, [estacion, fijar])
}
