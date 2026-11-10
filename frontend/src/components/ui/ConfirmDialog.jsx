import { useEffect, useId, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Confirmación modal sobre <dialog> nativo: el navegador atrapa el foco, deja el
 * resto de la página inerte y cierra con Esc, sin código extra. En móvil sube
 * desde abajo como una hoja; en escritorio queda centrado.
 *
 * El foco entra en «Cancelar»: confirmar exige un gesto a propósito. Mientras
 * `ocupado` la acción sigue en curso y el diálogo no se puede cerrar (un spinner
 * en el botón basta: es una acción corta, no una carga de pantalla).
 * El estado vive en quien lo usa: `open`, `onConfirm` y `onCancel`.
 */
export default function ConfirmDialog({
  open,
  titulo,
  descripcion,
  icono: Icono,
  confirmar = 'Confirmar',
  cancelar = 'Cancelar',
  textoOcupado,
  ocupado = false,
  onConfirm,
  onCancel,
}) {
  const dialogo = useRef(null)
  const botonCancelar = useRef(null)
  const idTitulo = useId()
  const idDescripcion = useId()

  useEffect(() => {
    const nodo = dialogo.current
    if (!nodo) return
    if (open && !nodo.open) {
      nodo.showModal()
      botonCancelar.current?.focus()
    }
    if (!open && nodo.open) nodo.close()
  }, [open])

  // La página de atrás no se desplaza mientras el diálogo está abierto.
  useEffect(() => {
    if (!open) return undefined
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previo
    }
  }, [open])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idDescripcion}
      // Esc: lo gestiona el estado de quien lo usa, no el navegador.
      onCancel={(evento) => {
        evento.preventDefault()
        if (!ocupado) onCancel()
      }}
      // Un clic en la cortina (el propio <dialog>, no su contenido) cancela.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) onCancel()
      }}
      className="dialogo entra-hoja m-0 mt-auto max-h-[92dvh] w-full max-w-none bg-transparent p-0 text-on-surface backdrop:bg-navy-deep/60 sm:m-auto sm:max-w-md"
    >
      <div className="rounded-t-[22px] border border-outline-variant bg-surface-container-lowest p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-[22px] sm:p-8">
        {Icono && (
          <span
            className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-primary-fixed text-on-primary-fixed"
            aria-hidden="true"
          >
            <Icono className="h-6 w-6" />
          </span>
        )}
        <h2 id={idTitulo} className="font-display text-2xl font-extrabold text-on-surface">
          {titulo}
        </h2>
        <p id={idDescripcion} className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
          {descripcion}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={botonCancelar} type="button" variant="outline" onClick={onCancel} disabled={ocupado}>
            {cancelar}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={ocupado}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {ocupado ? (textoOcupado ?? confirmar) : confirmar}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
