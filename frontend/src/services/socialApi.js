/** Llamadas a /api/social/ de Django. */
import api from './api'

export const socialApi = {
  conexiones: () => api.get('/api/social/connections/').then((r) => r.data.data.conexiones),
  destinos: (clienteEmail) =>
    api
      .get('/api/social/connections/destinos/', { params: { cliente_email: clienteEmail } })
      .then((r) => r.data.data.conexiones),
  urlConexion: () => api.get('/api/social/meta/connect/').then((r) => r.data.data.url),
  /** Termina la conexión con la sesión del usuario: Django comprueba que el state sea suyo y canjea el código. */
  completarConexionMeta: (code, state) =>
    api.post('/api/social/meta/complete/', { code, state }).then((r) => r.data.data),
  desconectar: (id) => api.delete(`/api/social/connections/${id}/`),
  publicaciones: (campaignId) =>
    api
      .get('/api/social/publications/', { params: campaignId ? { campaign: campaignId } : {} })
      .then((r) => r.data.data.publicaciones),
  /** Historial del dashboard: publicaciones del año (por fecha de publicación o, si no salió, de creación). */
  publicacionesDelAnio: (anio) =>
    api.get('/api/social/publications/', { params: { anio } }).then((r) => r.data.data.publicaciones),
  publicar: (id) => api.post(`/api/social/publications/${id}/publish/`),
  resumen: (anio) =>
    api.get('/api/social/publications/summary/', { params: anio ? { anio } : {} }).then((r) => r.data.data),
  estadisticas: (id) =>
    api.get(`/api/social/publications/${id}/stats/`, { params: { refresh: 1 } }).then((r) => r.data.data),
  actualizarMetricas: () => api.post('/api/social/publications/refresh/').then((r) => r.data.data),
}
