import { clearAuthSession, setAuthItem } from '@/lib/authStorage'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import {
  Mail,
  ShieldCheck,
  Coins,
  CalendarDays,
  AlertCircle,
  Lock,
  Moon,
  Sun,
} from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { useTheme } from '../hooks/useTheme'
import { profileEditState } from '@/lib/profileEditing'
import EmailChangeSettings from '@/components/EmailChangeSettings'
import InstagramAccounts from '../components/InstagramAccounts'
import FacebookPages from '../components/FacebookPages'
import XAccounts from '../components/XAccounts'
import TikTokAccounts from '../components/TikTokAccounts'

/**
 * Configuración de cuenta (portado de Stitch: account_settings, adaptado a los
 * endpoints REALES):
 * - GET /api/auth/me/            → perfil + tokens_disponibles
 * - PATCH /api/auth/me/          → editar nombre (correo se verifica por separado)
 * - POST /api/auth/me/change-password/ → cambio de contraseña (exige la actual)
 * La sección "Suscripción/Upgrade Plan" del mockup NO se porta: no existe billing.
 */
const ROLE_LABEL = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

const QUOTA_DEFAULT = 100 // tokens_disponibles default del modelo User

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Perfil
  const [nombre, setNombre] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileRequest = useRef(false)

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordRetryUntil, setPasswordRetryUntil] = useState(0)
  const [passwordNow, setPasswordNow] = useState(() => Date.now())
  const passwordRequest = useRef(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    if (!passwordRetryUntil) return
    const timer = setInterval(() => {
      const now = Date.now()
      setPasswordNow(now)
      if (now >= passwordRetryUntil) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [passwordRetryUntil])

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/auth/me/')
      .then(({ data }) => {
        if (!cancelled) {
          setUser(data.data.user)
          setNombre(data.data.user.nombre || '')
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveProfile(e) {
    e.preventDefault()
    const edit = profileEditState({ draft: nombre, saved: user?.nombre, editing: editingProfile, saving: savingProfile })
    if (!edit.canSave || profileRequest.current) return
    profileRequest.current = true
    setProfileError('')
    setSavingProfile(true)
    try {
      const { data } = await api.patch('/api/auth/me/', { nombre: edit.name })
      setUser(data.data.user)
      setNombre(data.data.user.nombre || '')
      setEditingProfile(false)
      setAuthItem('user_nombre', data.data.user.nombre)
      toast.success('Perfil actualizado')
    } catch (err) {
      const fieldError = err.response?.data?.data?.nombre?.[0]
      const message = fieldError || err.response?.data?.message || 'No se pudo actualizar el perfil'
      setProfileError(message)
      toast.error(message)
    } finally {
      profileRequest.current = false
      setSavingProfile(false)
    }
  }

  function handleCancelProfile() {
    if (profileRequest.current) return
    setNombre(user.nombre || '')
    setProfileError('')
    setEditingProfile(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passwordRequest.current || savingPassword || Date.now() < passwordRetryUntil) return
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmación no coincide con la nueva contraseña.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('La nueva contraseña debe ser diferente a la actual.')
      return
    }
    passwordRequest.current = true
    setSavingPassword(true)
    try {
      const { data } = await api.post('/api/auth/me/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      clearAuthSession()
      navigate('/login', { replace: true, state: { securityNotice: data.message } })
    } catch (err) {
      const data = err.response?.data?.data
      const errors = data?.errors || data
      const fieldError = errors?.current_password?.[0] || errors?.new_password?.[0]
      setPasswordError(fieldError || err.response?.data?.message || 'No se pudo confirmar el cambio. Si perdiste la conexión, intenta ingresar con la nueva contraseña antes de reintentar.')
      if (err.response?.status === 429) {
        const seconds = Number(data?.retry_after || err.response.headers?.['retry-after'] || 60)
        setPasswordNow(Date.now())
        setPasswordRetryUntil(Date.now() + seconds * 1000)
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      passwordRequest.current = false
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-container-high" />
        <div className="h-52 animate-pulse rounded-xl border border-outline-variant bg-white" />
        <div className="h-40 animate-pulse rounded-xl border border-outline-variant bg-white" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
        <AlertCircle className="h-4 w-4" />
        No se pudo cargar tu perfil. Verifica tu sesión.
      </div>
    )
  }

  const iniciales =
    (user.nombre || '')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  const usaCreditos = user.rol === 'marketero' || user.rol === 'superadmin'
  const tokens = user.tokens_disponibles ?? 0
  const pct = Math.min(100, Math.round((tokens / QUOTA_DEFAULT) * 100))
  const profileEdit = profileEditState({ draft: nombre, saved: user.nombre, editing: editingProfile, saving: savingProfile })
  const passwordValido =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword && newPassword !== currentPassword
  const passwordWait = Math.max(0, Math.ceil((passwordRetryUntil - passwordNow) / 1000))

  const inputCls =
    'w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-transparent focus:ring-2 focus:ring-primary'

  return (
    <>
      <AppToaster />
      <div className="max-w-3xl space-y-6">
        <header>
          {import.meta.env.VITE_INSTAGRAM_PREVIEW === 'true' && (
            <p className="mb-3 text-sm text-on-surface-variant">Vista temporal para conectar tus redes sociales. Las campañas y el resto del proyecto siguen en tu web local.</p>
          )}
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Configuración</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Gestiona tu perfil, tu contraseña y el estado de tu cuenta.
          </p>
        </header>

        {/* Perfil */}
        <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">
              {iniciales}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-on-surface">Datos del perfil</h2>
              <p className="text-sm text-on-surface-variant">
                Edita tu nombre y guarda cuando estés listo. El cambio de correo se verifica por separado; el rol lo gestiona el SuperAdmin.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} aria-busy={savingProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingProfile ? <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface">Nombre</span>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setProfileError('') }}
                  disabled={savingProfile}
                  autoComplete="name"
                  aria-describedby="profile-edit-help"
                  aria-invalid={profileError ? true : undefined}
                  minLength={2}
                  maxLength={150}
                  required
                  className={`${inputCls} disabled:cursor-wait disabled:opacity-70`}
                />
              </label> : <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Nombre</p>
                <p className="break-words text-sm font-medium text-on-surface">{user.nombre || '—'}</p>
              </div>}
              <ReadonlyField icon={Mail} label="Email" value={user.email} />
              <ReadonlyField
                icon={ShieldCheck}
                label="Rol"
                value={ROLE_LABEL[user.rol] ?? user.rol}
              />
              <ReadonlyField
                icon={CalendarDays}
                label="Miembro desde"
                value={
                  user.fecha_creacion
                    ? new Date(user.fecha_creacion).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'
                }
              />
            </div>
            <p id="profile-edit-help" className="text-sm text-on-surface-variant">
              {editingProfile ? 'Los cambios solo se guardan al pulsar «Guardar cambios».' : 'Pulsa «Editar perfil» para modificar tu nombre.'}
            </p>
            {editingProfile && profileEdit.dirty && <p role="status" className="text-sm text-on-surface-variant">Tienes cambios sin guardar.</p>}
            {profileError && <p role="alert" className="text-sm text-error">{profileError}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              {editingProfile ? <>
                <Button type="button" variant="outline" disabled={savingProfile} onClick={handleCancelProfile}>Cancelar</Button>
                <Button type="submit" disabled={!profileEdit.canSave}>
                  {savingProfile ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </> : <Button type="button" onClick={() => { setNombre(user.nombre || ''); setProfileError(''); setEditingProfile(true) }}>Editar perfil</Button>}
            </div>
          </form>
        </section>

        <EmailChangeSettings currentEmail={user.email} />

        {user.rol === 'marketero' && (
          <section aria-labelledby="social-connections-heading" className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
            <h2 id="social-connections-heading" className="text-xl font-semibold text-on-surface">Conexiones de redes sociales</h2>
            <p className="mt-2 text-sm text-on-surface-variant">Gestiona tus cuentas conectadas por plataforma. Conectar una cuenta no publica contenido automáticamente.</p>
            <div className="mt-6 divide-y divide-outline-variant">
              <InstagramAccounts />
              <FacebookPages />
              <XAccounts />
              <TikTokAccounts />
            </div>
          </section>
        )}

        {/* Seguridad */}
        <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-on-surface">
            <Lock className="h-5 w-5 text-primary" />
            Seguridad
          </h2>
          <p className="mb-5 text-sm text-on-surface-variant">
            Confirma tu contraseña actual y escribe la nueva dos veces. Al guardar se cerrarán tus sesiones, volverás al inicio de sesión y enviaremos un aviso a tu correo.
          </p>

          <form onSubmit={handleChangePassword} aria-busy={savingPassword} className="space-y-4">
            <label className="block sm:max-w-sm">
              <span className="mb-1.5 block text-sm font-medium text-on-surface">
                Contraseña actual
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                maxLength={128}
                disabled={savingPassword}
                required
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface">
                  Nueva contraseña
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  disabled={savingPassword}
                  minLength={8}
                  required
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-on-surface-variant">Mínimo 8 caracteres.</p>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface">
                  Confirmar nueva contraseña
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  disabled={savingPassword}
                  required
                  className={inputCls}
                />
              </label>
            </div>
            {confirmPassword && newPassword !== confirmPassword && <p role="status" className="text-sm text-error">Las contraseñas no coinciden.</p>}
            {passwordError && <p role="alert" className="text-sm text-error">{passwordError}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={!passwordValido || savingPassword || passwordWait > 0}>
                {savingPassword ? 'Actualizando…' : passwordWait > 0 ? `Espera ${passwordWait} s` : 'Actualizar contraseña'}
              </Button>
            </div>
          </form>
        </section>

        {/* Apariencia */}
        <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-on-surface">
            {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            Apariencia
          </h2>
          <p className="mb-5 text-sm text-on-surface-variant">
            Cambia entre tema claro y oscuro. Tu elección se guarda en este navegador.
          </p>
          <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                theme === 'light'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Sun className="h-4 w-4" />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                theme === 'dark'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Moon className="h-4 w-4" />
              Oscuro
            </button>
          </div>
        </section>

        {/* Créditos de IA — solo roles que generan */}
        {usaCreditos && (
          <section className="glass-soft rounded-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
                <Coins className="h-5 w-5 text-primary" />
                Créditos de IA
              </h2>
              <span className="text-sm font-bold tabular-nums text-primary">
                {tokens} / {QUOTA_DEFAULT}
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={tokens}
              aria-valuemin={0}
              aria-valuemax={QUOTA_DEFAULT}
              aria-label="Créditos de IA disponibles"
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
            >
              <div
                className={`h-full rounded-full transition-all ${tokens === 0 ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-on-surface-variant">
              1 crédito = 1 generación o regeneración exitosa de IA.{' '}
              {tokens === 0 ? (
                <span className="font-semibold text-error">
                  Cuota agotada — pide un reset al administrador.
                </span>
              ) : (
                'Al agotar la cuota, la creación se bloquea (el historial sigue disponible).'
              )}
            </p>
          </section>
        )}
      </div>
    </>
  )
}

function ReadonlyField({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="truncate text-sm font-medium text-on-surface">{value || '—'}</p>
    </div>
  )
}
