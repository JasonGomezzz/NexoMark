import { useEffect, useRef, useState } from 'react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'

export default function EmailChangeSettings({ currentEmail }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const locked = useRef(false)

  useEffect(() => {
    let active = true
    api.get('/api/auth/me/change-email/').then(({ data }) => {
      if (active) setPending(data.data.pending)
    }).catch(() => {
      if (active) setError('No se pudo consultar el cambio de correo. Actualiza el estado antes de continuar.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function run(action) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action === 'request') {
        const { data } = await api.post('/api/auth/me/change-email/', { new_email: email.trim(), current_password: password })
        setMessage(data.message)
        setEditing(false)
        setEmail('')
      } else if (action === 'cancel') {
        const { data } = await api.delete('/api/auth/me/change-email/')
        setMessage(data.message)
      }
      const { data } = await api.get('/api/auth/me/change-email/')
      setPending(data.data.pending)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'No se pudo procesar la solicitud. Revisa el estado antes de reintentar.')
    } finally {
      setPassword('')
      setBusy(false)
      locked.current = false
    }
  }

  return <section aria-labelledby="email-change-title" className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
    <h2 id="email-change-title" className="text-xl font-semibold text-on-surface">Correo de acceso</h2>
    <p className="mt-2 text-sm text-on-surface-variant">Tu correo actual es {currentEmail}. Cambiarlo requiere tu contraseña y confirmar un enlace en ambos correos. No cambia al escribir.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Consultando estado…</p> : pending ? <div className="mt-4 space-y-3 text-sm">
      <p>Cambio pendiente a <strong className="break-all">{pending.new_email}</strong>.</p>
      <p>Correo actual: {pending.old_confirmed ? 'confirmado' : 'pendiente'}. Correo nuevo: {pending.new_confirmed ? 'confirmado' : 'pendiente'}.</p>
      <p>Vence: {new Date(pending.expires_at).toLocaleString('es-PE')}. Hasta confirmar ambos, conserva tu correo actual para ingresar.</p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => run('cancel')}>Cancelar cambio pendiente</Button>
    </div> : editing && <form className="mt-4 space-y-4" aria-busy={busy} onSubmit={e => { e.preventDefault(); run('request') }}>
      <label className="block text-sm font-medium">Nuevo correo
        <input type="email" autoComplete="email" maxLength={255} required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-on-surface focus:ring-2 focus:ring-primary" />
      </label>
      <label className="block text-sm font-medium">Contraseña actual
        <input type="password" autoComplete="current-password" maxLength={128} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-on-surface focus:ring-2 focus:ring-primary" />
      </label>
      <p className="text-sm text-on-surface-variant">Los enlaces vencen en 30 minutos. Al completar el cambio, se cerrarán las sesiones y deberás ingresar con el nuevo correo. Si no tienes acceso al correo actual, solicita ayuda al administrador; este formulario no permite omitir la verificación.</p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !password || !email.trim() || email.trim().toLowerCase() === currentEmail.toLowerCase()}>{busy ? 'Procesando…' : 'Enviar confirmaciones'}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(false); setEmail(''); setPassword(''); setError('') }}>Cancelar</Button>
      </div>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-on-surface-variant">{message}</p>}
    {!loading && <div className="mt-4 flex flex-wrap gap-3">
      {!pending && !editing && !error && <Button type="button" disabled={busy} onClick={() => { setEditing(true); setMessage('') }}>Cambiar correo</Button>}
      <Button type="button" variant="outline" disabled={busy} onClick={() => run('refresh')}>Actualizar estado</Button>
    </div>}
  </section>
}
