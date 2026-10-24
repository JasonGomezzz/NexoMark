// Formato de la medición voz vs. formulario. Lo que no se midió es "sin dato", nunca 0.

const sinDato = (v) => v === null || v === undefined

export function formatoSegundos(s) {
  if (sinDato(s)) return 'sin dato'
  if (s < 60) return `${s.toFixed(1).replace(/\.0$/, '').replace('.', ',')} s`
  const m = Math.floor(s / 60)
  return `${m} min ${Math.round(s % 60)} s`
}

export function formatoTasa(t) {
  return sinDato(t) ? 'sin dato' : `${Math.round(t * 100)} %`
}

export function formatoNumero(v, sufijo = '') {
  return sinDato(v) ? 'sin dato' : `${String(v).replace('.', ',')}${sufijo}`
}

export { sinDato }
