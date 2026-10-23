import { useState } from 'react'
import { cn } from '@/lib/utils'
import { iniciales } from '../../services/cuenta'

/**
 * Avatar circular: la foto de perfil o, sin foto, las iniciales. Si la imagen no
 * carga se vuelve a las iniciales. `tono="navy"` para la barra lateral marina.
 */
export default function Avatar({ nombre, src, className, tono = 'claro', alt }) {
  const [fallo, setFallo] = useState(null)
  const conFoto = Boolean(src) && fallo !== src

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none',
        tono === 'navy' ? 'bg-turquoise text-navy' : 'bg-primary text-on-primary',
        className,
      )}
      aria-hidden={alt ? undefined : 'true'}
    >
      {conFoto ? (
        <img src={src} alt={alt ?? ''} className="h-full w-full object-cover" onError={() => setFallo(src)} />
      ) : (
        iniciales(nombre)
      )}
    </span>
  )
}
