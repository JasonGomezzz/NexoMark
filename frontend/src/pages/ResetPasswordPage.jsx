import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, Eye, EyeOff, LinkIcon } from 'lucide-react'
import api from '../services/api'
import { clearSession } from '../services/session'
import { Button } from '@/components/ui/button'
import AuthCardShell from '@/components/auth/AuthCardShell'
import {
  MIN_PASSWORD,
  mensajeDeError,
  segundosDeEspera,
  formatoEspera,
  tokenDesdeHash,
  validarNuevaPassword,
} from '../services/passwordReset'

const INPUT_CLASS =
  'h-11 w-full rounded-[10px] border bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30'
const ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.'

/**
 * "Restablecer contraseña" — destino del enlace del correo (/reset-password#token=…).
 * POST /api/auth/password-reset/confirm/. Al cambiarla el backend cierra todas
 * las sesiones, así que también se limpia la de este navegador.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  // Se lee una vez: luego el token se quita de la barra y del historial.
  const [token] = useState(() => tokenDesdeHash(window.location.hash))
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [visible, setVisible] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [enlaceInvalido, setEnlaceInvalido] = useState(!token)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  async function guardar(event) {
    event.preventDefault()
    if (guardando) return
    const problema = validarNuevaPassword(password, confirmacion)
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    setError('')
    try {
      await api.post('/api/auth/password-reset/confirm/', { token, new_password: password })
      clearSession({ redirect: false })
      setListo(true)
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 400 && !data?.data?.errors?.new_password) {
        setEnlaceInvalido(true)
      } else if (segundosDeEspera(err)) {
        setError(`Demasiados intentos. Intenta nuevamente en ${formatoEspera(segundosDeEspera(err))}.`)
      } else {
        setError(mensajeDeError(err))
      }
    } finally {
      setGuardando(false)
    }
  }

  if (listo) {
    return (
      <AuthCardShell title="Contraseña actualizada">
        <div className="flex gap-3 rounded-xl border border-success/20 bg-success-container p-4 text-sm text-success">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p role="status">
            Ya puedes iniciar sesión con tu nueva contraseña. Por seguridad cerramos las sesiones
            abiertas en otros dispositivos.
          </p>
        </div>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => navigate('/login', { replace: true })}>
          Iniciar sesión
        </Button>
      </AuthCardShell>
    )
  }

  if (enlaceInvalido) {
    return (
      <AuthCardShell title="Enlace no válido">
        <div className="flex gap-3 rounded-xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
          <LinkIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p role="alert">{ENLACE_INVALIDO}</p>
        </div>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => navigate('/forgot-password')}>
          Solicitar un enlace nuevo
        </Button>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="Elige una nueva contraseña"
      subtitle={`Usa al menos ${MIN_PASSWORD} caracteres. Evita contraseñas comunes o solo numéricas.`}
    >
      <form onSubmit={guardar} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="new-password" className="px-1 text-sm font-medium text-on-surface-variant">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT_CLASS} pr-12 ${error ? 'border-error' : 'border-outline'}`}
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className="px-1 text-sm font-medium text-on-surface-variant">
            Confirmar contraseña
          </label>
          <input
            id="confirm-password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={128}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className={`${INPUT_CLASS} ${error ? 'border-error' : 'border-outline'}`}
          />
        </div>
        {error && (
          <p role="alert" className="px-1 text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={guardando} className="w-full text-lg">
          {guardando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        ¿El enlace no funciona?{' '}
        <Link to="/forgot-password" className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
          Pide otro
        </Link>
      </p>
    </AuthCardShell>
  )
}
