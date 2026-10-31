import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/button'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#ejemplos', label: 'Ejemplos' },
  { href: '#precios', label: 'Precios' },
]

/** Barra de la portada: logo, cuatro anclas, tema, acceso y una acción. */
export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-10">
          <Link to="/" aria-label="NexoMark IA, inicio" className="text-lg sm:text-xl">
            <BrandLogo />
          </Link>
          <ul className="hidden items-center gap-7 lg:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-11 items-center text-[15px] font-medium text-on-surface-variant transition-colors hover:text-on-surface">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <ButtonLink to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Iniciar sesión
          </ButtonLink>
          <ButtonLink to="/register" size="sm">
            Empezar gratis
          </ButtonLink>
        </div>
      </nav>
    </header>
  )
}
