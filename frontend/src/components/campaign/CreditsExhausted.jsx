import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppToaster from '@/components/ui/AppToaster'
import PlanesModal from '@/components/campaign/PlanesModal'
import CreditRequestButton from '@/components/campaign/CreditRequestButton'
import { GENERATION_CREDIT_COST } from '@/lib/credits'

/**
 * Estado "Créditos agotados" (portado de Stitch: ai_generation_credits_notice).
 * Se muestra cuando el backend devuelve HTTP 402 (el saldo no cubre una generación).
 * El reset lo hace el SuperAdmin (PATCH /api/admin/users/{id}/reset-quota/);
 * el marketero puede pedir créditos (CreditRequestButton) y el superadmin
 * aprueba o rechaza la solicitud. "Elegir plan" abre PlanesModal (compra
 * simulada); PLANS vive en lib/credits.js (fuente única compartida con el modal).
 */
export default function CreditsExhausted({ onClose }) {
  const [showPlanes, setShowPlanes] = useState(false)

  return (
    <section className="regla pt-6" aria-labelledby="sin-creditos">
      <AppToaster />
      <PlanesModal open={showPlanes} onClose={() => setShowPlanes(false)} />
      <p className="flex items-center gap-2 text-sm font-semibold text-error">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Saldo insuficiente
      </p>
      <h2 id="sin-creditos" className="mt-2 text-[26px] font-extrabold leading-tight text-on-surface">
        Te quedaste sin créditos
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-on-surface-variant">
        Cada generación usa {GENERATION_CREDIT_COST} créditos. Elige un plan o pide más al administrador: cuando apruebe la
        solicitud, podrás generar de nuevo.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CreditRequestButton />
        <Button variant="outline" onClick={() => setShowPlanes(true)}>
          Ver planes
        </Button>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Volver a la ficha
        </button>
      )}
    </section>
  )
}
