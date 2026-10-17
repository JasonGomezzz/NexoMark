import { Share2 } from 'lucide-react'
import instagramLogo from '@/assets/social/instagram.png'
import facebookLogo from '@/assets/social/facebook.png'

// lucide-react 1.x ya no incluye logos de marcas: se usan los mismos de la app Android.
const LOGOS = { instagram: instagramLogo, facebook: facebookLogo }

/** Marca de X en un solo color (currentColor): sigue el tema claro u oscuro sin colores nuevos. */
function LogoX({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function RedIcon({ red, className = 'h-4 w-4' }) {
  if (red === 'x') return <LogoX className={className} />
  const logo = LOGOS[red]
  if (!logo) return <Share2 className={className} aria-hidden="true" />
  return <img src={logo} alt="" aria-hidden="true" className={`${className} rounded-full object-cover`} />
}
