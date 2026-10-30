import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Megaphone, AlertCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import { getAuthItem } from '../services/session'

/**
 * Lista de campañas (Marketero/SuperAdmin). Consume Django con paginación DRF.
 * LÓGICA INTACTA: fetch /api/campaigns/ (results/count/next/previous), navegación
 * al detalle, header por rol, loading/error/empty.
 * Usa StatusBadge (fuente única de estados FSM) para consistencia.
 */
export default function CampaignListPage() {
  const role = getAuthItem('user_role') || ''
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState([])
  const [count, setCount] = useState(0)
  const [nextUrl, setNextUrl] = useState(null)
  const [prevUrl, setPrevUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // loadCampaigns solo setea estado en callbacks async (apto para el efecto);
  // fetchCampaigns agrega el reset síncrono y se usa desde handlers.
  function loadCampaigns(url) {
    return api
      .get(url)
      .then(({ data }) => {
        setCampaigns(data.results)
        setCount(data.count)
        setNextUrl(data.next)
        setPrevUrl(data.previous)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  function fetchCampaigns(url = '/api/campaigns/') {
    setLoading(true)
    setError(false)
    loadCampaigns(url)
  }

  async function handleDelete(event, campaign) {
    event.stopPropagation()
    if (!window.confirm(`¿Eliminar la campaña "${campaign.titulo}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await api.delete(`/api/campaigns/${campaign.id}/`)
      fetchCampaigns()
    } catch (err) {
      window.alert(err.response?.data?.message || 'No se pudo eliminar la campaña.')
    }
  }

  useEffect(() => {
    loadCampaigns('/api/campaigns/')
  }, [])

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Campañas</h1>
          {count > 0 && (
            <p className="mt-2 text-base text-on-surface-variant">
              {count} {count === 1 ? 'campaña' : 'campañas'} en total
            </p>
          )}
        </div>
        {role === 'marketero' && (
          <Button onClick={() => navigate('/campaigns/new')}>
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          No se pudieron cargar las campañas.
          <button className="font-semibold underline" onClick={() => fetchCampaigns()}>
            Reintentar
          </button>
        </div>
      )}

      {/* Skeleton */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-outline-variant/40 px-4 py-4 last:border-0"
            >
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-container-high" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-surface-container-high" />
            </div>
          ))}
        </div>
      ) : !error && campaigns.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-outline">
            <Megaphone className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">
            {role === 'cliente' ? 'No tienes campañas asignadas' : 'Aún no tienes campañas'}
          </h3>
          <p className="max-w-sm text-sm text-on-surface-variant">
            {role === 'marketero'
              ? 'Crea tu primera campaña y deja que la IA genere el copy y la imagen.'
              : 'Cuando haya campañas, aparecerán aquí.'}
          </p>
          {role === 'marketero' && (
            <Button className="mt-2" onClick={() => navigate('/campaigns/new')}>
              <Plus className="h-4 w-4" />
              Crear campaña
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla */}
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low">
                  <tr>
                    {['Título', 'Cliente', 'Industria', 'Plataforma', 'Estado', 'Fecha', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[13px] font-semibold text-on-surface-variant"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="cursor-pointer border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface-container-low"
                    >
                      <td className="max-w-[200px] truncate px-4 py-4 font-medium text-on-surface">
                        {c.titulo}
                      </td>
                      <td className="px-4 py-4 text-on-surface-variant">{c.cliente_nombre}</td>
                      <td className="px-4 py-4 capitalize text-on-surface-variant">{c.industria}</td>
                      <td className="px-4 py-4 capitalize text-on-surface-variant">{c.plataforma}</td>
                      <td className="px-4 py-4">
                        <StatusBadge estado={c.estado} />
                      </td>
                      <td className="px-4 py-4 tabular-nums text-on-surface-variant">
                        {new Date(c.fecha_creacion).toLocaleDateString('es-PE')}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {role === 'marketero' && ['borrador', 'generado'].includes(c.estado) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => handleDelete(event, c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {(prevUrl || nextUrl) && (
            <div className="mt-4 flex justify-between">
              <Button variant="outline" size="sm" disabled={!prevUrl} onClick={() => fetchCampaigns(prevUrl)}>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={!nextUrl} onClick={() => fetchCampaigns(nextUrl)}>
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
