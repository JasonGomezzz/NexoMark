import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Info, X, Coins, Loader2, CircleCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '../../services/api'
import CreditRequestButton from '@/components/campaign/CreditRequestButton'
import { GENERATION_CREDIT_COST, PLANS, creditosConGeneraciones } from '@/lib/credits'

/**
 * Modal de planes de créditos (overlay a pantalla completa con 3 cards de
 * precio). Pasarela de pago SIMULADA: "Seleccionar
 * Plan" abre un checkout ficticio (tarjeta no validada contra ningún
 * procesador real) que llama a POST /api/campaigns/credits/purchase/,
 * el cual siempre aprueba y suma créditos reales al usuario.
 * Trigger ÚNICO: los botones "Elegir plan" de CreditsExhausted.
 */
export default function PlanesModal({ open, onClose }) {
  const navigate = useNavigate()
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const [step, setStep] = useState('form') // 'form' | 'procesando' | 'exito'
  const [card, setCard] = useState({ numero: '', vencimiento: '', cvc: '', nombre: '' })

  // Resetea el estado interno del checkout al cerrar (X, overlay, Esc, o tras
  // el éxito de la compra) — se hace en el propio handler de cierre, no en un
  // efecto, para no disparar setState síncrono durante el render de cierre.
  const handleClose = useCallback(() => {
    setCheckoutPlan(null)
    setStep('form')
    setCard({ numero: '', vencimiento: '', cvc: '', nombre: '' })
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  if (!open) return null

  const cardValid =
    /^\d{4} \d{4} \d{4} \d{4}$/.test(card.numero) &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.vencimiento) &&
    /^\d{3}$/.test(card.cvc) &&
    card.nombre.trim().length >= 3

  async function confirmarPago() {
    if (!checkoutPlan || !cardValid) return
    setStep('procesando')
    try {
      await api.post('/api/campaigns/credits/purchase/', { plan: checkoutPlan.key })
      setStep('exito')
      window.dispatchEvent(new Event('credits-updated'))
      toast.success('Créditos añadidos')
      setTimeout(() => handleClose(), 1200)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo procesar el pago. Intenta de nuevo.')
      setStep('form')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="planes-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="entra-hoja relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[22px] border border-outline-variant bg-surface-container-lowest px-6 py-10 shadow-xl sm:px-12"
      >
        <button
          onClick={handleClose}
          aria-label="Cerrar planes"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {!checkoutPlan ? (
          <>
            <span className="demo-tag">
              <Info className="h-3 w-3" aria-hidden="true" />
              Precios de lanzamiento · sin IGV · pasarela simulada
            </span>
            <h2
              id="planes-title"
              className="mt-4 max-w-2xl text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[36px]"
            >
              Planes de créditos
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-on-surface-variant">
              Generar o regenerar copy e imagen usa {GENERATION_CREDIT_COST} créditos. Completar la ficha, editar, aprobar,
              restaurar versiones y publicar en varias redes no gastan.
            </p>

            {/* Planes en una plancha: columnas separadas por un hilo, sin tarjetas */}
            <div className="mt-8 grid grid-cols-1 border-y border-outline-variant sm:grid-cols-3">
              {PLANS.map((plan, i) => (
                <div
                  key={plan.nombre}
                  className={`flex flex-col py-6 sm:px-6 ${i > 0 ? 'border-t border-hairline sm:border-l sm:border-t-0' : 'sm:pl-0'} ${i === PLANS.length - 1 ? 'sm:pr-0' : ''}`}
                >
                  <p className="flex items-center gap-2 font-display text-lg font-extrabold text-on-surface">
                    {plan.nombre}
                    {plan.destacado && (
                      <span className="rounded-[6px] bg-primary-fixed px-2 py-0.5 font-sans text-[12px] font-semibold text-on-primary-fixed">
                        Sugerido
                      </span>
                    )}
                  </p>
                  <p className="cifra mt-3 text-[44px] tabular-nums text-on-surface">
                    <span className="mr-1 align-top font-sans text-base font-semibold">S/</span>
                    {plan.precio}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">{creditosConGeneraciones(plan.creditos)} al mes</p>
                  <p className="mt-1 text-[13px] text-on-surface-variant">{plan.para}</p>
                  <Button
                    variant={plan.destacado ? 'default' : 'outline'}
                    className="mt-5 w-full"
                    disabled={!plan.disponible}
                    onClick={() => plan.disponible && setCheckoutPlan(plan)}
                  >
                    {plan.disponible ? `Elegir ${plan.nombre}` : 'Próximamente'}
                  </Button>
                </div>
              ))}
            </div>

            {/* Acciones secundarias */}
            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              <CreditRequestButton />
              <button
                onClick={() => {
                  handleClose()
                  navigate('/credits')
                }}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <Coins className="h-4 w-4" aria-hidden="true" />
                Ver mis créditos
              </button>
            </div>
          </>
        ) : step === 'exito' ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
              <CircleCheck className="h-9 w-9" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">Pago aprobado</h2>
            <p className="max-w-sm text-sm text-on-surface-variant">
              Se añadieron {creditosConGeneraciones(checkoutPlan.creditos)} a tu cuenta (plan{' '}
              {checkoutPlan.nombre}).
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-left">
            <button
              onClick={() => setCheckoutPlan(null)}
              disabled={step === 'procesando'}
              className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
            >
              ← Volver a los planes
            </button>

            <div className="mb-6 flex items-center justify-between border-y border-outline-variant py-4">
              <div>
                <p className="text-sm font-semibold text-on-surface">Plan {checkoutPlan.nombre}</p>
                <p className="text-sm text-on-surface-variant">{creditosConGeneraciones(checkoutPlan.creditos)} · al mes, sin IGV</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums text-on-surface">
                <span className="mr-1 align-top text-sm font-semibold">S/</span>
                {checkoutPlan.precio}
              </p>
            </div>

            <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-on-surface">
              <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
              Datos de la tarjeta
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="card-nombre" className="mb-1 block px-1 text-sm font-medium text-on-surface-variant">
                  Nombre del titular
                </label>
                <input
                  id="card-nombre"
                  type="text"
                  placeholder="Como aparece en la tarjeta"
                  value={card.nombre}
                  onChange={(e) => setCard((c) => ({ ...c, nombre: e.target.value }))}
                  className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label htmlFor="card-numero" className="mb-1 block px-1 text-sm font-medium text-on-surface-variant">
                  Número de tarjeta
                </label>
                <input
                  id="card-numero"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  value={card.numero}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      numero: e.target.value
                        .replace(/[^\d]/g, '')
                        .slice(0, 16)
                        .replace(/(.{4})/g, '$1 ')
                        .trim(),
                    }))
                  }
                  className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="card-venc" className="mb-1 block px-1 text-sm font-medium text-on-surface-variant">
                    Vencimiento
                  </label>
                  <input
                    id="card-venc"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    maxLength={5}
                    value={card.vencimiento}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                      const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                      setCard((c) => ({ ...c, vencimiento: formatted }))
                    }}
                    className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="card-cvc" className="mb-1 block px-1 text-sm font-medium text-on-surface-variant">
                    CVC
                  </label>
                  <input
                    id="card-cvc"
                    type="text"
                    inputMode="numeric"
                    placeholder="123"
                    maxLength={3}
                    value={card.cvc}
                    onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/[^\d]/g, '').slice(0, 3) }))}
                    className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={confirmarPago}
              disabled={!cardValid || step === 'procesando'}
              className="mt-6 w-full"
              size="lg"
            >
              {step === 'procesando' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Procesando pago…
                </>
              ) : (
                `Pagar S/ ${checkoutPlan.precio}`
              )}
            </Button>

            <p className="mt-4 text-center text-[13px] font-medium text-on-surface-variant">
              Pasarela de pago simulada — no se procesa ningún cargo real
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
