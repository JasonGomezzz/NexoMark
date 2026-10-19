export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024

export function profilePhotoError(file) {
  if (!file) return ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Selecciona una foto JPG, PNG o WebP.'
  if (file.size > MAX_PROFILE_PHOTO_BYTES) return 'La foto no debe superar 2 MB.'
  return ''
}
