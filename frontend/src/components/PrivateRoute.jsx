import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { RotateCw } from 'lucide-react'
import api from '../services/api'
import { clearSession, getAuthItem, setAuthItem } from '../services/session'
import { ROLES, VerifiedUserContext } from '@/hooks/useVerifiedUser'
import { Button } from '@/components/ui/button'

/**
 * Entrada al panel. Sin token va al login; con token pregunta al servidor
 * quién es el usuario (GET /api/auth/me/) antes de mostrar nada, así el rol que
 * decide las rutas es el del servidor y no el guardado en el navegador.
 * Un 401 lo resuelve el interceptor (renueva o cierra sesión); un fallo de red
 * deja reintentar sin perder la sesión.
 */
export default function PrivateRoute() {
  const hasToken = Boolean(getAuthItem('access_token'))
  const location = useLocation()
  const [check, setCheck] = useState({ status: 'loading', user: null })
  const [attempt, setAttempt] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!getAuthItem('access_token')) return undefined
    let cancelled = false
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, 4000)

    api
      .get('/api/auth/me/')
      .then(({ data }) => {
        if (cancelled) return
        const user = data?.data?.user
        if (!ROLES.includes(user?.rol)) {
          clearSession({ redirect: false })
          setCheck({ status: 'invalid', user: null })
          return
        }
        setAuthItem('user_role', user.rol)
        setAuthItem('user_nombre', user.nombre)
        setAuthItem('user_email', user.email)
        setCheck({ status: 'ready', user })
      })
      .catch((error) => {
        if (cancelled) return
        const status = error.response?.status
        if (status === 401 || status === 403) {
          clearSession({ redirect: false })
          setCheck({ status: 'invalid', user: null })
        } else {
          setCheck({ status: 'error', user: null })
        }
      })
      .finally(() => clearTimeout(slowTimer))

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [attempt])

  // Se recuerda la página pedida (p. ej. el enlace del correo a /review/12) para volver tras entrar.
  if (!hasToken || check.status === 'invalid') {
    return <Navigate to="/login" replace state={{ desde: `${location.pathname}${location.search}` }} />
  }

  if (check.status === 'ready') {
    return (
      <VerifiedUserContext.Provider value={check.user}>
        <Outlet />
      </VerifiedUserContext.Provider>
    )
  }

  const failed = check.status === 'error'
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center text-center" role={failed ? 'alert' : 'status'}>
        <img
          src="/nexomark-icon-192.png"
          alt=""
          width="56"
          height="56"
          className={failed ? 'h-14 w-14' : 'h-14 w-14 motion-safe:animate-pulse'}
        />
        {failed ? (
          <>
            <h1 className="mt-6 text-lg font-semibold text-on-surface">No pudimos verificar tu sesión</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              El servidor no respondió. Revisa tu conexión y vuelve a intentarlo; tu sesión sigue guardada.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => {
                  setCheck({ status: 'loading', user: null })
                  setSlow(false)
                  setAttempt((n) => n + 1)
                }}
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </Button>
              <Button variant="outline" onClick={() => clearSession()}>
                Iniciar sesión de nuevo
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-6 text-sm font-medium text-on-surface">Verificando tu sesión…</p>
            {slow && (
              <p className="mt-2 text-sm text-on-surface-variant">
                El servidor puede tardar hasta un minuto en despertar.{' '}
                <Link to="/" className="font-medium text-primary underline">
                  Volver al inicio
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
