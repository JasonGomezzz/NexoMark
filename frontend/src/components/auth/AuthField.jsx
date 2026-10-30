import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Campo de los formularios de acceso: etiqueta visible, borde con contraste
 * 3:1 (color outline), error anunciado y alto táctil de 48px.
 * Con `type="password"` añade el botón para mostrar u ocultar.
 */
const AuthField = forwardRef(function AuthField(
  { id, label, error, type = 'text', aside, hint, className, ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-on-surface">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-[10px] border bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition-[border-color,box-shadow] duration-150',
            'focus:border-primary focus:ring-2 focus:ring-primary/30',
            isPassword && 'pr-12',
            error ? 'border-error' : 'border-outline',
          )}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-error">
          {error}
        </p>
      )}
    </div>
  )
})

export default AuthField
