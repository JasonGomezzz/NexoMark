import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AuthField from '@/components/auth/AuthField'
import GoogleIcon from '@/components/auth/GoogleIcon'
import { cuentaApi } from '../../services/cuentaApi'
import { googleApi } from '../../services/googleApi'
import { mensajeApi } from '../../services/cuenta'
import { clearSession } from '../../services/session'

/**
 * Google en la cuenta: si está vinculado y cómo desvincularlo. Desvincular exige
 * la contraseña de NexoMark (sin ella la persona no podría volver a entrar) y
 * cierra todas las sesiones. Vincular se hace entrando con Google desde el login.
 * Si el servidor no tiene Google configurado y la cuenta no está vinculada, no se muestra.
 */
export default function GoogleLink({ usuario }) {
  const id = useId()
  const navigate = useNavigate()
  const [configurado, setConfigurado] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vigente = true
    googleApi
      .config()
      .then((c) => vigente && setConfigurado(Boolean(c.configured)))
      .catch(() => vigente && setConfigurado(false))
    return () => {
      vigente = false
    }
  }, [])

  const vinculado = Boolean(usuario.google_connected)
  if (!vinculado && !configurado) return null

  async function desvincular(e) {
    e.preventDefault()
    if (!password) return
    setOcupado(true)
    setError('')
    try {
      const mensaje = await cuentaApi.desvincularGoogle(password)
      // El servidor subió token_version: todas las sesiones (también esta) quedaron cerradas.
      clearSession({ redirect: false })
      toast.success(mensaje || 'Google desvinculado. Entra con tu correo y contraseña.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(mensajeApi(err, 'No se pudo desvincular Google.'))
      setPassword('')
      setOcupado(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <GoogleIcon className="h-4 w-4" />
            Google
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {vinculado
              ? 'Vinculado. Puedes entrar con «Continuar con Google» o con tu correo y contraseña.'
              : 'Sin vincular. Para vincularlo, cierra sesión y entra con «Continuar con Google» usando este mismo correo: te pediremos tu contraseña de NexoMark una sola vez.'}
          </p>
        </div>
        {vinculado && usuario.has_password && !abierto && (
          <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
            Desvincular
          </Button>
        )}
      </div>

      {vinculado && !usuario.has_password && (
        <p className="mt-2 text-[13px] text-on-surface-variant">
          Para desvincularlo, primero crea una contraseña: sin ella no podrías volver a entrar.
        </p>
      )}

      {vinculado && usuario.has_password && abierto && (
        <form onSubmit={desvincular} className="mt-4 space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <p className="text-sm text-on-surface">
            Al desvincular Google se cierran todas tus sesiones, también en la app. Después entras con tu correo y
            contraseña.
          </p>
          <AuthField
            id={`${id}-clave`}
            type="password"
            label="Contraseña de NexoMark"
            autoComplete="current-password"
            maxLength={128}
            autoFocus
            error={error || undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!password || ocupado}
              className="bg-error text-on-error hover:bg-error/90"
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {ocupado ? 'Desvinculando…' : 'Desvincular Google'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={ocupado}
              onClick={() => {
                setAbierto(false)
                setPassword('')
                setError('')
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
