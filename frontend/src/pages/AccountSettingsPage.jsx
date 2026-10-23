import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { Coins, AlertCircle, KeyRound, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { useTheme } from '../hooks/useTheme'
import SocialConnectionsCard from '@/components/social/SocialConnectionsCard'
import ProfilePhoto from '@/components/account/ProfilePhoto'
import EmailChange, { SinContrasena } from '@/components/account/EmailChange'
import GoogleLink from '@/components/account/GoogleLink'
import { setAuthItem } from '../services/session'

/**
 * Configuración de cuenta, sobre los endpoints reales de Django:
 * - GET/PATCH /api/auth/me/ → perfil, nombre y foto (multipart `avatar` o `remove_avatar`)
 * - /api/auth/me/change-email/ → cambio de correo con doble confirmación
 * - POST /api/auth/me/change-password/ → cambio de contraseña (exige la actual)
 * - POST /api/auth/google/disconnect/ → desvincular Google (exige contraseña)
 * El rol lo administra el SuperAdmin. No hay planes ni facturación.
 */
const ROLE_LABEL = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

const QUOTA_DEFAULT = 100 // tokens_disponibles default del modelo User

export default function AccountSettingsPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Perfil
  const [nombre, setNombre] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const { theme, setTheme } = useTheme()

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
    setSavingProfile(true)
    try {
      const { data } = await api.patch('/api/auth/me/', { nombre: nombre.trim() })
      setUser(data.data.user)
      setAuthItem('user_nombre', data.data.user.nombre)
      toast.success('Nombre actualizado')
    } catch (err) {
      const fieldError = err.response?.data?.data?.nombre?.[0]
      toast.error(fieldError || err.response?.data?.message || 'No se pudo actualizar el nombre')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('La confirmación no coincide con la nueva contraseña.')
      return
    }
    setSavingPassword(true)
    try {
      await api.post('/api/auth/me/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('Contraseña actualizada')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const data = err.response?.data?.data
      const fieldError = data?.current_password?.[0] || data?.new_password?.[0]
      toast.error(fieldError || err.response?.data?.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-container-high" />
        <div className="h-72 animate-pulse rounded-xl border border-outline-variant bg-white" />
        <div className="h-96 animate-pulse rounded-xl border border-outline-variant bg-white" />
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

  const miembroDesde = user.fecha_creacion
    ? new Date(user.fecha_creacion).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const usaCreditos = user.rol === 'marketero' || user.rol === 'superadmin'
  const tokens = user.tokens_disponibles ?? 0
  const pct = Math.min(100, Math.round((tokens / QUOTA_DEFAULT) * 100))
  const nombreCambiado = nombre.trim() !== (user.nombre || '') && nombre.trim().length >= 2
  const passwordValido =
    currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0

  const inputCls =
    'w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-transparent focus:ring-2 focus:ring-primary'

  return (
    <>
      <AppToaster />
      <div className="max-w-3xl space-y-6">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Configuración</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Tu perfil, cómo entras a NexoMark y las redes donde se publica.
          </p>
        </header>

        {/* Perfil: foto y nombre */}
        <section aria-labelledby="perfil-titulo" className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 id="perfil-titulo" className="flex items-center gap-2 text-xl font-semibold text-on-surface">
            <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
            Perfil
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {ROLE_LABEL[user.rol] ?? user.rol}
            {miembroDesde && ` · en NexoMark desde el ${miembroDesde}`}. El rol lo administra el SuperAdmin.
          </p>

          <div className="mt-6">
            <ProfilePhoto usuario={user} onCambio={setUser} />
          </div>

          <form onSubmit={handleSaveProfile} className="mt-6 flex flex-col gap-3 border-t border-outline-variant/60 pt-6 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm font-medium text-on-surface">Nombre</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                minLength={2}
                maxLength={150}
                required
                autoComplete="name"
                className={inputCls}
              />
            </label>
            <Button type="submit" disabled={!nombreCambiado || savingProfile}>
              {savingProfile ? 'Guardando…' : 'Guardar nombre'}
            </Button>
          </form>
        </section>

        {/* Acceso y seguridad: correo, contraseña y Google */}
        <section aria-labelledby="acceso-titulo" className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 id="acceso-titulo" className="flex items-center gap-2 text-xl font-semibold text-on-surface">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Acceso y seguridad
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">Cómo entras a NexoMark en la web y en la app.</p>
          {!user.has_password && (
            <SinContrasena email={user.email}>
              Tu cuenta entra con Google y aún no tiene contraseña. Créala con «Olvidé mi contraseña» (te enviamos un
              enlace a {user.email}): sin ella no puedes cambiar el correo ni desvincular Google.
            </SinContrasena>
          )}

          <div className="mt-6 divide-y divide-outline-variant/60 [&>*]:py-6 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            <EmailChange usuario={user} />

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                Contraseña
              </h3>
              {user.has_password ? (
                <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                  <label className="block sm:max-w-sm">
                    <span className="mb-1.5 block text-sm font-medium text-on-surface">Contraseña actual</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={inputCls}
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-on-surface">Nueva contraseña</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                        className={inputCls}
                      />
                      <p className="mt-1 text-[13px] text-on-surface-variant">Mínimo 8 caracteres.</p>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-on-surface">Confirmar nueva contraseña</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <Button type="submit" size="sm" variant="outline" disabled={!passwordValido || savingPassword}>
                    {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
                  </Button>
                </form>
              ) : (
                <p className="mt-2 text-[13px] text-on-surface-variant">Aún no tienes: entras con Google.</p>
              )}
            </div>

            <GoogleLink usuario={user} />
          </div>
        </section>

        {/* Redes conectadas — el dueño de la cuenta autoriza; el marketero elige destino al enviar */}
        {(user.rol === 'marketero' || user.rol === 'cliente') && <SocialConnectionsCard />}

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
