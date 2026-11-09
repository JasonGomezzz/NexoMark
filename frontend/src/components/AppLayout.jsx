import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Users,
  LogOut,
  LifeBuoy,
  Coins,
  Settings,
  Lightbulb,
  ClipboardList,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import BrandLogo from '@/components/BrandLogo'
import ProfileAvatar from '@/components/ProfileAvatar'
import { getAuthItem } from '@/lib/authStorage'

/**
 * Navegación por rol. Etiquetas en español, sin nav pública dentro del panel.
 * (Se conserva la separación de roles que ya existía en la lógica.)
 */
const NAV_ITEMS = {
  marketero: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campañas', icon: Megaphone },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  superadmin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campañas', icon: Megaphone },
    { to: '/admin', label: 'Usuarios', icon: Users },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  cliente: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client-campaigns', label: 'Pendientes', icon: ClipboardList },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
}

const ROLE_LABEL = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

export default function AppLayout() {
  const { logout, getRole, getNombre } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = getRole() || 'cliente'
  const [nombre, setNombre] = useState(() => getNombre() || '')
  useEffect(() => {
    const refreshName = () => setNombre(getAuthItem('user_nombre') || '')
    window.addEventListener('profile-updated', refreshName)
    return () => window.removeEventListener('profile-updated', refreshName)
  }, [])
  const navItems = NAV_ITEMS[role] ?? NAV_ITEMS.cliente

  // Créditos de IA vivos (solo roles que crean campañas en Django).
  // Refresca al navegar Y cuando alguna página dispara 'credits-updated'
  // (p. ej. al generar/regenerar — el descuento se refleja al instante).
  const [tokens, setTokens] = useState(null)
  const [creditsTick, setCreditsTick] = useState(0)
  const showCredits = role === 'marketero' || role === 'superadmin'

  useEffect(() => {
    const onCreditsUpdated = () => setCreditsTick((t) => t + 1)
    window.addEventListener('credits-updated', onCreditsUpdated)
    return () => window.removeEventListener('credits-updated', onCreditsUpdated)
  }, [])

  useEffect(() => {
    if (!showCredits) return
    let cancelled = false
    // /me devuelve el valor SIN caché (stats cachea 30s y quedaría stale)
    api
      .get('/api/auth/me/')
      .then(({ data }) => {
        if (!cancelled && data?.data?.user?.tokens_disponibles != null) {
          setTokens(data.data.user.tokens_disponibles)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [showCredits, location.key, creditsTick])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell liquid-app-shell flex h-screen bg-background p-3">
      <aside className="glass-sidebar liquid-panel flex w-64 flex-col overflow-hidden rounded-3xl border border-outline-variant">
        <div className="px-6 py-6">
          <BrandLogo className="text-xl" />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'liquid-nav-active text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Token Balance — clic lleva a Configuración (detalle de cuota) */}
        {showCredits && (
          <div className="px-4 py-4">
            <button
              onClick={() => navigate('/credits')}
              aria-label="Ver detalle de créditos de IA"
              className="glass-soft glass-float w-full rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary/70">
                Créditos de IA
              </p>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {tokens ?? '—'}
                </span>
              </div>
              <p className={`mt-1 text-xs font-medium ${tokens === 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                {tokens === 0 ? 'Cuota agotada — pide reset al admin' : 'Ver detalle →'}
              </p>
            </button>
          </div>
        )}

        {/* Usuario + rol + acciones */}
        <div className="mx-4 mb-4 space-y-3 border-t border-outline-variant pt-4">
          <div className="flex items-center gap-3">
            <ProfileAvatar name={nombre} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-on-surface">{nombre || 'Usuario'}</p>
              <span className="inline-block rounded-full bg-primary-fixed px-2 py-0.5 text-xs font-semibold text-on-primary-fixed">
                {ROLE_LABEL[role] ?? role}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <NavLink
              to={role === 'cliente' ? '/client-help' : '/prompt-guide'}
              className="flex items-center gap-3 px-1 py-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
            >
              <LifeBuoy className="h-4 w-4" />
              Soporte y guía
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-1 py-1.5 text-sm text-on-surface-variant transition-colors hover:text-error"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="liquid-main relative flex-1 overflow-auto bg-transparent p-6 lg:p-8">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
