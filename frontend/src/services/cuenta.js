/**
 * Cuenta del usuario: foto de perfil. Lógica pura (sin React
 * ni axios) para probarla en tests/cuenta.test.js. Las llamadas están en cuentaApi.js.
 */

/** Mismos límites que Django (profile_avatar.py): JPG, PNG o WebP de hasta 2 MB. */
export const FOTO_MAX_BYTES = 2 * 1024 * 1024
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp']
export const FOTO_ACEPTA = FOTO_TIPOS.join(',')

/**
 * Revisa la foto antes de subirla. El servidor vuelve a validarla (y la recorta
 * a 256 × 256 sin EXIF); esto solo evita una subida que igual sería rechazada.
 * @returns {string | null} el problema, o null si se puede subir.
 */
export function validarFoto(archivo) {
  if (!archivo) return 'Elige una foto.'
  if (!FOTO_TIPOS.includes(archivo.type)) return 'Usa una imagen JPG, PNG o WebP (no SVG ni GIF).'
  if (archivo.size > FOTO_MAX_BYTES) return 'La foto no debe superar 2 MB.'
  if (archivo.size === 0) return 'Ese archivo está vacío. Elige otra foto.'
  return null
}

/** "1,4 MB" o "380 KB": para decir cuánto pesa la foto elegida. */
export function formatoPeso(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-PE', { maximumFractionDigits: 1 })} MB`
}

/** Iniciales para el avatar sin foto: "Ana Torres" → "AT". */
export function iniciales(nombre) {
  return (
    String(nombre ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase() || 'U'
  )
}

/**
 * Identifica la foto vigente de un usuario. Cambia al subir otra foto
 * (avatar_version) y es null si no tiene: así se sabe cuándo volver a pedirla.
 */
export function claveFoto(usuario) {
  if (!usuario?.id || !usuario.has_avatar) return null
  return `${usuario.id}:${usuario.avatar_version ?? 0}`
}

/** Primer mensaje legible de un error de la API (campo, no_field_errors o el general). */
export function mensajeApi(error, porDefecto = 'No se pudo completar la acción. Intenta de nuevo.') {
  if (!error?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.'
  const cuerpo = error.response.data ?? {}
  const datos = cuerpo.data
  if (datos && typeof datos === 'object') {
    for (const valor of Object.values(datos.errors ?? datos)) {
      if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
    }
  }
  return cuerpo.message || porDefecto
}
