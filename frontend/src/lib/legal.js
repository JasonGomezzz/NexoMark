/**
 * Documentos legales de NexoMark: fuente única de los enlaces del frontend.
 *
 * Los textos viven en `legal-site/` (HTML) y se copian a `public/legal/` con
 * `npm run legal:sync`; la web los sirve en /legal/. Son archivos estáticos, no
 * rutas de React: se enlazan con <a>, no con <Link>. Un test comprueba que cada
 * documento exista en la copia y que la copia coincida con `legal-site/`.
 */
export const RUTA_LEGAL = '/legal'

export const DOCUMENTOS_LEGALES = [
  { clave: 'terminos', titulo: 'Términos de servicio', archivo: 'terminos.html' },
  { clave: 'privacidad', titulo: 'Política de privacidad', archivo: 'privacidad.html' },
  { clave: 'cookies', titulo: 'Cookies y almacenamiento', archivo: 'cookies.html' },
  { clave: 'compras', titulo: 'Condiciones de compra', archivo: 'compras.html' },
  { clave: 'arrepentimiento', titulo: 'Arrepentimiento de compra', archivo: 'arrepentimiento.html' },
  { clave: 'reclamos', titulo: 'Reclamos y atención', archivo: 'reclamos.html' },
  { clave: 'responsables', titulo: 'Responsables', archivo: 'responsables.html' },
  { clave: 'eliminacion', titulo: 'Eliminación de datos', archivo: 'eliminacion-datos.html' },
]

const POR_CLAVE = new Map(DOCUMENTOS_LEGALES.map((documento) => [documento.clave, documento]))

export function documentoLegal(clave) {
  const documento = POR_CLAVE.get(clave)
  if (!documento) throw new Error(`Documento legal desconocido: ${clave}`)
  return documento
}

export function urlLegal(clave) {
  return `${RUTA_LEGAL}/${documentoLegal(clave).archivo}`
}
