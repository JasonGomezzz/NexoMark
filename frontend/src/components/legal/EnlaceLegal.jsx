import { cn } from '@/lib/utils'
import { documentoLegal, urlLegal } from '@/lib/legal'

/**
 * Enlace a un documento legal (lib/legal.js). Se abre en otra pestaña para no
 * sacarte de un formulario a medias o de un pago a medias. Sin hijos, muestra
 * el título del documento.
 */
export default function EnlaceLegal({ clave, children, className }) {
  return (
    <a
      href={urlLegal(clave)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'font-medium text-primary underline underline-offset-2 transition-colors hover:text-on-surface focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      {children ?? documentoLegal(clave).titulo}
    </a>
  )
}
