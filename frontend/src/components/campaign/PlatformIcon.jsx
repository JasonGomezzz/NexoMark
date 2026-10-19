import { useId } from 'react'

/** Decorative brand marks: the adjacent label supplies the accessible name. */
export default function PlatformIcon({ platform, className = '' }) {
  const gradientId = useId()
  const common = { viewBox: '0 0 24 24', width: 22, height: 22,
    'aria-hidden': true, focusable: 'false', className: `shrink-0 ${className}` }

  switch (platform) {
    case 'instagram':
      return <svg {...common}>
        <defs><linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FCAF45" /><stop offset="45%" stopColor="#E1306C" /><stop offset="100%" stopColor="#833AB4" />
        </linearGradient></defs>
        <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#${gradientId})`} />
        <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="white" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="white" strokeWidth="1.7" />
        <circle cx="16.4" cy="7.8" r="1" fill="white" />
      </svg>
    case 'facebook':
      return <svg {...common}>
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path fill="white" d="M13.7 23v-8.5h2.9l.5-3.3h-3.4V9.1c0-.9.4-1.7 1.8-1.7h1.8V4.6s-1.6-.3-3-.3c-3 0-4.7 1.8-4.7 4.9v2H6.7v3.3h2.9V23z" />
      </svg>
    case 'twitter':
      return <svg {...common} fill="currentColor">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l8.1-9.3L2.8 2h6.4l4.4 6.7L18.9 2Zm-1.1 18h1.7L8.3 4H6.5l11.3 16Z" />
      </svg>
    case 'linkedin':
      return <svg {...common}>
        <rect x="1" y="1" width="22" height="22" rx="2.5" fill="#0A66C2" />
        <circle cx="6.4" cy="6.4" r="1.7" fill="white" />
        <path fill="white" d="M4.9 9.3h3V19h-3zM10.1 9.3H13v1.3c.6-1 1.6-1.6 3-1.6 3 0 3.6 2 3.6 4.6V19h-3v-4.8c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V19h-2.9z" />
      </svg>
    case 'tiktok':
      return <svg {...common}>
        <path d="M14 3h3c.3 2.4 1.7 3.8 4 4v3c-1.5 0-2.9-.4-4-1.2v7.4a5.8 5.8 0 1 1-5.8-5.8v3a2.8 2.8 0 1 0 2.8 2.8V3Z" fill="#25F4EE" transform="translate(-.6 -.5)" />
        <path d="M14 3h3c.3 2.4 1.7 3.8 4 4v3c-1.5 0-2.9-.4-4-1.2v7.4a5.8 5.8 0 1 1-5.8-5.8v3a2.8 2.8 0 1 0 2.8 2.8V3Z" fill="#FE2C55" transform="translate(.6 .5)" />
        <path d="M14 3h3c.3 2.4 1.7 3.8 4 4v3c-1.5 0-2.9-.4-4-1.2v7.4a5.8 5.8 0 1 1-5.8-5.8v3a2.8 2.8 0 1 0 2.8 2.8V3Z" fill="currentColor" />
      </svg>
    default:
      return null
  }
}
