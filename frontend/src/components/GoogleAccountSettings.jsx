import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/services/api'
import { clearAuthSession } from '@/lib/authStorage'
import { Button } from '@/components/ui/button'
import GoogleIcon from '@/components/auth/GoogleIcon'

export default function GoogleAccountSettings({ user }) {
  const [editing, setEditing] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const navigate = useNavigate()
  async function disconnect(event) {
    event.preventDefault()
    if (locked.current || !password) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/api/auth/google/disconnect/', { current_password: password })
      clearAuthSession()
      navigate('/login', { replace: true, state: { securityNotice: data.message } })
    } catch (err) { setError(err.response?.data?.message || 'No se pudo desvincular Google.') }
    finally { setPassword(''); setBusy(false); locked.current = false }
  }
  return <section aria-labelledby="google-account-title" className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
    <h2 id="google-account-title" className="flex items-center gap-3 text-xl font-semibold text-on-surface"><GoogleIcon />Acceso con Google</h2>
    <p className="mt-2 text-sm text-on-surface-variant">{user.google_connected ? 'Google está vinculado a tu cuenta para iniciar sesión. No concede acceso a Gmail, Drive ni publicación en redes.' : 'Google no está vinculado. Para añadirlo, utiliza «Continuar con Google» en el login y confirma tu contraseña de NexoMark cuando se solicite.'}</p>
    {user.google_connected && <p className="mt-2 text-xs text-on-surface-variant">Cambiar tu correo o contraseña de NexoMark no desvincula Google. Usa la opción de desvinculación si ya no quieres permitir ese acceso.</p>}
    {user.google_connected && !user.has_password && <p className="mt-4 text-sm text-on-surface-variant">Antes de desvincular Google o cambiar tu correo, <Link to="/forgot-password" className="text-primary underline">crea una contraseña local mediante el enlace enviado a tu correo</Link>. Tu contraseña de Google nunca se introduce en NexoMark.</p>}
    {user.google_connected && user.has_password && !editing && <Button className="mt-4" type="button" variant="outline" onClick={() => setEditing(true)}>Desvincular Google</Button>}
    {editing && <form onSubmit={disconnect} className="mt-4 space-y-3">
      <p className="text-sm text-on-surface-variant">Se desactivará este acceso y se cerrarán las sesiones. Podrás ingresar con tu correo y contraseña de NexoMark.</p>
      <label className="block text-sm">Contraseña de NexoMark<input className="mt-2 w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !password}>Confirmar desvinculación</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(false); setPassword(''); setError('') }}>Cancelar</Button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
  </section>
}
