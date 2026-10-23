import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import AuthCardShell from '@/components/auth/AuthCardShell'
import { useCountdown } from '../hooks/useCountdown'
import { formatoEspera, mensajeDeError, segundosDeEspera } from '../services/passwordReset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INPUT_CLASS =
  'w-full rounded-xl border px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary'

/**
 * "¿Olvidaste tu contraseña?" — POST /api/auth/password-reset/.
 * El backend responde lo mismo exista o no la cuenta, así que aquí tampoco se
 * distingue: siempre se muestra el mismo aviso tras enviar.
 * Desde Configuración ("Crear contraseña", cuentas creadas con Google) llega
 * con el correo de la cuenta ya escrito.
 */
export default function ForgotPasswordPage() {
  const location = useLocation()
  const [email, setEmail] = useState(() => (typeof location.state?.email === 'string' ? location.state.email : ''))
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [espera, iniciarEspera] = useCountdown()

  async function enviar(event) {
    event.preventDefault()
    if (enviando || espera > 0) return
    const limpio = email.trim()
    if (!EMAIL_RE.test(limpio)) {
      setError('Ingresa un correo válido.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const { data } = await api.post('/api/auth/password-reset/', { email: limpio })
      setAviso(data.message)
      setEnviado(true)
      iniciarEspera(Number(data.data?.resend_after) || 60)
    } catch (err) {
      const segundos = segundosDeEspera(err)
      if (segundos) iniciarEspera(segundos)
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <AuthCardShell title="Revisa tu correo">
        <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p role="status">{aviso}</p>
        </div>
        <p className="mt-4 text-sm text-on-surface-variant">
          El enlace vence en 30 minutos y solo sirve una vez.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
        <div className="mt-6 flex flex-col gap-3">
          <Button type="button" variant="outline" disabled={enviando || espera > 0} onClick={enviar}>
            {enviando
              ? 'Enviando…'
              : espera > 0
                ? `Reenviar en ${formatoEspera(espera)}`
                : 'Reenviar enlace'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setEnviado(false)
              setError('')
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Usar otro correo
          </button>
        </div>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva."
    >
      <form onSubmit={enviar} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="px-1 text-sm font-medium text-on-surface-variant">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'email-error' : undefined}
            className={`${INPUT_CLASS} ${error ? 'border-error' : 'border-outline-variant'}`}
          />
          {error && (
            <p id="email-error" role="alert" className="px-1 text-xs text-error">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" disabled={enviando || espera > 0} className="w-full text-lg">
          {enviando
            ? 'Enviando…'
            : espera > 0
              ? `Espera ${formatoEspera(espera)}`
              : 'Enviar enlace'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        ¿La recordaste?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthCardShell>
  )
}
