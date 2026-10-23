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

  // ── X (opcional, apagada por defecto): conexión y versión para X ──
  /** {habilitado, costo_post_usd, tope_mensual_usd, gasto_mes_usd, usados_mes, restantes, maximo_mes} */
  xConfig: () => api.get('/api/social/x/config/').then((r) => r.data.data),
  urlConexionX: () => api.get('/api/social/x/connect/').then((r) => r.data.data.url),
  completarConexionX: (code, state) =>
    api.post('/api/social/x/complete/', { code, state }).then((r) => r.data.data),
  /** Cuentas de X del marketero y del cliente de esa campaña. */
  destinosX: (campaignId) =>
    api.get('/api/social/x/destinos/', { params: { campaign: campaignId } }).then((r) => r.data.data.conexiones),
  variantesX: (params) => api.get('/api/social/x-variants/', { params }).then((r) => r.data.data.variantes),
  /** Sin texto la resume la IA (o el recorte determinista en modo simulado); no cobra crédito. */
  crearVarianteX: (campaign, texto) =>
    api.post('/api/social/x-variants/', texto === undefined ? { campaign } : { campaign, texto }).then((r) => r.data),
  editarVarianteX: (id, texto) => api.patch(`/api/social/x-variants/${id}/`, { texto }).then((r) => r.data),
  enviarVarianteX: (id) => api.post(`/api/social/x-variants/${id}/enviar/`).then((r) => r.data),
  /** El cliente devuelve el hash del texto que vio: si cambió entretanto, el servidor no lo aprueba. */
  aprobarVarianteX: (id, hashTexto) =>
    api.post(`/api/social/x-variants/${id}/aprobar/`, { hash_texto: hashTexto }).then((r) => r.data),
  rechazarVarianteX: (id, feedback) =>
    api.post(`/api/social/x-variants/${id}/rechazar/`, { feedback }).then((r) => r.data),
  publicarVarianteX: (id, { conexion, confirmoCosto, confirmoRevision = false }) =>
    api
      .post(`/api/social/x-variants/${id}/publicar/`, {
        conexion,
        confirmo_costo: confirmoCosto,
        confirmo_revision: confirmoRevision,
      })
      .then((r) => r.data),

  // ── TikTok (Sandbox): conectar y enviar campañas aprobadas al buzón; no da métricas ──
  /** {configurado, medios_verificados, max_texto} */
  tiktokConfig: () => api.get('/api/social/tiktok/config/').then((r) => r.data.data),
  urlConexionTikTok: () => api.get('/api/social/tiktok/connect/').then((r) => r.data.data.url),
  completarConexionTikTok: (code, state) =>
    api.post('/api/social/tiktok/complete/', { code, state }).then((r) => r.data.data),
}
