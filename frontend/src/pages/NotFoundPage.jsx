import { Link, useLocation } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { ButtonLink } from '@/components/ui/button'

/**
 * 404 (dirección "Conforme"): un pliego sobre la mesa con su orden de trabajo
 * en blanco, cinco casillas sin sellar. Antes, cualquier ruta desconocida
 * llevaba a la portada sin avisar.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-cama px-2 pb-2 text-on-navy sm:px-5 sm:pb-5">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-2 sm:px-1">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-[10px]" aria-label="NexoMark IA, ir a la portada">
          <BrandLogo tone="navy" />
        </Link>
        <ThemeToggle tone="navy" />
      </header>
      <main className="relative mx-auto max-w-5xl rounded-[14px] bg-background px-5 py-14 text-on-surface sm:rounded-[18px] sm:px-12 sm:py-20">
        <span className="corte corte-a hidden sm:block" aria-hidden="true" />
        <span className="corte corte-b hidden sm:block" aria-hidden="true" />
        <span className="corte corte-c hidden sm:block" aria-hidden="true" />
        <span className="corte corte-d hidden sm:block" aria-hidden="true" />

        {/* Una orden en blanco: ninguna casilla sellada */}
        <div className="mb-10 flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="casilla casilla-pliego h-9 w-9" />
          ))}
        </div>
        <p className="text-sm font-semibold text-on-surface-variant">Error 404</p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-on-surface sm:text-[46px]">
          Esta página no existe
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
