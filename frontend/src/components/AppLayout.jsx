import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  Coins,
  FileText,
  House,
  LifeBuoy,
  Lightbulb,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react'
import api from '../services/api'
import { getCampaignSummary } from '../services/clientCampaigns'
import { useAuth } from '../hooks/useAuth'
import { useVerifiedUser } from '../hooks/useVerifiedUser'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Avatar from '@/components/account/Avatar'
import OrdenTrabajo, { PasoActual } from '@/components/linea/OrdenTrabajo'
import { EstacionContext } from '@/components/linea/EstacionContext'
import { conteosDeLinea, estacionDeRuta, estacionesDeRol } from '@/components/linea/estaciones'
import { useFotoPerfil } from '../hooks/useFotoPerfil'
import { cn } from '@/lib/utils'

/**
 * Marco del panel (dirección "Conforme"): la mesa marina enmarca la pantalla y
 * cada página es un pliego claro con marcas de corte. A la izquierda, la orden
 * de trabajo: el recorrido de la campaña como casillas que llevan a su paso y
 * dicen cuántas campañas esperan ahí. En el móvil, una pastilla con el paso
 * actual y un cajón con la orden y lo secundario.
 */
const SECUNDARIO = {
  marketero: [
    { to: '/dashboard', label: 'Inicio', icon: House },
    { to: '/campaigns', label: 'Todas las campañas', icon: FileText },
    { to: '/credits', label: 'Créditos de IA', icon: Coins },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  superadmin: [
    { to: '/dashboard', label: 'Inicio', icon: House },
    { to: '/campaigns', label: 'Todas las campañas', icon: FileText },
    { to: '/admin', label: 'Usuarios', icon: Users },
    { to: '/admin/analytics', label: 'Analítica', icon: BarChart3 },
    { to: '/credits', label: 'Créditos de IA', icon: Coins },
    { to: '/prompt-guide', label: 'Guía de prompts', icon: Lightbulb },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
  cliente: [
    { to: '/dashboard', label: 'Inicio', icon: House },
    { to: '/client-help', label: 'Ayuda', icon: LifeBuoy },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ],
}

const ROLE_LABEL = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

function ListaSecundaria({ role, onNavigate, onLogout, tono = 'claro' }) {
  const items = SECUNDARIO[role] ?? SECUNDARIO.cliente
  const enMarino = tono === 'navy'
  const base = enMarino
    ? 'text-on-navy-muted hover:bg-banda-2 hover:text-on-navy'
    : 'text-on-surface hover:bg-surface-container-low'
  return (
    <ul className="grid gap-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/dashboard' || to === '/admin' || to === '/campaigns'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors duration-150',
                base,
                isActive && (enMarino ? 'bg-banda-2 text-on-navy' : 'bg-primary-fixed text-on-primary-fixed'),
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium transition-colors duration-150',
            enMarino ? 'text-on-navy-muted hover:bg-banda-2 hover:text-on-navy-error' : 'text-on-surface hover:bg-error-container hover:text-on-error-container',
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          Cerrar sesión
        </button>
      </li>
    </ul>
  )
}

function Creditos({ tokens, onClick, compacto = false }) {
  const agotados = tokens === 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Créditos de IA: ${tokens ?? 'cargando'}. Ver detalle`}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full bg-banda-2 px-4 text-on-navy-muted transition-colors duration-150 hover:text-on-navy',
        agotados && 'text-on-navy-error',
      )}
    >
      <Coins className="h-4 w-4 text-turquoise" aria-hidden="true" />
      {!compacto && <span className="text-[13px]">Créditos</span>}
      <span className="cifra text-lg text-on-navy tabular-nums">{tokens ?? '…'}</span>
    </button>
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

  // La página puede afinar la estación actual (p. ej. el detalle de una campaña).
  const [estacionPagina, setEstacionPagina] = useState(null)
  const fijarEstacion = useCallback((id) => setEstacionPagina(id), [])
  const estaciones = estacionesDeRol(role)
  const actual = estacionPagina ?? estacionDeRuta(location.pathname, location.search)

  // Créditos de IA vivos (solo roles que crean campañas en Django).
  // Refresca al navegar Y cuando alguna página dispara 'credits-updated'.
  const [tokens, setTokens] = useState(verified?.tokens_disponibles ?? null)
  const [creditsTick, setCreditsTick] = useState(0)
  const showCredits = role === 'marketero' || role === 'superadmin'
  const [conteos, setConteos] = useState({})

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

  // Conteo por estación: cuántas campañas esperan en cada etapa.
  useEffect(() => {
    if (!verified?.rol) return undefined
    let cancelled = false
    const pedido = role === 'cliente'
      ? getCampaignSummary()
      : api.get('/api/campaigns/stats/').then(({ data }) => data?.data)
    pedido
      .then((datos) => {
        if (!cancelled) setConteos(conteosDeLinea(role, datos))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [role, verified?.rol, location.key])

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

  const irACreditos = () => {
    setDrawerOpen(false)
    navigate('/credits')
  }

  const usuario = (
    <div className="flex items-center gap-3 px-2">
      <Avatar nombre={nombre} src={foto} tono="navy" className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-navy">{nombre || 'Usuario'}</p>
        <p className="text-[13px] text-on-navy-muted">{ROLE_LABEL[role] ?? role}</p>
      </div>
      <ThemeToggle tone="navy" />
    </div>
  )

  return (
    <div className="app-shell min-h-screen bg-cama lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[10px] focus:bg-paper focus:px-4 focus:py-2 focus:text-navy">
        Saltar al contenido
      </a>

      {/* Mesa (escritorio): marca, orden de trabajo y lo secundario */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto px-4 py-6 text-on-navy lg:flex" aria-label="Menú principal">
        <Link to="/dashboard" className="self-start rounded-[10px] px-2 text-lg" aria-label="NexoMark IA, ir al inicio">
          <BrandLogo tone="navy" />
        </Link>
        <div>
          <p className="mb-2 px-2 text-[13px] font-semibold text-on-navy-muted">Orden de trabajo</p>
          <nav aria-label="Orden de trabajo">
            <OrdenTrabajo estaciones={estaciones} actual={actual} conteos={conteos} />
          </nav>
        </div>
        <div className="h-px bg-cama-line" aria-hidden="true" />
        <nav aria-label="Más opciones">
          <ListaSecundaria role={role} tono="navy" onLogout={handleLogout} />
        </nav>
        <div className="mt-auto space-y-3">
          {showCredits && (
            <button
              type="button"
              onClick={irACreditos}
              aria-label={`Créditos de IA: ${tokens ?? 'cargando'}. Ver detalle`}
              className="flex w-full items-baseline justify-between rounded-[12px] border border-cama-line px-3 py-3 text-left text-[13px] text-on-navy-muted transition-colors hover:border-turquoise-soft hover:text-on-navy"
            >
              Créditos de IA
              <span className={`cifra text-[22px] tabular-nums ${tokens === 0 ? 'text-on-navy-error' : 'text-on-navy'}`}>{tokens ?? '…'}</span>
            </button>
          )}
          {usuario}
        </div>
      </aside>

      <div className="min-w-0 lg:py-[22px] lg:pr-[22px]">
        {/* Mesa (móvil y tableta): menú, marca y el paso actual */}
        <header className="flex h-14 items-center gap-1 px-2 text-on-navy lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-on-navy hover:bg-cama-2"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/dashboard" className="rounded-[10px] text-base" aria-label="NexoMark IA, ir al inicio">
            <BrandLogo tone="navy" compact />
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <PasoActual estaciones={estaciones} actual={actual} />
            {showCredits && <Creditos tokens={tokens} onClick={irACreditos} compacto />}
          </div>
        </header>

        {/* El pliego: cada pantalla vive aquí, con marcas de corte sobre la mesa */}
        <main
          id="contenido"
          className="relative mx-2 mb-2 min-h-[calc(100vh-64px)] min-w-0 overflow-x-clip rounded-[14px] bg-background px-4 py-6 sm:px-6 lg:m-0 lg:min-h-[calc(100vh-44px)] lg:rounded-[18px] lg:px-10 lg:py-9"
        >
          <span className="corte corte-a hidden lg:block" aria-hidden="true" />
          <span className="corte corte-b hidden lg:block" aria-hidden="true" />
          <span className="corte corte-c hidden lg:block" aria-hidden="true" />
          <span className="corte corte-d hidden lg:block" aria-hidden="true" />
          <div className="mx-auto max-w-[1280px]">
            <EstacionContext.Provider value={fijarEstacion}>
              <Outlet />
            </EstacionContext.Provider>
          </div>
        </main>
      </div>

      {/* Cajón (móvil y tableta): la orden de trabajo y lo secundario */}
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
              className="absolute inset-y-0 left-0 flex w-[min(19rem,86vw)] flex-col gap-5 overflow-y-auto bg-cama px-3 pb-5 text-on-navy shadow-2xl"
              initial={{ transform: 'translateX(-100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(-100%)' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex h-14 items-center justify-between pl-2">
                <BrandLogo tone="navy" className="text-base" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Cerrar menú"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-on-navy-muted hover:bg-cama-2 hover:text-on-navy"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div>
                <p className="mb-2 px-2 text-[13px] font-semibold text-on-navy-muted">Orden de trabajo</p>
                <nav aria-label="Orden de trabajo">
                  <OrdenTrabajo estaciones={estaciones} actual={actual} conteos={conteos} onNavigate={() => setDrawerOpen(false)} />
                </nav>
              </div>
              <div className="h-px bg-cama-line" aria-hidden="true" />
              <ListaSecundaria role={role} tono="navy" onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
              <div className="mt-auto">{usuario}</div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
