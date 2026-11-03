/**
 * Versión cuyo copy coincide con el de la campaña (la más reciente si hay varias). Si el
 * copy se editó a mano y no coincide con ninguna, la "actual" es ese copy sin número.
 */
export function versionVigente(versions, textoActual = '') {
  const texto = textoActual || ''
  const vista = texto.slice(0, 200) + (texto.length > 200 ? '…' : '')
  return (
    versions.find((v) => (v.texto_preview ?? '') === vista) ??
    (versions.length ? { id: 'actual', version_number: null, texto_preview: vista, tiene_imagen: false } : null)
  )
}
