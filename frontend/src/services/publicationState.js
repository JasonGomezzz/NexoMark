export function registeredPublicationLabel(status) {
  return ({ published: 'Ya publicada', unavailable: 'No encontrada en la red', removed: 'Eliminada por el propietario',
    pending_previous: 'Envío anterior por verificar', uncertain: 'Resultado por verificar',
    publishing: 'Publicación en curso', sending: 'Envío en curso', processing: 'Procesando en TikTok',
    inbox: 'Envío registrado en TikTok' })[status] ?? null
}
