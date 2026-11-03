import { useState, useCallback } from 'react'
import api from '../services/api'
import { clearSession, getAuthItem, logoutOnServer, setAuthItem, startSession } from '../services/session'

export function useAuth() {
  const [loading, setLoading] = useState(false)

  /** `remember`: true guarda la sesión en este navegador; false, solo en esta pestaña. */
  const login = useCallback(async (email, password, { remember = false } = {}) => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/token/', { email, password })
      startSession(data, { remember })
      const me = await api.get('/api/auth/me/')
      const user = me.data?.data?.user
      if (user?.email) setAuthItem('user_email', user.email)
      return { ok: true, role: data.role }
    } catch (err) {
      clearSession({ redirect: false })
      const status = err.response?.status
      const message = err.response?.data?.message
      return { ok: false, status, message }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutOnServer(api)
    } catch {
      // ignore — clear session regardless
    } finally {
      clearSession({ redirect: false })
    }
  }, [])

  const isAuthenticated = () => Boolean(getAuthItem('access_token'))

  const getRole = () => getAuthItem('user_role')

  const getNombre = () => getAuthItem('user_nombre')

  const getEmail = () => getAuthItem('user_email')

  return { login, logout, isAuthenticated, getRole, getNombre, getEmail, loading }
}
