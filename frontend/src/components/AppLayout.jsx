import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
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
  ChartColumnIncreasing,
  Menu,
  X,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useVerifiedUser } from '../hooks/useVerifiedUser'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Avatar from '@/components/account/Avatar'
import { useFotoPerfil } from '../hooks/useFotoPerfil'
import { cn } from '@/lib/utils'

/**
 * Marco del panel: barra lateral marina (el contenedor del icono de marca) con
 * la navegación de cada rol. En pantallas pequeñas la barra se vuelve un cajón
 * que se abre desde la barra superior.
 */
const NAV_ITEMS = {
  marketero: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campañas', icon: Megaphone },
    { to: '/stats', label: 'Estadísticas', icon: ChartColumnIncreasing },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  superadmin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campañas', icon: Megaphone },
    { to: '/admin', label: 'Usuarios', icon: Users },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/stats', label: 'Estadísticas', icon: ChartColumnIncreasing },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  cliente: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client-campaigns', label: 'Pendientes', icon: ClipboardList },
    { to: '/stats', label: 'Estadísticas', icon: ChartColumnIncreasing },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
}

const ROLE_LABEL = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

function SidebarContent({ role, nombre, foto, tokens, showCredits, onNavigate, onLogout, onCredits }) {
  const navItems = NAV_ITEMS[role] ?? NAV_ITEMS.cliente

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <BrandLogo tone="navy" className="text-lg" />
      </div>

      <nav aria-label="Navegación del panel" className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard' || to === '/admin'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-turquoise',
                isActive
                  ? 'bg-turquoise/15 text-on-navy'
                  : 'text-on-navy-muted hover:bg-white/[0.07] hover:text-on-navy',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-turquoise' : 'text-on-navy-muted group-hover:text-on-navy')}
                  aria-hidden="true"
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {showCredits && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onCredits}
            aria-label={`Créditos de IA: ${tokens ?? 'cargando'}. Ver detalle`}
            className="group w-full rounded-xl bg-navy-raised px-4 py-3.5 text-left transition-colors duration-150 hover:bg-navy-line focus-visible:outline-2 focus-visible:outline-turquoise"
          >
            <span className="flex items-center justify-between text-[13px] text-on-navy-muted">
              Créditos de IA
              <span className="text-turquoise-soft transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                Ver detalle
              </span>
            </span>
            <span className="mt-1 flex items-center gap-2">
              <Coins className="h-5 w-5 text-turquoise" aria-hidden="true" />
              <span className="text-2xl font-bold tabular-nums text-on-navy">{tokens ?? '—'}</span>
            </span>
            {tokens === 0 && <span className="mt-1 block text-[13px] font-medium text-on-navy-error">Cuota agotada: pide un reinicio al admin</span>}
          </button>
        </div>
      )}

      <div className="border-t border-navy-line px-3 pb-4 pt-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar nombre={nombre} src={foto} tono="navy" className="h-10 w-10 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-on-navy">{nombre || 'Usuario'}</p>
            <p className="text-[13px] text-on-navy-muted">{ROLE_LABEL[role] ?? role}</p>
          </div>
          <ThemeToggle tone="navy" />
        </div>
        <div className="mt-3 space-y-0.5">
          <NavLink
            to={role === 'cliente' ? '/client-help' : '/prompt-guide'}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-on-navy-muted transition-colors hover:bg-white/[0.07] hover:text-on-navy"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Soporte y guía
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-on-navy-muted transition-colors hover:bg-white/[0.07] hover:text-on-navy-error"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { logout, getNombre } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const verified = useVerifiedUser()
  const role = verified?.rol || 'cliente'
  const nombre = getNombre() || verified?.nombre || ''
  // Foto de perfil: se descarga una vez y cambia en el acto si se sube otra en Configuración.
  const foto = useFotoPerfil(verified)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)

  // Créditos de IA vivos (solo roles que crean campañas en Django).
  // Refresca al navegar Y cuando alguna página dispara 'credits-updated'.
  const [tokens, setTokens] = useState(verified?.tokens_disponibles ?? null)
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

  // Cajón móvil: Esc cierra, el foco entra al cajón y vuelve al botón al cerrar.
  useEffect(() => {
    if (!drawerOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = setTimeout(() => drawerRef.current?.querySelector('a, button')?.focus(), 50)
    const onKey = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const menuButton = menuButtonRef.current
    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      menuButton?.focus()
    }
  }, [drawerOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebarProps = {
    role,
    nombre,
    foto,
    tokens,
    showCredits,
    onNavigate: () => setDrawerOpen(false),
    onLogout: handleLogout,
    onCredits: () => {
      setDrawerOpen(false)
      navigate('/credits')
    },
  }

  return (
    <div className="app-shell flex min-h-screen bg-background">
      {/* Barra lateral fija (escritorio) */}
      <aside className="hidden w-64 shrink-0 bg-navy lg:block" aria-label="Menú principal">
        <div className="sticky top-0 h-screen">
          <SidebarContent {...sidebarProps} />
        </div>
      </aside>

      {/* Cajón (móvil y tableta) */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-navy-deep/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menú principal"
              className="absolute inset-y-0 left-0 w-[min(18rem,86vw)] bg-navy shadow-2xl"
              initial={{ transform: 'translateX(-100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(-100%)' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-on-navy-muted hover:bg-white/10 hover:text-on-navy"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <SidebarContent {...sidebarProps} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior (móvil y tableta) */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-2 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <BrandLogo className="text-base" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="relative min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
