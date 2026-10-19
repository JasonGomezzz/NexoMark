import { useEffect, useState } from 'react'
import api from '@/services/api'

export default function ProfileAvatar({ name = '', preview = '', remove = false, className = 'h-10 w-10 text-sm' }) {
  const [src, setSrc] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('profile-updated', refresh)
    return () => window.removeEventListener('profile-updated', refresh)
  }, [])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    api.get('/api/auth/me/avatar/', { responseType: 'blob' }).then(({ data, status }) => {
      if (!active) return
      if (status === 200 && data.size > 0) objectUrl = URL.createObjectURL(data)
      setSrc(objectUrl)
    }).catch(() => { if (active) setSrc('') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [revision])
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'
  const image = remove ? '' : preview || src
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-on-primary ${className}`}>
    {image ? <img src={image} alt={preview ? 'Vista previa de tu foto de perfil' : `Foto de perfil de ${name || 'usuario'}`} className="h-full w-full object-cover" onError={() => setSrc('')} /> : <span aria-label={`Perfil de ${name || 'usuario'}`}>{initials}</span>}
  </div>
}
