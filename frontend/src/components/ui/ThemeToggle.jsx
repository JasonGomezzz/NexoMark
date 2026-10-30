import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

/** Alterna claro/oscuro. La elección se guarda en localStorage (useTheme). */
export default function ThemeToggle({ className = '', tone = 'surface' }) {
  const { isDark, toggleTheme } = useTheme()
  const Icon = isDark ? Sun : Moon
  const label = isDark ? 'Activar tema claro' : 'Activar tema oscuro'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
        tone === 'navy'
          ? 'text-on-navy-muted hover:bg-banda-2 hover:text-on-navy'
          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  )
}
