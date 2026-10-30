import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  ChevronDown,
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
import LineaNav from '@/components/linea/LineaNav'
import { EstacionContext } from '@/components/linea/EstacionContext'
import { conteosDeLinea, estacionDeRuta, estacionesDeRol } from '@/components/linea/estaciones'
import { useFotoPerfil } from '../hooks/useFotoPerfil'
import { cn } from '@/lib/utils'

/**
 * Marco del panel (dirección "Línea"): una banda marina con el recorrido de la
 * campaña como navegación. Cada estación lleva a su etapa y muestra cuántas
 * campañas esperan ahí. Lo secundario (inicio, todas las campañas, créditos,
 * configuración, salir) vive en el menú de la cuenta y, en el móvil, en el cajón.
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

function MenuCuenta({ role, nombre, foto, onLogout }) {
  const [abierto, setAbierto] = useState(false)
  const botonRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const alClic = (event) => {
      if (!panelRef.current?.contains(event.target) && !botonRef.current?.contains(event.target)) setAbierto(false)
    }
    const alTecla = (event) => {
      if (event.key === 'Escape') {
        setAbierto(false)
        botonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', alClic)
    window.addEventListener('keydown', alTecla)
    panelRef.current?.querySelector('a, button')?.focus()
    return () => {
      document.removeEventListener('pointerdown', alClic)
      window.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-cuenta"
        className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-on-navy transition-colors duration-150 hover:bg-banda-2"
      >
        <Avatar nombre={nombre} src={foto} tono="navy" className="h-9 w-9 text-sm" />
        <span className="hidden max-w-36 truncate text-sm font-semibold xl:block">{nombre || 'Mi cuenta'}</span>
        <ChevronDown className={cn('h-4 w-4 text-on-navy-muted transition-transform duration-200', abierto && 'rotate-180')} aria-hidden="true" />
        <span className="sr-only">Abrir menú de la cuenta</span>
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            ref={panelRef}
            id="menu-cuenta"
            initial={{ opacity: 0, transform: 'translateY(-4px) scale(0.98)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transform: 'translateY(-4px) scale(0.98)', transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 text-on-surface shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-hairline px-3 pb-3 pt-2">
              <Avatar nombre={nombre} src={foto} className="h-10 w-10 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nombre || 'Usuario'}</p>
                <p className="text-[13px] text-on-surface-variant">{ROLE_LABEL[role] ?? role}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="pt-2">
              <ListaSecundaria role={role} onNavigate={() => setAbierto(false)} onLogout={onLogout} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  return (
    <div className="app-shell min-h-screen bg-background">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-navy">
        Saltar al contenido
      </a>

      {/* Banda de la línea (escritorio) */}
      <header className="hidden bg-banda text-on-navy lg:block">
        <div className="mx-auto grid h-24 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 px-8">
          <Link to="/dashboard" className="justify-self-start rounded-lg text-lg" aria-label="NexoMark IA, ir al inicio">
            <BrandLogo tone="navy" />
          </Link>
          <nav aria-label="Recorrido de la campaña" className="mx-auto w-full max-w-[820px]">
            <LineaNav estaciones={estaciones} actual={actual} conteos={conteos} />
          </nav>
          <div className="flex items-center justify-end gap-2">
            {role === 'superadmin' && (
              <nav aria-label="Administración" className="mr-1 hidden items-center gap-1 2xl:flex">
                {SECUNDARIO.superadmin.filter((i) => i.to.startsWith('/admin')).map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    className={({ isActive }) =>
                      cn('inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-on-navy-muted hover:text-on-navy', isActive && 'bg-banda-2 text-on-navy')
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            )}
            {showCredits && <Creditos tokens={tokens} onClick={irACreditos} />}
            <MenuCuenta role={role} nombre={nombre} foto={foto} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* Banda del móvil y tableta: fila superior + línea en miniatura */}
      <header className="bg-banda text-on-navy lg:hidden">
        <div className="flex h-14 items-center gap-1 px-2">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-navy hover:bg-banda-2"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/dashboard" className="rounded-lg text-base" aria-label="NexoMark IA, ir al inicio">
            <BrandLogo tone="navy" />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {showCredits ? <Creditos tokens={tokens} onClick={irACreditos} compacto /> : <ThemeToggle tone="navy" />}
          </div>
        </div>
        <nav aria-label="Recorrido de la campaña" className="px-2 pb-2">
          <LineaNav estaciones={estaciones} actual={actual} conteos={conteos} mini />
        </nav>
      </header>

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
              className="absolute inset-y-0 left-0 flex w-[min(19rem,86vw)] flex-col bg-banda text-on-navy shadow-2xl"
              initial={{ transform: 'translateX(-100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(-100%)' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex h-14 items-center justify-between pl-4 pr-2">
                <BrandLogo tone="navy" className="text-base" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Cerrar menú"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-navy-muted hover:bg-banda-2 hover:text-on-navy"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-3 border-y border-via px-4 py-4">
                <Avatar nombre={nombre} src={foto} tono="navy" className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{nombre || 'Usuario'}</p>
                  <p className="text-[13px] text-on-navy-muted">{ROLE_LABEL[role] ?? role}</p>
                </div>
                <ThemeToggle tone="navy" />
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-3">
                <ListaSecundaria role={role} tono="navy" onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main id="contenido" className="relative min-w-0 overflow-x-clip px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1360px]">
          <EstacionContext.Provider value={fijarEstacion}>
            <Outlet />
          </EstacionContext.Provider>
        </div>
      </main>
    </div>
  )
}
