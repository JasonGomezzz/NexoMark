import { Info } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import EnlaceLegal from '@/components/legal/EnlaceLegal'
import { cn } from '@/lib/utils'
import { GENERATION_CREDIT_COST, PLANS as CREDIT_PLANS, creditosConGeneraciones } from '@/lib/credits'

/**
 * Planes de lanzamiento (fuente: lib/credits.js ↔ backend services/credit_service.py).
 * Precios mensuales sin IGV. Agencia Plus se muestra como próximamente.
 * La pasarela es simulada: se rotula como precio de lanzamiento.
 */
const PLANS = CREDIT_PLANS.map((plan) => ({
  ...plan,
  precioTexto: `S/ ${plan.precio}`,
  periodo: 'al mes',
  cta: plan.disponible ? `Empezar con ${plan.nombre}` : 'Próximamente',
}))

// Cada fila compara los planes. null = no aplica todavía ("Sin definir").
const ROWS = [
  { label: 'Créditos de IA', values: PLANS.map((p) => `${creditosConGeneraciones(p.creditos)} al mes`) },
  { label: 'Contenido con IA', values: PLANS.map(() => 'Copy e imagen') },
  { label: 'Pensado para', values: PLANS.map((p) => p.para) },
  { label: 'Revisión del cliente en web y app', values: PLANS.map(() => 'Incluida') },
  { label: 'Publicar en varias redes', values: PLANS.map(() => 'Sin costo extra') },
]

function Value({ value, onNavy = false }) {
  if (value) return value
  return <span className={onNavy ? 'text-on-navy-muted' : 'text-on-surface-variant'}>Sin definir</span>
}

function DemoPrice() {
  return (
    <span className="demo-tag">
      <Info className="h-3 w-3" aria-hidden="true" />
      Precio de lanzamiento
    </span>
  )
}

function PlanCta({ plan, className }) {
  if (!plan.disponible) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          'inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-5 text-sm font-semibold text-on-surface-variant',
          className,
        )}
      >
        {plan.cta}
      </span>
    )
  }
  return (
    <ButtonLink to="/register" variant={plan.destacado ? 'onBrand' : 'outline'} className={className}>
      {plan.cta}
    </ButtonLink>
  )
}

export default function PricingSection() {
  return (
    <section id="precios" aria-labelledby="precios-title" className="scroll-mt-16 bg-surface-container-low px-4 py-24 sm:px-6 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-6 lg:grid-cols-12">
          <h2
            id="precios-title"
            className="text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-on-surface lg:col-span-5"
          >
            Planes por créditos
          </h2>
          <div className="lg:col-span-6 lg:col-start-7 lg:pt-2">
            <p className="max-w-[34rem] text-lg leading-relaxed text-on-surface">
              Generar o regenerar copy e imagen usa {GENERATION_CREDIT_COST} créditos. Editar, aprobar, consultar y
              publicar en varias redes no gastan créditos; si la IA falla, se devuelven.
            </p>
            <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-tertiary-container px-3 py-2 text-[15px] font-medium text-on-tertiary-container">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Precios de lanzamiento por mes, sin IGV. Pago simulado: todavía no hay cobro real.{' '}
                <EnlaceLegal clave="compras" className="text-inherit">Condiciones de compra</EnlaceLegal>
              </span>
            </p>
          </div>
        </div>

        {/* Escritorio: tabla comparativa */}
        <div className="mt-16 hidden overflow-hidden rounded-2xl bg-background lg:block">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Comparación de planes de lanzamiento</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[28%] p-8 align-bottom text-base font-medium text-on-surface-variant">
                  Plan
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.nombre}
                    scope="col"
                    className={cn('p-8 align-top font-normal', plan.destacado && 'bg-navy text-on-navy')}
                  >
                    <span className="block text-2xl font-bold">
                      {plan.nombre}
                      {plan.destacado && <span className="font-normal text-turquoise-soft"> · recomendado</span>}
                    </span>
                    <span className="mt-3 flex items-baseline gap-2">
                      <span className="text-4xl font-bold tabular-nums tracking-[-0.02em]">{plan.precioTexto}</span>
                      {plan.periodo && (
                        <span className={plan.destacado ? 'text-on-navy-muted' : 'text-on-surface-variant'}>{plan.periodo}</span>
                      )}
                    </span>
                    {plan.disponible && (
                      <span className="mt-3 block">
                        {plan.destacado ? (
                          <span className="demo-tag demo-tag-on-navy">
                            <Info className="h-3 w-3" aria-hidden="true" />
                            Precio de lanzamiento
                          </span>
                        ) : (
                          <DemoPrice />
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, r) => (
                <tr key={row.label} className={r % 2 === 0 ? 'bg-surface-container-low/60' : ''}>
                  <th scope="row" className="px-8 py-5 text-[17px] font-medium text-on-surface">
                    {row.label}
                  </th>
                  {row.values.map((value, i) => (
                    <td
                      key={PLANS[i].nombre}
                      className={cn(
                        'px-8 py-5 text-[17px]',
                        PLANS[i].destacado ? 'bg-navy text-on-navy' : 'text-on-surface',
                        !value && !PLANS[i].destacado && 'text-on-surface-variant',
                      )}
                    >
                      <Value value={value} onNavy={PLANS[i].destacado} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-8" />
                {PLANS.map((plan) => (
                  <td key={plan.nombre} className={cn('p-8', plan.destacado && 'bg-navy')}>
                    <PlanCta plan={plan} className="w-full" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Teléfono y tableta: un bloque por plan */}
        <div className="mt-12 grid gap-2 sm:gap-3 md:grid-cols-3 lg:hidden">
          {PLANS.map((plan, p) => (
            <article
              key={plan.nombre}
              className={cn('rounded-2xl p-6', plan.destacado ? 'bg-navy text-on-navy' : 'bg-background text-on-surface')}
            >
              <h3 className="text-2xl font-bold">
                {plan.nombre}
                {plan.destacado && <span className="font-normal text-turquoise-soft"> · recomendado</span>}
              </h3>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums tracking-[-0.02em]">{plan.precioTexto}</span>
                {plan.periodo && <span className={plan.destacado ? 'text-on-navy-muted' : 'text-on-surface-variant'}>{plan.periodo}</span>}
              </p>
              {plan.disponible && (
                <p className="mt-2">
                  <span className={cn('demo-tag', plan.destacado && 'demo-tag-on-navy')}>
                    <Info className="h-3 w-3" aria-hidden="true" />
                    Precio de lanzamiento
                  </span>
                </p>
              )}
              <dl className="mt-6 space-y-3">
                {ROWS.map((row) => (
                  <div key={row.label}>
                    <dt className={cn('text-[15px]', plan.destacado ? 'text-on-navy-muted' : 'text-on-surface-variant')}>{row.label}</dt>
                    <dd className="text-[17px] font-medium">
                      <Value value={row.values[p]} onNavy={plan.destacado} />
                    </dd>
                  </div>
                ))}
              </dl>
              <PlanCta plan={plan} className="mt-6 w-full" />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
