import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Loader2, Mail, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AuthField from '@/components/auth/AuthField'
import { cuentaApi } from '../../services/cuentaApi'
import {
  formatoMinutos,
  mensajeApi,
  pasosCambioCorreo,
  segundosHasta,
  validarCambioCorreo,
} from '../../services/cuenta'

/** Reloj de un segundo mientras haya una cuenta regresiva en pantalla. */
function useAhora(activo) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return undefined
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(reloj)
  }, [activo])
  return ahora
}

/**
 * Cambio de correo con doble confirmación: se envía un enlace al correo actual y
 * otro al nuevo; el cambio ocurre cuando los dos se confirman antes de 30 minutos
 * y cierra todas las sesiones. Mientras tanto se sigue entrando con el actual.
 */
export default function EmailChange({ usuario }) {
  const id = useId()
  const [pendiente, setPendiente] = useState(undefined) // undefined = cargando
  const [editando, setEditando] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null) // 'pedir' | 'cancelar' | 'actualizar'
  const [falloCarga, setFalloCarga] = useState(false)

  const ahora = useAhora(Boolean(pendiente))
  const segundos = pendiente ? segundosHasta(pendiente.expires_at, ahora) : 0
  const vencida = Boolean(pendiente) && segundos === 0

  useEffect(() => {
    let vigente = true
    cuentaApi
      .cambioCorreo()
      .then((p) => vigente && setPendiente(p))
      .catch(() => {
        if (!vigente) return
        setPendiente(null)
        setFalloCarga(true)
      })
    return () => {
      vigente = false
    }
  }, [])

  // Al volver de abrir los enlaces en otra pestaña, el estado se pone al día solo.
  useEffect(() => {
    if (!pendiente) return undefined
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        cuentaApi
          .cambioCorreo()
          .then(setPendiente)
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [pendiente])

  async function actualizar() {
    setOcupado('actualizar')
    try {
      setPendiente(await cuentaApi.cambioCorreo())
      setFalloCarga(false)
    } catch (err) {
      toast.error(mensajeApi(err, 'No se pudo consultar el cambio de correo.'))
    } finally {
      setOcupado(null)
    }
  }

  async function pedir(e) {
    e.preventDefault()
    const problema = validarCambioCorreo({ nuevo, password }, usuario.email)
    if (problema) {
      setError(problema)
      return
    }
    setOcupado('pedir')
    setError('')
    try {
      const { pendiente: creado, mensaje } = await cuentaApi.pedirCambioCorreo(nuevo, password)
      setPendiente(creado)
      setEditando(false)
      setNuevo('')
      toast.success(mensaje || 'Te enviamos un enlace a cada correo.')
    } catch (err) {
      setError(mensajeApi(err, 'No se pudo pedir el cambio de correo.'))
    } finally {
      setPassword('')
      setOcupado(null)
    }
  }

  async function cancelar() {
    setOcupado('cancelar')
    try {
      const mensaje = await cuentaApi.cancelarCambioCorreo()
      setPendiente(null)
      toast.success(mensaje || 'Solicitud cancelada. Tu correo no cambió.')
    } catch (err) {
      toast.error(mensajeApi(err, 'No se pudo cancelar la solicitud.'))
    } finally {
      setOcupado(null)
    }
  }

  function cerrarFormulario() {
    setEditando(false)
    setNuevo('')
    setPassword('')
    setError('')
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            Correo
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Entras con <strong className="font-semibold break-all text-on-surface">{usuario.email}</strong>.
          </p>
        </div>
        {pendiente === null && !editando && usuario.has_password && (
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
            Cambiar correo
          </Button>
        )}
      </div>

      {pendiente === undefined && (
        <div className="mt-4 h-10 animate-pulse rounded-lg bg-surface-container-high" aria-hidden="true" />
      )}

      {falloCarga && (
        <p role="alert" className="mt-3 text-sm text-error">
          No se pudo consultar si hay un cambio en curso.{' '}
          <button type="button" onClick={actualizar} className="font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </p>
      )}

      {pendiente === null && !usuario.has_password && (
        <p className="mt-2 text-[13px] text-on-surface-variant">Para cambiarlo, primero crea una contraseña.</p>
      )}

      {pendiente === null && editando && (
        <form onSubmit={pedir} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField
              id={`${id}-nuevo`}
              type="email"
              label="Correo nuevo"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              maxLength={255}
              autoFocus
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
            />
            <AuthField
              id={`${id}-clave`}
              type="password"
              label="Contraseña actual"
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="text-[13px] text-on-surface-variant">
            Te enviamos un enlace a cada correo. El cambio ocurre cuando confirmes los dos antes de 30 minutos, y
            al completarse se cierran todas tus sesiones.
          </p>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={ocupado !== null || !nuevo.trim() || !password}>
              {ocupado === 'pedir' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {ocupado === 'pedir' ? 'Enviando…' : 'Enviar enlaces'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cerrarFormulario} disabled={ocupado !== null}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {pendiente && (
        <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="min-w-0 text-sm font-semibold text-on-surface">
              Cambio a <span className="break-all">{pendiente.new_email}</span>
            </p>
            <p
              className={`text-sm tabular-nums ${vencida ? 'font-semibold text-error' : 'text-on-surface-variant'}`}
              aria-live={segundos <= 60 ? 'polite' : 'off'}
            >
              {vencida ? 'Venció' : `Vence en ${formatoMinutos(segundos)}`}
            </p>
          </div>

          {vencida ? (
            <p className="mt-3 text-sm text-on-surface-variant">
              Pasaron los 30 minutos sin confirmar los dos enlaces. Tu correo no cambió; puedes pedirlo otra vez.
            </p>
          ) : (
            <>
              <ol className="mt-4 space-y-3" aria-label="Confirmaciones">
                {pasosCambioCorreo(pendiente, usuario.email).map((paso) => (
                  <li key={paso.lado} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                        paso.confirmado ? 'bg-primary text-on-primary' : 'border-2 border-outline-variant bg-surface-container-lowest'
                      }`}
                    >
                      {paso.confirmado && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-medium text-on-surface">{paso.titulo}</span>
                        <span
                          className={`text-[13px] font-semibold ${paso.confirmado ? 'text-primary' : 'text-on-surface-variant'}`}
                        >
                          {paso.confirmado ? 'Confirmado' : 'Pendiente'}
                        </span>
                      </span>
                      <span className="block break-all text-on-surface-variant">{paso.correo}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[13px] text-on-surface-variant">
                Abre el enlace que llegó a cada correo. Hasta que confirmes los dos, sigues entrando con{' '}
                {usuario.email}.
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {vencida ? (
              <Button size="sm" variant="outline" onClick={() => setPendiente(null)}>
                Pedir otro cambio
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={actualizar} disabled={ocupado !== null}>
                  <RotateCw className={`h-4 w-4 ${ocupado === 'actualizar' ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Actualizar estado
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelar} disabled={ocupado !== null}>
                  {ocupado === 'cancelar' ? 'Cancelando…' : 'Cancelar cambio'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Aviso para cuentas creadas con Google: sin contraseña local no se cambia el correo ni se desvincula. */
export function SinContrasena({ email, children }) {
  return (
    <div className="mt-4 rounded-xl border border-tertiary/25 bg-tertiary-container/60 px-4 py-3 text-sm text-on-surface">
      <p>{children}</p>
      <Link
        to="/forgot-password"
        state={{ email }}
        className="mt-2 inline-block font-semibold text-primary underline-offset-2 hover:underline"
      >
        Crear contraseña
      </Link>
    </div>
  )
}
