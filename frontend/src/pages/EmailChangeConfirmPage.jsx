import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { clearAuthSession } from '@/lib/authStorage'

// Independent client: confirmation must work even with an expired login in this browser.
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL })

export default function EmailChangeConfirmPage() {
  const [link] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return { request_id: params.get('request_id'), side: params.get('side'), token: params.get('token') }
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const locked = useRef(false)
  const valid = /^\d+$/.test(link.request_id || '') && ['old', 'new'].includes(link.side) && (link.token?.length || 0) >= 40
  const remaining = Math.max(0, Math.ceil((waitUntil - now) / 1000))
  useEffect(() => {
    // Remove secrets from address bar/history once captured; never confirm on mount.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }, [])
  useEffect(() => {
    if (!waitUntil) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= waitUntil) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [waitUntil])

  async function confirm() {
    if (!valid || locked.current || done || remaining > 0) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      const { data } = await publicApi.post('/api/auth/email-change/confirm/', link)
      setMessage(data.message)
      setDone(true)
    } catch (err) {
      setMessage(err.response?.data?.message || 'No se pudo confirmar. Intenta nuevamente.')
      if (err.response?.status === 429) {
        const seconds = Number(err.response.data?.data?.retry_after || 60)
        setNow(Date.now())
        setWaitUntil(Date.now() + seconds * 1000)
      }
    } finally { locked.current = false; setBusy(false) }
  }

  return <main className="auth-shell flex min-h-screen items-center justify-center p-6">
    <section className="glass-liquid w-full max-w-lg rounded-xl p-8">
      <h1 className="text-2xl font-bold text-on-surface">Confirmar cambio de correo</h1>
      <p className="mt-4 text-on-surface-variant">Confirma solo si solicitaste cambiar el correo de tu cuenta NexoMark. El cambio se completará al confirmar los enlaces de ambas direcciones.</p>
      {!valid ? <p role="alert" className="mt-4 text-error">El enlace no es válido. Abre el enlace completo de tu correo o solicita otro cambio desde Configuración.</p> : !done && <Button className="mt-6" type="button" disabled={busy || remaining > 0} onClick={confirm}>{busy ? 'Confirmando…' : remaining > 0 ? `Espera ${remaining} s` : 'Confirmar'}</Button>}
      {message && <p role="status" className="mt-4 text-on-surface">{message}</p>}
      <div className="mt-6 flex flex-wrap gap-4">
        <Link className="text-primary underline" to="/login" onClick={() => clearAuthSession()}>Ir al inicio de sesión</Link>
        <Link className="text-primary underline" to="/settings">Volver a Configuración</Link>
      </div>
    </section>
  </main>
}
