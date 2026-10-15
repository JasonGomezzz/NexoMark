// Timeline positions leave a reading interval for each phase, including both ends.
export const STORY_DURATION_SECONDS = 14

export function remainingStoryDuration(progress) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  return STORY_DURATION_SECONDS * (1 - value)
}
export const STORY_STAGES = [
  { id: 'brief', title: 'Brief del negocio', label: 'La idea', headline: ['Es el', 'comienzo.'], position: 0.04,
    description: 'Define tu producto, tu público y lo que quieres comunicar. El negocio marca el punto de partida.' },
  { id: 'contenido', title: 'Texto e imagen', label: 'La propuesta', headline: ['Toma', 'forma.'], position: 0.35,
    description: 'La IA ayuda a dar forma al mensaje y a la imagen. Tú ajustas la propuesta antes de compartirla.' },
  { id: 'revision', title: 'Revisión del cliente', label: 'La decisión', headline: ['Con tu', 'aprobación.'], position: 0.61,
    description: 'Tu cliente revisa, pide cambios o aprueba. La decisión sigue en manos de las personas.' },
  { id: 'redes', title: 'Conexión con las redes', label: 'El siguiente paso', headline: ['En tus', 'canales.'], position: 0.94,
    description: 'Con el contenido aprobado, prepara el envío según cada canal. En TikTok, termina la edición y publicación en su app.' },
]

export function storyStageAt(progress) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  if (value < 0.22) return 0
  if (value < 0.50) return 1
  if (value < 0.76) return 2
  return 3
}

// Pure choreography data: no timers, looping playback or network requests.
export const STORY_TRACKS = {
  briefOpacity: { input: [0, 0.12, 0.22, 1], output: [1, 1, 0, 0] },
  briefY: { input: [0, 0.12, 0.25, 1], output: [0, 0, -65, -65] },
  briefScale: { input: [0, 0.12, 0.25, 1], output: [1, 1, 0.82, 0.82] },
  contentOpacity: { input: [0, 0.12, 0.27, 1], output: [0, 0, 1, 1] },
  copyX: { input: [0, 0.16, 0.34, 1], output: [-8, -8, -116, -116] },
  copyY: { input: [0, 0.16, 0.34, 0.60, 0.86, 1], output: [25, 25, 18, 0, -12, -12] },
  copyRotate: { input: [0, 0.16, 0.34, 0.60, 1], output: [-8, -8, -7, 0, 0] },
  imageX: { input: [0, 0.16, 0.34, 0.60, 0.86, 1], output: [12, 12, 116, 116, 90, 90] },
  imageY: { input: [0, 0.16, 0.34, 0.60, 1], output: [10, 10, -12, 0, -12] },
  imageRotate: { input: [0, 0.16, 0.34, 0.60, 1], output: [7, 7, 6, 0, 0] },
  contentScale: { input: [0, 0.27, 0.66, 0.86, 1], output: [0.92, 1, 1, 0.8, 0.8] },
  groupX: { input: [0, 0.66, 0.86, 1], output: [0, 0, -85, -85] },
  reviewOpacity: { input: [0, 0.48, 0.57, 1], output: [0, 0, 1, 1] },
  reviewY: { input: [0, 0.48, 0.60, 0.86, 1], output: [55, 55, 0, -24, -24] },
  reviewScale: { input: [0, 0.66, 0.86, 1], output: [1, 1, 0.84, 0.84] },
  connections: { input: [0, 0.74, 0.92, 1], output: [0, 0, 1, 1] },
}
