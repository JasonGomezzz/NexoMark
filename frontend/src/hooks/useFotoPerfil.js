import { useEffect, useSyncExternalStore } from 'react'
import { cuentaApi } from '../services/cuentaApi'
import { claveFoto } from '../services/cuenta'
import { SESSION_CHANGED, getAuthItem } from '../services/session'

/**
 * Foto de perfil compartida por Configuración y el menú lateral. La imagen se
 * pide con el JWT (GET /api/auth/me/avatar/), así que se guarda como object URL
 * en memoria: una sola descarga por versión, y al subir o quitar la foto en
 * Configuración el menú cambia en el acto.
 */
let actual = { id: null, clave: null, url: null }
let enCurso = null
const oyentes = new Set()

function emitir(siguiente) {
  if (actual.url && actual.url !== siguiente.url) URL.revokeObjectURL(actual.url)
  actual = siguiente
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

const leer = () => actual

// Al cerrar sesión (o entrar con otra cuenta) la foto anterior no debe quedar a la vista.
if (typeof window !== 'undefined') {
  window.addEventListener(SESSION_CHANGED, () => {
    if (!getAuthItem('access_token')) {
      enCurso = null
      emitir({ id: null, clave: null, url: null })
    }
  })
}

/**
 * Pone al día la foto con los datos de /me/ (has_avatar y avatar_version).
 * `forzar` vuelve a descargarla aunque la versión parezca la misma (dos subidas en el mismo segundo).
 */
export async function sincronizarFoto(usuario, { forzar = false } = {}) {
  const clave = claveFoto(usuario)
  if (!usuario?.id) return
  if (clave === null) {
    enCurso = null
    if (actual.id !== usuario.id || actual.clave !== null) emitir({ id: usuario.id, clave: null, url: null })
    return
  }
  if (!forzar && ((actual.clave === clave && actual.id === usuario.id) || enCurso === clave)) return
  enCurso = clave
  try {
    const blob = await cuentaApi.foto()
    if (enCurso !== clave) return
    emitir({ id: usuario.id, clave, url: blob ? URL.createObjectURL(blob) : null })
  } catch {
    // Sin foto se muestran las iniciales; se reintenta en la próxima sincronización.
  } finally {
    if (enCurso === clave) enCurso = null
  }
}

/**
 * URL de la foto del usuario (o null para mostrar sus iniciales). Pasar el
 * usuario de /me/; si otra pantalla ya cargó una versión más nueva, se usa esa.
 */
export function useFotoPerfil(usuario) {
  const estado = useSyncExternalStore(suscribir, leer, leer)
  const clave = claveFoto(usuario)
  const id = usuario?.id

  useEffect(() => {
    if (id) sincronizarFoto({ id, has_avatar: clave !== null, avatar_version: clave?.split(':')[1] })
  }, [id, clave])

  return estado.id === id ? estado.url : null
}
