import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, LinkIcon, MailCheck } from 'lucide-react'
import api from '../services/api'
import { clearSession } from '../services/session'
import { Button } from '@/components/ui/button'
import AuthCardShell from '@/components/auth/AuthCardShell'
import { formatoEspera, mensajeDeError, segundosDeEspera } from '../services/passwordReset'

const ENLACE_INVALIDO =
  'El enlace no es válido, ya se usó o venció. Si aún quieres cambiar tu correo, solicítalo otra vez desde Cuenta.'

function datosDesdeHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const requestId = Number(params.get('request_id'))
  const side = params.get('side')
  const token = params.get('token') || ''
  if (!Number.isInteger(requestId) || requestId < 1 || !['old', 'new'].includes(side) || token.length < 40) {
    return null
  }
  return { request_id: requestId, side, token }
}

/**
 * "Confirmar cambio de correo" — destino de los dos enlaces del correo
 * (/confirm-email-change#request_id=…&side=…&token=…). Solo confirma al pulsar
 * el botón: abrir el enlace (o que el correo lo previsualice) no cambia nada.
 * Sirve para la web y para la app móvil, que no intercepta estos enlaces.
 */
export default function EmailChangeConfirmPage() {
  const navigate = useNavigate()
  const [datos] = useState(() => datosDesdeHash(window.location.hash))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(datos ? null : 'invalido')

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  async function confirmar() {
    if (enviando || !datos) return
    setEnviando(true)
    setError('')
    try {
      const { data } = await api.post('/api/auth/email-change/confirm/', datos)
      if (data?.data?.completed) {
        clearSession({ redirect: false })
        setResultado('completo')
      } else {
        setResultado({ parcial: data?.message })
      }
    } catch (err) {
      if (segundosDeEspera(err)) {
        setError(`Demasiados intentos. Intenta nuevamente en ${formatoEspera(segundosDeEspera(err))}.`)
      } else if ([400, 409].includes(err.response?.status)) {
        setResultado({ invalido: err.response?.data?.message || ENLACE_INVALIDO })
      } else {
        setError(mensajeDeError(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (resultado === 'completo') {
    return (
      <AuthCardShell title="Correo actualizado">
        <div className="flex gap-3 rounded-xl border border-success/20 bg-success-container p-4 text-sm text-success">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p role="status">
            Tu cuenta ya usa el correo nuevo. Por seguridad cerramos todas tus sesiones: entra otra vez con ese
            correo en la web o en la app.
          </p>
        </div>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => navigate('/login', { replace: true })}>
          Iniciar sesión
        </Button>
      </AuthCardShell>
    )
  }

  if (resultado?.parcial) {
    return (
      <AuthCardShell title="Falta un paso">
        <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-fixed p-4 text-sm text-on-surface">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p role="status">{resultado.parcial} Tienes 30 minutos desde que lo pediste.</p>
        </div>
      </AuthCardShell>
    )
  }

  if (resultado === 'invalido' || resultado?.invalido) {
    return (
      <AuthCardShell title="Enlace no válido">
        <div className="flex gap-3 rounded-xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
          <LinkIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p role="alert">{resultado?.invalido || ENLACE_INVALIDO}</p>
        </div>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => navigate('/login')}>
          Ir a iniciar sesión
        </Button>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      title="Confirma el cambio de correo"
      subtitle={
        datos.side === 'old'
          ? 'Con esto confirmas desde tu correo actual que quieres cambiarlo.'
          : 'Con esto confirmas que este correo nuevo es tuyo.'
      }
    >
      <p className="text-sm text-on-surface-variant">
        El cambio ocurre cuando se confirman los dos correos. Si no lo pediste tú, cierra esta página y cambia tu
        contraseña.
      </p>
      {error && (
        <p role="alert" className="mt-4 px-1 text-sm text-error">
          {error}
        </p>
      )}
      <Button type="button" size="lg" className="mt-6 w-full" onClick={confirmar} disabled={enviando}>
        {enviando ? 'Confirmando…' : 'Confirmar'}
      </Button>
    </AuthCardShell>
  )
}
