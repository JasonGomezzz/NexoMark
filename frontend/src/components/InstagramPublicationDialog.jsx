import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import { getPlatformCopy } from '../services/campaignPublication'
import { registeredPublicationLabel } from '../services/publicationState'
import { Button } from '@/components/ui/button'

export default function InstagramPublicationDialog({ campaign, onClose }) {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkingRequest, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const cancelWait = useRef(null)
  const dialog = useRef(null)
  const checking = checkingRequest || Boolean(accountId && !error &&
    (outcome?.checkedVersion !== campaign.version || outcome?.checkedAccount !== accountId))

  useEffect(() => {
    mounted.current = true
    let active = true
    api.get('/api/auth/instagram/accounts/').then(({ data }) => {
      if (!active) return
      const available = data.data.accounts.filter((account) => !account.expired)
      setAccounts(available)
      setChecking(available.length === 1)
      setAccountId(available.length === 1 ? String(available[0].id) : '')
    }).catch(() => { if (active) setError('No se pudieron cargar las cuentas de Instagram.') })
      .finally(() => { if (active) setLoading(false) })
    const previousFocus = document.activeElement
    dialog.current?.focus()
    return () => { active = false; mounted.current = false; cancelWait.current?.(); previousFocus?.focus() }
  }, [])

  useEffect(() => {
    if (!accountId) return
    let active = true
    api.get(`/api/campaigns/${campaign.id}/publish-instagram/`, { params: { account_id: accountId } })
      .then(({ data }) => {
        if (active) setOutcome({ ...data.data, message: data.message, checkedVersion: campaign.version, checkedAccount: accountId })
      }).catch(() => { if (active) setError('No se pudo comprobar si esta campaña ya fue publicada.') })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [accountId, campaign.id, campaign.version])

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
    if (inFlight.current || !accountId || checking || error || outcome && !['not_published', 'preparing'].includes(outcome.status)) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      // Resume the same durable server attempt; never create another post on a retry.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!mounted.current) break
        const { data } = await api.post(`/api/campaigns/${campaign.id}/publish-instagram/`, {
          account_id: Number(accountId), version: campaign.version, confirm: true,
        })
        if (!mounted.current) break
        setOutcome({ ...data.data, message: data.message, checkedVersion: campaign.version, checkedAccount: accountId })
        if (data.data.status !== 'preparing') break
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 60000)
          cancelWait.current = () => { clearTimeout(timer); resolve() }
        })
      }
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'No se confirmó el resultado. Revisa Instagram antes de volver a intentarlo.')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const selected = accounts.find((account) => String(account.id) === accountId)
  const locked = outcome && !['not_published', 'preparing'].includes(outcome.status)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div ref={dialog} tabIndex={-1} onKeyDown={handleKeyDown} role="dialog" aria-modal="true"
        aria-labelledby="instagram-publication-title" className="glass-liquid max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6">
        <h2 id="instagram-publication-title" className="text-xl font-semibold">Instagram · publicación de la campaña</h2>
        <p className="my-3 text-sm">Comprobamos los envíos de esta cuenta, incluidas versiones anteriores con el mismo texto e imagen. Una publicación existente no se vuelve a enviar.</p>
        {campaign.imagen_b64 ? (
          <img src={`data:image/png;base64,${campaign.imagen_b64}`} alt="Imagen aprobada para Instagram"
            className="mx-auto max-h-72 rounded-xl object-contain" />
        ) : <p role="alert">Esta campaña no tiene imagen. No se puede publicar en Instagram.</p>}
        <div className="my-4 whitespace-pre-wrap rounded-xl border border-outline-variant p-4 text-sm">{getPlatformCopy(campaign, 'instagram')}</div>
        <label htmlFor="instagram-destination" className="text-sm font-semibold">Cuenta de destino</label>
        <select id="instagram-destination" value={accountId} disabled={busy || checking}
          onChange={(event) => {
            setChecking(!!event.target.value)
            setOutcome(null)
            setError('')
            setAccountId(event.target.value)
          }}
          className="my-2 w-full rounded-xl border border-outline-variant bg-surface-container-low p-3">
          <option value="">{loading ? 'Cargando…' : 'Selecciona una cuenta'}</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}
        </select>
        {!loading && !accounts.length && <p className="my-2 text-sm">Conecta o renueva tu cuenta en Configuración antes de publicar.</p>}
        {getPlatformCopy(campaign, 'instagram').length > 2200 && <p role="alert">El texto supera los 2200 caracteres permitidos.</p>}
        {error && <p role="alert" className="my-3 text-error">{error}</p>}
        {outcome?.status === 'not_published' && outcome.has_previous_publication && <p role="status" className="my-3 text-sm">Esta cuenta tiene una publicación anterior con otro contenido. Si confirmas, se creará una nueva; no se editará la anterior.</p>}
        {outcome && outcome.status !== 'not_published' && <p role="status" className="my-3">{outcome.message}{outcome.status === 'published' && ` Cuenta: @${outcome.username}.`}</p>}
        {outcome?.status === 'published' && outcome.publication_url && <a href={outcome.publication_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Ver publicación en Instagram</a>}
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button>
          <Button disabled={loading || checking || busy || !!error || !accountId || !campaign.imagen_b64 || locked || getPlatformCopy(campaign, 'instagram').length > 2200}
            onClick={publish}>{checking ? 'Verificando…' : busy ? 'Publicando…' : registeredPublicationLabel(outcome?.status) || (outcome?.status === 'preparing' ? 'Continuar publicación' : `Publicar${selected ? ` en @${selected.username}` : ''}`)}</Button>
        </div>
      </div>
    </div>
  )
}
