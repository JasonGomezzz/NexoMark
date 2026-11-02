import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS as CREDIT_PLANS } from '@/lib/credits'

/**
 * Precios por CUOTA DE TOKENS de IA (1 crédito = 1 generación).
 * Coherente con el backend: sin video AI, sin features inventadas.
 */
const PLANS = [
  {
    nombre: CREDIT_PLANS[0].nombre,
    precio: `S/ ${CREDIT_PLANS[0].precio}`,
    periodo: '/mes',
    destacado: false,
    features: [
      { txt: `${CREDIT_PLANS[0].creditos} créditos de IA al mes`, ok: true },
      { txt: 'Texto e imagen con IA según saldo', ok: true },
      { txt: '1 usuario marketero', ok: true },
      { txt: 'Analytics avanzado', ok: false },
    ],
    cta: `Elegir ${CREDIT_PLANS[0].nombre}`,
  },
  {
    nombre: CREDIT_PLANS[1].nombre,
    precio: `S/ ${CREDIT_PLANS[1].precio}`,
    periodo: '/mes',
    destacado: true,
    features: [
      { txt: `${CREDIT_PLANS[1].creditos} créditos de IA`, ok: true },
      { txt: 'Copy e imágenes con IA', ok: true },
      { txt: 'Revisión y aprobación del cliente', ok: true },
      { txt: 'App de aprobación para clientes', ok: true },
    ],
    cta: `Empezar con ${CREDIT_PLANS[1].nombre}`,
  },
  {
    nombre: CREDIT_PLANS[2].nombre,
    precio: `S/ ${CREDIT_PLANS[2].precio}`,
    periodo: '/mes',
    destacado: false,
    features: [
      { txt: `${CREDIT_PLANS[2].creditos} créditos de IA`, ok: true },
      { txt: 'Estadísticas de publicaciones disponibles', ok: true },
      { txt: 'Historial de versiones', ok: true },
      { txt: 'Revisión y aprobación del cliente', ok: true },
    ],
    cta: `Elegir ${CREDIT_PLANS[2].nombre}`,
  },
]

export default function PricingSection() {
  return (
    <section id="precios" className="mx-auto max-w-[1440px] px-6 py-24 md:px-10">
      <div className="mb-16 text-center">
        <h2 className="mb-4 text-4xl font-bold tracking-tight text-on-surface text-balance">
          Planes flexibles por créditos
        </h2>
        <p className="mx-auto max-w-xl text-base text-on-surface-variant">
          Pagas solo por lo que generas. Cada propuesta de texto e imagen estándar consume 4 créditos de
          IA. Los pagos y la contratación de planes se muestran como demostración.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">Precios mensuales sin IGV.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.nombre}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={
              plan.destacado
                ? 'relative flex scale-105 flex-col items-center rounded-3xl bg-primary p-10 text-on-primary shadow-2xl'
                : 'glass-card flex flex-col items-center rounded-3xl border border-outline-variant p-10'
            }
          >
            {plan.destacado && (
              <div className="absolute -top-4 rounded-full bg-tertiary px-4 py-1 text-xs font-bold uppercase tracking-wider text-on-tertiary">
                Más popular
              </div>
            )}
            <h3
              className={
                plan.destacado
                  ? 'mb-2 text-2xl font-semibold'
                  : 'mb-2 text-2xl font-semibold text-on-surface'
              }
            >
              {plan.nombre}
            </h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tabular-nums">{plan.precio}</span>
              <span className={plan.destacado ? 'text-on-primary/80' : 'text-on-surface-variant'}>
                {plan.periodo}
              </span>
            </div>
            <ul className="mb-10 w-full space-y-4">
              {plan.features.map((f) => (
                <li
                  key={f.txt}
                  className={
                    f.ok
                      ? 'flex items-center gap-3'
                      : plan.destacado
                        ? 'flex items-center gap-3 opacity-60'
                        : 'flex items-center gap-3 text-outline-variant'
                  }
                >
                  {f.ok ? (
                    <Check
                      className={plan.destacado ? 'h-5 w-5 shrink-0' : 'h-5 w-5 shrink-0 text-primary'}
                    />
                  ) : (
                    <X className="h-5 w-5 shrink-0" />
                  )}
                  <span className="text-sm">{f.txt}</span>
                </li>
              ))}
            </ul>
            <Link to="/login" className="mt-auto w-full">
              <Button
                variant={plan.destacado ? 'light' : 'outline'}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
