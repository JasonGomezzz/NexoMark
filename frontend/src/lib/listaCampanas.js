const ENTERO = new Intl.NumberFormat('es-PE')

/**
 * Subtítulo de «Todas las campañas». Mientras carga o si la carga falló devuelve null:
 * así el 0 inicial (o el total de otro paso) no se muestra como si fuera el real.
 */
export function totalDeCampanas({ cargando, error, count }) {
  if (cargando || error) return null
  if (count === 0) return 'Todavía no hay campañas.'
  return `${ENTERO.format(count)} ${count === 1 ? 'campaña' : 'campañas'} en total.`
}
