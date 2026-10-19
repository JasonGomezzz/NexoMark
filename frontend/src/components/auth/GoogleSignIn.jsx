import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import GoogleIcon from './GoogleIcon'
import { loadGoogleIdentity } from '@/lib/googleIdentity'
import { useTheme } from '@/hooks/useTheme'

// No ambient JWT: an expired local login must not interfere with Google sign-in.
const googleApi = axios.create({ baseURL: import.meta.env.VITE_API_URL })

export default function GoogleSignIn({ purpose = 'login', role, onSuccess }) {
  const container = useRef(null)
  const flow = useRef(null)
  const completeRef = useRef(null)
  const locked = useRef(false)
  const [ready, setReady] = useState(false)
  const [configured, setConfigured] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [linkRequired, setLinkRequired] = useState(false)
  const [registrationRequired, setRegistrationRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [retry, setRetry] = useState(0)
  const { theme } = useTheme()

  useEffect(() => {
    let active = true
    const host = container.current
    async function setup() {
      try {
        const config = await googleApi.get('/api/auth/google/config/')
        if (!active) return
        setConfigured(config.data.data.configured)
        if (!config.data.data.configured) return
        const sdk = await loadGoogleIdentity()
        if (!active) return
        const { data } = await googleApi.post('/api/auth/google/challenge/', { purpose, ...(purpose === 'register' ? { role } : {}) })
        if (!active) return
        flow.current = data.data
        sdk.initialize({ client_id: data.data.client_id, nonce: data.data.nonce, auto_select: false,
          ux_mode: 'popup', callback: response => {
            if (!active || !response.credential || locked.current) return
            flow.current = { ...data.data, credential: response.credential }
            complete('')
          } })
        sdk.renderButton(host, { type: 'standard', theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large', text: purpose === 'register' ? 'signup_with' : 'continue_with', shape: 'rectangular', locale: 'es', width: 320 })
        setReady(true)
      } catch (error) {
        if (active) setMessage(error.response?.data?.message || error.message || 'No se pudo preparar el acceso con Google.')
      }
    }
    async function complete(currentPassword) {
      if (locked.current || !flow.current?.credential) return
      locked.current = true
      setBusy(true)
      setMessage('')
      try {
        const { ticket, proof, credential } = flow.current
        const { data } = await googleApi.post('/api/auth/google/complete/', { ticket, proof, credential, ...(currentPassword ? { current_password: currentPassword } : {}) })
        if (active) { flow.current = null; setPassword(''); onSuccess(data) }
      } catch (error) {
        if (!active) return
        setMessage(error.response?.data?.message || 'No se pudo iniciar sesión. Vuelve a intentarlo.')
        setLinkRequired(Boolean(error.response?.data?.link_required))
        setRegistrationRequired(Boolean(error.response?.data?.registration_required))
        setPassword('')
      } finally { locked.current = false; if (active) setBusy(false) }
    }
    // Local callback only; credentials and browser proof stay in memory, never storage.
    completeRef.current = complete
    setup()
    return () => { active = false; flow.current = null; if (host) host.replaceChildren() }
  }, [purpose, role, onSuccess, retry, theme])

  function restart() {
    setReady(false); setLinkRequired(false); setRegistrationRequired(false); setMessage(''); setPassword('')
    setRetry(value => value + 1)
  }

  return <section aria-label="Acceso con Google" className="space-y-3">
    <div className={`flex justify-center ${busy || linkRequired ? 'pointer-events-none opacity-50' : ''}`} aria-busy={busy}>
      <div ref={container} />
      {!ready && <button type="button" disabled className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-60"><GoogleIcon />{purpose === 'register' ? 'Registrarse con Google' : 'Continuar con Google'}</button>}
    </div>
    {configured === false && <p className="text-xs text-on-surface-variant">Google está pendiente de configuración. Puedes usar tu correo y contraseña.</p>}
    {busy && <p role="status" className="text-sm text-on-surface-variant">Verificando acceso…</p>}
    {linkRequired && <form className="space-y-3" onSubmit={event => { event.preventDefault(); completeRef.current?.(password) }}>
      <p className="text-sm text-on-surface-variant">Para vincular Google a tu cuenta existente, confirma tu contraseña de NexoMark. No introduzcas la contraseña de Google.</p>
      <label className="block text-sm">Contraseña de NexoMark<input type="password" autoComplete="current-password" maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" /></label>
      <Button type="submit" disabled={busy || !password}>Vincular Google e ingresar</Button>
    </form>}
    {message && <p role="alert" className="text-sm text-error">{message}</p>}
    {registrationRequired && <Link to="/register" className="inline-block text-sm text-primary underline">Ir al registro</Link>}
    {(message || linkRequired) && <Button type="button" variant="outline" disabled={busy} onClick={restart}>Reiniciar acceso con Google</Button>}
  </section>
}
