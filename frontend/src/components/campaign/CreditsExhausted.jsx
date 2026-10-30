import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppToaster from '@/components/ui/AppToaster'
import PlanesModal from '@/components/campaign/PlanesModal'
import CreditRequestButton from '@/components/campaign/CreditRequestButton'
import { PLANS } from '@/lib/credits'

/**
 * Estado "Créditos agotados" (portado de Stitch: ai_generation_credits_notice).
 * Se muestra cuando el backend devuelve HTTP 402 (tokens_disponibles == 0).
 * El reset lo hace el SuperAdmin (PATCH /api/admin/users/{id}/reset-quota/);
 * el marketero puede pedir créditos (CreditRequestButton) y el superadmin
 * aprueba o rechaza la solicitud. "Elegir plan" abre PlanesModal (compra
 * simulada); PLANS vive en lib/credits.js (fuente única compartida con el modal).
 */
export default function CreditsExhausted({ onClose }) {
  const [showPlanes, setShowPlanes] = useState(false)

  return (
    <div className="glass-soft glass-float rounded-xl p-6 shadow-sm">
      <AppToaster />
      <PlanesModal open={showPlanes} onClose={() => setShowPlanes(false)} />
      <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-error-container px-3 py-1 text-[13px] font-bold text-error">
        <AlertTriangle className="h-3.5 w-3.5" />
        Créditos agotados
      </span>

      <h2 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-on-surface text-balance">
        Tu potencial no tiene límites, <span className="text-primary">pero tus créditos sí.</span>
      </h2>
      <p className="mb-6 text-sm text-on-surface-variant">
        Alcanzaste el límite de tu plan. Recarga créditos para seguir generando campañas
        sin interrupciones.
      </p>

      <div className="mb-6 space-y-3">
        {PLANS.map((plan) => (
          <div
            key={plan.nombre}
            className={`flex items-center justify-between rounded-xl border p-4 ${
              plan.popular
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-outline-variant'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-on-surface">
                  {plan.nombre}
                </span>
                {plan.popular && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[13px] font-bold text-on-primary">
                    Más popular
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">{plan.creditos} créditos</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-on-surface">
                S/ {plan.precio}
              </p>
              <Button
                size="sm"
                variant={plan.popular ? 'default' : 'outline'}
                className="mt-1"
                onClick={() => setShowPlanes(true)}
              >
                Elegir plan
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center border-t border-outline-variant pt-4 text-center">
        <CreditRequestButton />
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Volver al formulario
        </button>
      )}
    </div>
  )
}
