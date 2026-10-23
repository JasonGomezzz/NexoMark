/** Llamadas de la cuenta propia a /api/auth/ de Django (foto de perfil). */
import api from './api'

const usuario = (r) => r.data.data.user

export const cuentaApi = {
  perfil: () => api.get('/api/auth/me/').then(usuario),

  /**
   * Sube la foto (multipart). El tipo de contenido se declara aquí para que axios
   * no convierta el FormData a JSON; el navegador agrega el boundary.
   */
  subirFoto: (archivo) => {
    const datos = new FormData()
    datos.append('avatar', archivo)
    return api.patch('/api/auth/me/', datos, { headers: { 'Content-Type': 'multipart/form-data' } }).then(usuario)
  },
  quitarFoto: () => api.patch('/api/auth/me/', { remove_avatar: true }).then(usuario),
  /** JPEG 256 × 256 del propio usuario, o null si no tiene foto (204). */
  foto: () =>
    api
      .get('/api/auth/me/avatar/', { responseType: 'blob' })
      .then((r) => (r.status === 200 && r.data?.size > 0 ? r.data : null)),
}
