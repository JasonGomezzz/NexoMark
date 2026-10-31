import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import { getPlatformCopy } from '../services/campaignPublication'
import { canConfirmFacebookPublication } from '../services/facebookPublication'
import { registeredPublicationLabel } from '../services/publicationState'
import { Button } from '@/components/ui/button'

export default function FacebookPublicationDialog({ campaign, onClose }) {
  const [pages, setPages] = useState([])
  const [pageId, setPageId] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkingRequest, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const dialog = useRef(null)
  const checking = checkingRequest || Boolean(pageId && !error &&
    (outcome?.checkedVersion !== campaign.version || outcome?.checkedPage !== pageId))

  useEffect(() => {
    mounted.current = true
    let active = true
    api.get('/api/auth/facebook/pages/').then(({ data }) => {
      if (!active) return
      const available = data.data.pages.filter((page) => !page.expired)
      setPages(available)
      setChecking(available.length === 1)
      setPageId(available.length === 1 ? String(available[0].id) : '')
      if (!data.data.configured) setError('Falta configurar Facebook en el servidor.')
    }).catch(() => { if (active) setError('No se pudieron cargar tus Páginas de Facebook.') })
      .finally(() => { if (active) setLoading(false) })
    const previousFocus = document.activeElement
    dialog.current?.focus()
    return () => { active = false; mounted.current = false; previousFocus?.focus() }
  }, [])

  useEffect(() => {
    if (!pageId) return
    let active = true
    api.get(`/api/campaigns/${campaign.id}/publish-facebook/`, { params: { page_id: pageId } })
      .then(({ data }) => { if (active) setOutcome({ ...data.data, message: data.message, checkedVersion: campaign.version, checkedPage: pageId }) })
      .catch(() => { if (active) setError('No se pudo comprobar si esta campaña ya fue publicada.') })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [pageId, campaign.id, campaign.version])

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !busy) onClose()
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), select:not(:disabled), a[href]')]
    if (!controls.length) { event.preventDefault(); return }
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
      event.preventDefault(); first.focus()
    }
  }

  async function publish() {
    if (inFlight.current || !canConfirmFacebookPublication(campaign, pageId, { loading, checking, busy, error, outcome })) return
    inFlight.current = true
    setBusy(true)
    try {
      // Exactly one explicit POST. Any uncertain result is checked on the Page,
      // not automatically resent, including after closing/reopening the dialog.
      const { data } = await api.post(`/api/campaigns/${campaign.id}/publish-facebook/`, {
        page_id: Number(pageId), version: campaign.version, confirm: true,
      })
      if (mounted.current) setOutcome({ ...data.data, message: data.message, checkedVersion: campaign.version, checkedPage: pageId })
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'No se confirmó el resultado. Revisa Facebook antes de volver a intentarlo.')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const selected = pages.find((page) => String(page.id) === pageId)
  const allowed = canConfirmFacebookPublication(campaign, pageId, { loading, checking, busy, error, outcome })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div ref={dialog} tabIndex={-1} onKeyDown={handleKeyDown} role="dialog" aria-modal="true"
        aria-labelledby="facebook-publication-title" className="glass-liquid max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6">
        <h2 id="facebook-publication-title" className="text-xl font-semibold">Facebook · publicación de la campaña</h2>
        <p className="my-3 text-sm">Primero comprobamos los envíos registrados para esta Página, incluidas versiones anteriores con el mismo texto e imagen. Una publicación existente no se vuelve a enviar.</p>
        {campaign.imagen_b64 ? <img src={`data:image/png;base64,${campaign.imagen_b64}`} alt="Imagen aprobada para Facebook"
          className="mx-auto max-h-72 rounded-xl object-contain" /> : <p role="alert">Esta campaña no tiene imagen. No se puede publicar en Facebook.</p>}
        <div className="my-4 whitespace-pre-wrap rounded-xl border border-outline-variant p-4 text-sm">{getPlatformCopy(campaign, 'facebook')}</div>
        <label htmlFor="facebook-destination" className="text-sm font-semibold">Página de destino</label>
        <select id="facebook-destination" value={pageId} disabled={loading || busy || checking}
          onChange={(event) => {
            setChecking(!!event.target.value)
            setOutcome(null)
            setError('')
            setPageId(event.target.value)
          }} className="my-2 w-full rounded-xl border border-outline-variant bg-surface-container-low p-3">
          <option value="">{loading ? 'Cargando…' : 'Selecciona una Página'}</option>
          {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
        </select>
        {!loading && !pages.length && <p className="my-2 text-sm">Conecta o renueva tu Página en Configuración antes de publicar.</p>}
        {getPlatformCopy(campaign, 'facebook').length > 60000 && <p role="alert">El texto supera los 60000 caracteres de esta integración.</p>}
        {error && <p role="alert" className="my-3 text-error">{error}</p>}
        {outcome?.status === 'not_published' && outcome.has_previous_publication && <p role="status" className="my-3 text-sm">Esta Página tiene una publicación anterior con otro contenido. Si confirmas, se creará una publicación nueva; no se editará la anterior.</p>}
        {outcome && outcome.status !== 'not_published' && <p role="status" className="my-3">{outcome.message}{outcome.status === 'published' && ` Página: ${outcome.page_name}.`}</p>}
        {outcome?.status === 'published' && outcome.publication_url && <a href={outcome.publication_url}
          target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Ver publicación en Facebook</a>}
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button>
          <Button disabled={!allowed} onClick={publish}>{checking ? 'Verificando…' : busy ? 'Publicando…'
            : registeredPublicationLabel(outcome?.status) || `Publicar${selected ? ` en ${selected.name}` : ''}`}</Button>
        </div>
      </div>
    </div>
  )
}
