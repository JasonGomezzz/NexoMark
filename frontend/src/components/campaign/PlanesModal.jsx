import CreditRequestButton from '@/components/campaign/CreditRequestButton'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, X, Coins, Loader2, CircleCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '../../services/api'
import { PLANS } from '@/lib/credits'

/**
 * Modal de planes de créditos — réplica fiel de Stitch
 * planes_de_cr_ditos_consistencia_lumina (overlay liquid glass a pantalla
 * completa con 3 cards de precio). Pasarela de pago SIMULADA: "Seleccionar
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-liquid relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl px-6 py-10 text-center sm:px-12"
      >
        <button
          onClick={handleClose}
          aria-label="Cerrar planes"
          className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-5 w-5" />
        </button>

        {!checkoutPlan ? (
          <>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-error-container px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-error">
              <AlertTriangle className="h-3.5 w-3.5" />
              Créditos agotados
            </span>

            <h2
              id="planes-title"
              className="mx-auto mb-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-on-surface sm:text-4xl text-balance"
            >
              Tu potencial no tiene límites, pero tus <span className="text-primary">créditos</span> sí.
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-base text-on-surface-variant">
              Has alcanzado el límite de tu plan actual. Recarga{' '}
              <strong className="text-on-surface">Créditos de IA</strong> para continuar
              transformando tus ideas en campañas de alto impacto.
            </p>

            {/* Cards de precio */}
            <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-stretch">
              {PLANS.map((plan) => (
                <div
                  key={plan.nombre}
                  className={`relative flex flex-col items-center rounded-2xl p-8 ${
                    plan.popular
                      ? 'border-2 border-primary bg-white shadow-xl'
                      : 'border border-outline-variant/60 bg-surface-container-lowest shadow-sm'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-4 rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-primary shadow-lg">
                      Más popular
                    </span>
                  )}
                  <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-on-surface">
                    {plan.nombre}
                  </p>
                  <p className="mb-1 text-4xl font-extrabold tabular-nums text-on-surface">
                    <span className="mr-1 align-top text-base font-semibold">S/</span>
                    {plan.precio}
                  </p>
                  <p className="mb-2 text-xs text-on-surface-variant">Al mes · sin IGV</p>
                  <p className="mb-6 text-sm font-medium text-primary">
                    {plan.creditos} Créditos de IA
                  </p>
                  <Button
                    variant={plan.popular ? 'default' : 'secondary'}
                    className="mt-auto w-full"
                    onClick={() => setCheckoutPlan(plan)}
                  >
                    {plan.popular ? 'Seleccionar Plan' : 'Seleccionar'}
                  </Button>
                </div>
              ))}
            </div>

            {/* Acciones secundarias */}
            <div className="mb-6 flex flex-col items-center justify-center gap-3 border-t border-outline-variant/50 pt-6 sm:flex-row sm:gap-8">
              <CreditRequestButton />
              <button
                onClick={() => {
                  handleClose()
                  navigate('/settings')
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <Coins className="h-4 w-4" />
                Ver mis créditos
              </button>
            </div>

            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant/70">
              Seguridad garantizada mediante pasarelas de pago locales
            </p>
          </>
        ) : step === 'exito' ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
              <CircleCheck className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">Pago aprobado</h2>
            <p className="max-w-sm text-sm text-on-surface-variant">
              Se añadieron {checkoutPlan.creditos} créditos de IA a tu cuenta (plan{' '}
              {checkoutPlan.nombre}).
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-left">
            <button
              onClick={() => setCheckoutPlan(null)}
              disabled={step === 'procesando'}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
            >
              ← Volver a los planes
            </button>

            <div className="mb-6 flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-on-surface">Plan {checkoutPlan.nombre}</p>
                <p className="text-sm text-on-surface-variant">{checkoutPlan.creditos} Créditos de IA</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums text-on-surface">
                <span className="mr-1 align-top text-sm font-semibold">S/</span>
                {checkoutPlan.precio}
              </p>
            </div>
            <p className="mb-4 text-sm text-on-surface-variant">Precio mensual sin IGV. Esta demostración no realiza cargos.</p>

            <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-on-surface">
              <CreditCard className="h-4 w-4 text-primary" />
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
                  className="w-full rounded-lg border border-outline-variant px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
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
                  className="w-full rounded-lg border border-outline-variant px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
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
                    className="w-full rounded-lg border border-outline-variant px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
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
                    className="w-full rounded-lg border border-outline-variant px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
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

            <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant/70">
              Pasarela de pago simulada — no se procesa ningún cargo real
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
