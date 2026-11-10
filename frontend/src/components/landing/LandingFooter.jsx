import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { DOCUMENTOS_LEGALES, urlLegal } from '@/lib/legal'

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#ejemplos', label: 'Ejemplos' },
  { href: '#precios', label: 'Precios' },
]

/**
 * Cierre de la portada: una acción final y el nombre de la marca a todo lo
 * ancho sobre el azul marino del icono.
 */
export default function LandingFooter() {
  return (
    <footer className="px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="mx-auto max-w-[1440px]">
        {/* Acción final */}
        <section
          aria-labelledby="cta-title"
          className="grid gap-8 rounded-2xl bg-primary px-6 py-14 text-on-primary sm:px-10 lg:grid-cols-12 lg:items-end lg:px-14 lg:py-20"
        >
          <div className="lg:col-span-8">
            <h2 id="cta-title" className="text-[clamp(2rem,4.2vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
              Dicta tu primera campaña hoy
            </h2>
            <p className="mt-4 max-w-[36rem] text-lg leading-relaxed">
              Crea tu cuenta, conecta las redes de tu cliente y prueba el flujo completo con 100 créditos de IA.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            <ButtonLink to="/register" variant="onBrand" size="lg">
              Crear cuenta
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>

        {/* Pie */}
        <div className="mt-2 overflow-hidden rounded-2xl bg-navy px-6 pt-12 text-on-navy sm:mt-3 sm:px-10 lg:px-14 lg:pt-16">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <p className="max-w-sm text-[15px] leading-relaxed text-on-navy-muted">
              Campañas creadas desde la voz, aprobadas por el cliente y publicadas en Instagram y Facebook.
            </p>
            <nav aria-label="Pie de página" className="grid grid-cols-2 gap-x-10 gap-y-3 text-[15px] sm:grid-cols-3">
              {LINKS.map((link) => (
                <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-on-navy-muted transition-colors hover:text-on-navy">
                  {link.label}
                </a>
              ))}
              <Link to="/login" className="inline-flex min-h-11 items-center text-on-navy-muted transition-colors hover:text-on-navy">
                Iniciar sesión
              </Link>
              <Link to="/register" className="inline-flex min-h-11 items-center text-on-navy-muted transition-colors hover:text-on-navy">
                Crear cuenta
              </Link>
            </nav>
          </div>

          {/* El nombre, construido a lo ancho */}
          <div className="mt-14 flex items-end gap-[1.5vw] lg:mt-20" aria-hidden="true">
            <img src="/nexomark-icon-192.png" alt="" className="h-[11vw] max-h-40 w-[11vw] max-w-40 translate-y-[6%]" />
            <span className="text-[clamp(3.5rem,15.5vw,14.5rem)] font-extrabold leading-[0.78] tracking-[-0.05em]">
              NexoMark
            </span>
          </div>
          <nav aria-label="Documentos legales" className="mt-6 flex flex-wrap gap-x-6 border-t border-cama-line pt-2 text-[13px]">
            {DOCUMENTOS_LEGALES.map(({ clave, titulo }) => (
              <a
                key={clave}
                href={urlLegal(clave)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-on-navy-muted transition-colors hover:text-on-navy"
              >
                {titulo}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-8 pt-2 text-[13px] text-on-navy-muted">
            <span>© {new Date().getFullYear()} NexoMark IA</span>
            <span>Proyecto académico de Tecsup · la compra de créditos es simulada</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
