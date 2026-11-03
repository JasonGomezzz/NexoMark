import { useEffect } from 'react'
import { getCampaignById } from '../services/clientCampaigns'
import { connectClientCampaignSocket } from '../services/clientCampaignSocket'
import { clearSession, getAuthItem, refreshAccessToken, SESSION_CHANGED } from '../services/session'

function getWsUrl() {
  const url = new URL(import.meta.env.VITE_USER_API_URL || 'http://localhost:8080', window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/client-campaigns'
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Notifications contain IDs only. Campaign contents always come from the authorized API. */
export function useClientCampaignSocket({ onCampaignSubmitted, onCampaignStatusChanged, onConnected } = {}) {
  useEffect(() => {
    if (typeof WebSocket === 'undefined') return undefined
    let cancelled = false
    let generation = 0
    let accessToken = getAuthItem('access_token')
    let disconnect = () => {}
    // Renovación pedida por el propio socket (tras un 4401/4408): la conexión actual
    // ya reintenta con el token nuevo y su espera creciente. Si aquí se creara otra,
    // se perdería la guarda del segundo 4401 y Spring podría forzar renovaciones sin fin.
    let renovandoDesdeSocket = false
    const renovar = async (token) => {
      renovandoDesdeSocket = true
      try {
        return await refreshAccessToken(token)
      } finally {
        renovandoDesdeSocket = false
      }
    }

    function connect() {
      const currentGeneration = ++generation
      return connectClientCampaignSocket({
        url: getWsUrl(),
        getToken: () => getAuthItem('access_token'),
        refreshToken: renovar,
        endSession: clearSession,
        onConnected,
        onNotification: async ({ type, campaignId }) => {
          try {
            const campaign = await getCampaignById(campaignId)
            if (cancelled || currentGeneration !== generation || !getAuthItem('access_token')) return
            if (type === 'campaign_submitted') onCampaignSubmitted?.(campaign)
            else onCampaignStatusChanged?.(campaign)
          } catch {
            // Deleted/reassigned campaign or failed connection: keep the REST retry controls.
          }
        },
      })
    }

    const sessionChanged = () => {
      const current = getAuthItem('access_token')
      if (accessToken === current) return
      accessToken = current
      if (renovandoDesdeSocket && current) return
      generation++
      disconnect()
      if (current) disconnect = connect()
    }
    disconnect = connect()
    window.addEventListener(SESSION_CHANGED, sessionChanged)
    window.addEventListener('storage', sessionChanged)
    return () => {
      cancelled = true
      generation++
      window.removeEventListener(SESSION_CHANGED, sessionChanged)
      window.removeEventListener('storage', sessionChanged)
      disconnect()
    }
  }, [onCampaignSubmitted, onCampaignStatusChanged, onConnected])
}
