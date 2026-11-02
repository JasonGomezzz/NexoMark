import { useEffect, useState } from 'react'
import api from '../services/api'
import { Button } from '@/components/ui/button'

export default function ClientsPage() {
  const [data, setData] = useState(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() {
    const response = await api.get('/api/campaigns/clients/')
    setData(response.data)
  }
  useEffect(() => {
    let mounted = true
    api.get('/api/campaigns/clients/').then(response => {
      if (mounted) setData(response.data)
    }).catch(() => { if (mounted) setError('No se pudieron cargar los clientes.') })
    return () => { mounted = false }
  }, [])
  async function change(action) {
    setBusy(true); setError('')
    try { await action(); await load(); setEmail('') }
    catch (e) {
      const detail = e.response?.data
      setError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.join(' ') : detail?.detail || 'No se pudo completar la operación. Revisa los cupos y el correo registrado.')
    } finally { setBusy(false) }
  }
  return <section className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-3xl font-bold text-on-surface">Clientes</h1>
    <p className="text-on-surface-variant">Desactivar un cliente libera un cupo y bloquea la creación de nuevas campañas para él. Sus campañas e historial se conservan; su cuenta no se suspende.</p>
    {data && <p className="font-semibold text-primary">{data.active_count}{data.limit == null ? ' clientes activos · sin límite de plan asignado' : ` de ${data.limit} cupos utilizados`}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); change(() => api.post('/api/campaigns/clients/', { email })) }}>
      <label className="flex-1 text-sm text-on-surface">Correo del cliente registrado
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} className="mt-2 block w-full rounded border border-outline-variant bg-surface p-3 text-on-surface" />
      </label>
      <Button className="self-end" disabled={busy || !data}>Añadir cliente</Button>
    </form>
    {error && <p role="alert" className="text-error">{error}</p>}
    {!data && !error && <p>Cargando clientes…</p>}
    {data?.clients.length === 0 && <p>No tienes clientes registrados. También se añaden al crear su primera campaña.</p>}
    <ul className="space-y-3">{data?.clients.map(client => <li key={client.id} className="flex flex-wrap items-center justify-between gap-4 rounded bg-surface-container-low p-4">
      <div><p className="font-semibold text-on-surface">{client.nombre}</p><p className="text-sm text-on-surface-variant">{client.email} · {client.active ? 'Activo' : 'Inactivo'}</p></div>
      <Button type="button" disabled={busy || (!client.active && data.limit != null && data.active_count >= data.limit)} variant="outline" onClick={() => change(() => api.patch(`/api/campaigns/clients/${client.id}/`, { active: !client.active }))}>{client.active ? 'Desactivar' : 'Reactivar'}</Button>
    </li>)}</ul>
  </section>
}
