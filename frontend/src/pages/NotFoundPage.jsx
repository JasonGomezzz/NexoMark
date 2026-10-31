import { Link, useLocation } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { ButtonLink } from '@/components/ui/button'

/**
 * 404 (dirección "Línea"): la vía se corta en una estación que no existe.
 * Antes, cualquier ruta desconocida llevaba a la portada sin avisar.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-banda text-on-navy">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-lg text-lg" aria-label="NexoMark IA, ir a la portada">
            <BrandLogo tone="navy" />
          </Link>
          <ThemeToggle tone="navy" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        {/* La vía llega hasta aquí y se corta */}
        <div className="relative mb-12 flex items-center" aria-hidden="true">
          <span className="h-9 w-9 shrink-0 rounded-full bg-turquoise" />
          <span className="h-1.5 w-24 bg-turquoise sm:w-40" />
          <span className="h-1.5 w-6 bg-outline-variant" />
          <span className="ml-3 h-1.5 w-3 rounded-full bg-outline-variant" />
          <span className="ml-2 h-1.5 w-2 rounded-full bg-outline-variant" />
          <span className="ml-6 h-9 w-9 shrink-0 rounded-full border-[5px] border-dashed border-outline-variant" />
        </div>
        <p className="text-sm font-semibold text-on-surface-variant">Error 404</p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[46px]">
          Esta estación no existe
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-on-surface-variant">
          No encontramos <span className="break-all font-semibold text-on-surface">{pathname}</span>. Puede que el enlace esté mal escrito o que la
          página se haya movido.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/" size="lg">
            Ir a la portada
          </ButtonLink>
          <ButtonLink to="/login" size="lg" variant="outline">
            Iniciar sesión
          </ButtonLink>
        </div>
      </main>
    </div>
  )
}
