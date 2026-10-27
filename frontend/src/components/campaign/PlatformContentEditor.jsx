import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { getPlatformCopy } from '../../services/campaignPublication'
import { Button } from '../ui/button'
import PlatformIcon from './PlatformIcon'

const LABELS = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'Twitter / X', linkedin: 'LinkedIn (retirada)', google_ads: 'Google Ads (retirada)', tiktok: 'TikTok' }

export default function PlatformContentEditor({ campaign, onSaved, onDirty, onPrepareX, disabled = false }) {
  const platforms = campaign.plataformas?.length ? campaign.plataformas : [campaign.plataforma]
  const [copies, setCopies] = useState(() => Object.fromEntries(platforms.map(p => [p, getPlatformCopy(campaign, p)])))
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState(null)
  const hasRetiredAds = platforms.includes('google_ads')
  const editable = !hasRetiredAds && ['borrador', 'generado', 'rechazado'].includes(campaign.estado)
  const dirty = platforms.some(p => copies[p] !== getPlatformCopy(campaign, p))
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      api.post(`/api/campaigns/${campaign.id}/validate-platforms/`, { textos_por_plataforma: copies })
        .then(({ data }) => { if (active) setValidation(data.data) })
        .catch(() => { if (active) setValidation(null) })
    }, 350)
    return () => { active = false; clearTimeout(timer) }
  }, [campaign.id, copies])

  async function change(action) {
    if (busy || disabled) return
    if (action === 'reopen-review' && !window.confirm('Se abrirá una nueva revisión y se bloqueará la publicación hasta que el cliente vuelva a aprobar. Las publicaciones anteriores no se eliminan. ¿Continuar?')) return
    if (action === 'adapt-platforms' && dirty && !window.confirm('La IA reemplazará los borradores por plataforma que aún no guardaste. ¿Continuar?')) return
    setBusy(true)
    try {
      const response = action === 'save'
        ? await api.patch(`/api/campaigns/${campaign.id}/`, { version: campaign.version, textos_por_plataforma: copies })
        : await api.post(`/api/campaigns/${campaign.id}/${action}/`, { version: campaign.version, confirm: true })
      onDirty(false)
      onSaved(response.data.data.campaign)
      toast.success(response.data.message || 'Contenido actualizado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo actualizar el contenido')
    } finally { setBusy(false) }
  }

  return <section className="mb-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
    <h2 className="font-semibold">Contenido por plataforma</h2>
    <p className="my-2 text-sm text-on-surface-variant">Cada red usa su propio texto y la imagen compartida. El cliente aprueba todas las versiones juntas.</p>
    {hasRetiredAds && <p className="my-2 text-sm">Google Ads se retiró del proyecto. Estas versiones históricas se conservan solo para consulta.</p>}
    {!Object.keys(campaign.textos_por_plataforma || {}).length && <p className="my-2 text-sm">Campaña anterior: se conserva el texto original. Puedes generar versiones específicas antes de solicitar una nueva aprobación.</p>}
    {platforms.map(platform => <div key={platform} className="my-4">
      <label htmlFor={`copy-${platform}`} className="mb-2 flex items-center gap-2 font-medium"><PlatformIcon platform={platform} className="h-5 w-5" />{LABELS[platform]}</label>
      <textarea id={`copy-${platform}`} value={copies[platform]} disabled={!editable || busy} rows={platform === 'twitter' ? 4 : 7}
        onChange={event => { setValidation(null); setCopies(current => ({ ...current, [platform]: event.target.value })) }}
        className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm disabled:opacity-80" />
      {platform === 'twitter' && <p className="text-xs text-on-surface-variant">{validation?.twitter_length ?? '…'} / 280 caracteres ponderados; no se recorta automáticamente.</p>}
      {validation?.errors?.[platform] && <p role="alert" className="mt-1 text-sm text-error">{validation.errors[platform]}</p>}
      {campaign.publication_status?.[platform] && <p className="mt-1 text-xs">Publicación: {({ published: 'Publicada', linked: 'Publicación existente vinculada y verificada por API', unavailable: 'No encontrada en la red; historial conservado', unverified: 'Disponibilidad pendiente de verificar; revisa el reporte', not_published: 'Pendiente', failed: 'Error', uncertain: 'Pendiente de verificar', preparing: 'Preparando', publishing: 'Publicando', sending: 'Enviando', processing: 'Procesando en TikTok', inbox: 'Enviada a TikTok; esperando confirmación de publicación' })[campaign.publication_status[platform]] || campaign.publication_status[platform]}</p>}
    </div>)}
    <div className="flex flex-wrap gap-2">
      {editable && <Button disabled={busy || disabled || !dirty} onClick={() => change('save')}>{busy ? 'Procesando…' : 'Guardar versiones'}</Button>}
      {campaign.estado === 'generado' && !hasRetiredAds && <Button variant="outline" disabled={busy || disabled} onClick={() => change('adapt-platforms')}>Generar versiones con IA</Button>}
      {campaign.estado === 'aprobado' && <Button variant="outline" disabled={busy} onClick={() => change('reopen-review')}>Abrir nueva revisión</Button>}
      {campaign.estado === 'aprobado' && platforms.includes('twitter') && onPrepareX && <Button onClick={onPrepareX}>Resumir para X</Button>}
    </div>
    {campaign.estado === 'aprobado' && platforms.includes('twitter') && <p className="mt-2 text-sm">Para adaptar solo X, usa «Resumir para X»: tú revisas el resumen, sin reabrir la campaña ni pedir otra aprobación.</p>}
    {dirty && <p className="mt-2 text-sm">Guarda las versiones antes de enviar al cliente.</p>}
    {disabled && <p className="mt-2 text-sm">Guarda primero los cambios del texto base y del prompt.</p>}
  </section>
}
