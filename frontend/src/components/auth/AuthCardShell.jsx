import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'

/**
 * Marco de las pantallas públicas pequeñas de autenticación (recuperar y
 * restablecer contraseña, confirmar correo): la banda marina de la línea
 * arriba y el formulario sobre el fondo, abierto por la regla de 6 px.
 */
export default function AuthCardShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-banda text-on-navy">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-3 sm:px-6">
          <Link
            to="/login"
            aria-label="Volver al login"
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-on-navy-muted transition-colors hover:bg-banda-2 hover:text-on-navy"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Volver al login</span>
          </Link>
          <Link to="/" className="mx-auto rounded-lg text-lg" aria-label="NexoMark IA, ir al inicio">
            <BrandLogo tone="navy" />
          </Link>
          <ThemeToggle tone="navy" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
        <section className="regla pt-7">
          <h1 className="text-[2rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface">{title}</h1>
          {subtitle && <p className="mt-3 text-base text-on-surface-variant">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </section>
      </main>
    </div>
  )
}
