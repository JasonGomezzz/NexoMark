import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import { getPlatformCopy } from '../services/campaignPublication'
import { canConfirmXPublication } from '../services/xPublication'
import { registeredPublicationLabel } from '../services/publicationState'
import { Button } from '@/components/ui/button'

export default function XPublicationDialog({ campaign, onClose }) {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryConfirmed, setSummaryConfirmed] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const dialog = useRef(null)

  useEffect(() => {
    mounted.current = true
    let active = true
    api.get('/api/auth/x/accounts/').then(({ data }) => {
      if (!active) return
      const available = data.data.accounts.filter(account => !account.expired || account.can_refresh)
      setAccounts(available)
      if (available.length === 1) {
        setChecking(true)
        setAccountId(String(available[0].id))
      }
      if (!data.data.configured) setError('Falta configurar X en el servidor.')
    }).catch(() => { if (active) setError('No se pudieron cargar tus cuentas de X.') })
      .finally(() => { if (active) setLoading(false) })
    const previousFocus = document.activeElement
    dialog.current?.focus()
    return () => { active = false; mounted.current = false; previousFocus?.focus() }
  }, [])

  useEffect(() => {
    let active = true
    api.get(`/api/campaigns/${campaign.id}/publish-x/`, { params: {
      ...(accountId ? { account_id: accountId } : {}), ...(summary ? { summary_id: summary.summary_id } : {}),
    } })
      .then(({ data }) => { if (active) setOutcome({ ...data.data, accountId,
        summaryId: data.data.summary_id || (data.data.status === 'not_published' ? summary?.summary_id : null) || null, message: data.message }) })
      .catch(() => { if (active) setError('No se pudo comprobar el estado de publicación en X.') })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [accountId, campaign.id, summary])

  const summaryId = outcome && outcome.status !== 'not_published'
    ? outcome.summary_id || null : summary?.summary_id || null
  const publicationState = { loading, checking, busy: busy || summarizing, error, outcome, summaryId, summaryConfirmed }

  async function summarize() {
    if (inFlight.current || summarizing || busy) return
    inFlight.current = true
    setSummarizing(true)
    setError('')
    try {
      const { data } = await api.post(`/api/campaigns/${campaign.id}/summarize-x/`, { version: campaign.version })
      if (mounted.current) {
        setChecking(true)
        setOutcome(null)
        setSummaryConfirmed(false)
        setSummary(data.data)
      }
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'No se pudo preparar el resumen. El contenido aprobado se conserva.')
    } finally {
      inFlight.current = false
      if (mounted.current) setSummarizing(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !busy) onClose()
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href]')]
    if (!controls.length) { event.preventDefault(); return }
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
      event.preventDefault(); first.focus()
    }
  }

  async function publish() {
    if (inFlight.current || !canConfirmXPublication(campaign, accountId, publicationState)) return
    inFlight.current = true
    setBusy(true)
    try {
      const { data } = await api.post(`/api/campaigns/${campaign.id}/publish-x/`, {
        account_id: Number(accountId), version: campaign.version, confirm: true,
        ...(summaryId ? { summary_id: summaryId, confirm_summary: summaryConfirmed } : {}),
      })
      if (mounted.current) setOutcome({ ...data.data, accountId, summaryId: data.data.summary_id || null, message: data.message })
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'No se confirmó el resultado. Revisa X antes de volver a intentarlo.')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const selected = accounts.find(account => String(account.id) === accountId)
  const validation = outcome?.text_validation
  const allowed = canConfirmXPublication(campaign, accountId, publicationState)
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div ref={dialog} tabIndex={-1} onKeyDown={handleKeyDown} role="dialog" aria-modal="true"
      aria-labelledby="x-publication-title" className="glass-liquid max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6">
      <h2 id="x-publication-title" className="text-xl font-semibold">Publicar en Twitter / X</h2>
      <p className="my-3 text-sm">Revisa la imagen y el texto. Puedes resumir la versión de X y confirmarla como marketero, sin cambiar lo aprobado para Facebook e Instagram.</p>
      {campaign.imagen_b64 ? <img src={`data:image/png;base64,${campaign.imagen_b64}`} alt="Imagen aprobada para X"
        className="mx-auto max-h-72 rounded-xl object-contain" /> : <p role="alert">Esta campaña no tiene imagen para publicar.</p>}
      <p className="mt-4 text-sm font-semibold">{summaryId ? 'Resumen de X — revisión del marketero' : 'Texto aprobado por el cliente'}</p>
      <div className="my-2 whitespace-pre-wrap break-words rounded-xl border border-outline-variant p-4 text-sm">{outcome?.caption ?? summary?.caption ?? getPlatformCopy(campaign, 'twitter')}</div>
      {(!outcome || outcome.status === 'not_published') && <Button variant="outline" disabled={loading || checking || busy || summarizing}
        onClick={summarize}>{summarizing ? 'Resumiendo…' : summary ? 'Generar otro resumen para X' : 'Resumir para X'}</Button>}
      {validation && <p className={`mb-3 text-sm ${validation.valid ? 'text-on-surface-variant' : 'text-error'}`}>
        {validation.weighted_length} / {validation.limit} caracteres según las reglas de X.
      </p>}
      {validation && !validation.valid && <p role="alert" className="mb-3 text-sm text-error">
        El texto supera el límite o no es válido para X. Usa «Resumir para X» y revisa el resultado; no se recortará automáticamente.
      </p>}
      {summaryId && ['not_published', 'failed'].includes(outcome?.status) && <label className="my-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={summaryConfirmed} disabled={busy || summarizing || checking}
          onChange={event => setSummaryConfirmed(event.target.checked)} />
        Revisé el resumen, conserva el mensaje aprobado y confirmo su publicación como marketero. No requiere una nueva aprobación del cliente.
      </label>}
      <label htmlFor="x-destination" className="text-sm font-semibold">Cuenta de destino</label>
      <select id="x-destination" value={accountId} disabled={loading || busy || checking || summarizing}
        onChange={event => {
          setChecking(true)
          setOutcome(null)
          setError('')
          setSummaryConfirmed(false)
          setAccountId(event.target.value)
        }} className="my-2 w-full rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <option value="">{loading ? 'Cargando…' : 'Selecciona una cuenta'}</option>
        {accounts.map(account => <option key={account.id} value={account.id}>@{account.username}</option>)}
      </select>
      {!loading && !accounts.length && <p className="my-2 text-sm">Conecta tu cuenta de X en <a href="/settings" className="text-primary underline">Configuración</a> antes de publicar.</p>}
      <p className="my-2 text-xs text-on-surface-variant">X requiere créditos disponibles en la cuenta de desarrollador para usar su API.</p>
      {error && <p role="alert" className="my-3 text-error">{error}</p>}
      {outcome && outcome.status !== 'not_published' && <p role="status" className={`my-3 text-sm ${outcome.status === 'failed' ? 'text-error' : ''}`}>{outcome.message}</p>}
      {outcome?.status === 'published' && outcome.publication_url && <a href={outcome.publication_url}
        target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Ver publicación en X</a>}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button>
        <Button disabled={!allowed} onClick={publish}>{checking ? 'Verificando…' : busy ? 'Publicando…'
          : registeredPublicationLabel(outcome?.status) || `${outcome?.status === 'failed' ? 'Volver a confirmar' : 'Publicar'}${selected ? ` en @${selected.username}` : ''}`}</Button>
      </div>
    </div>
  </div>
}
