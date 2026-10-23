import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Avatar from './Avatar'
import { useFotoPerfil, sincronizarFoto } from '../../hooks/useFotoPerfil'
import { cuentaApi } from '../../services/cuentaApi'
import { FOTO_ACEPTA, formatoPeso, mensajeApi, validarFoto } from '../../services/cuenta'

/**
 * Foto de perfil: elegir (JPG, PNG o WebP de hasta 2 MB), ver la vista previa
 * y guardarla, o quitarla. Django la recorta a 256 × 256 y le quita los
 * metadatos; el menú lateral la muestra en cuanto se guarda.
 */
export default function ProfilePhoto({ usuario, onCambio }) {
  const id = useId()
  const entrada = useRef(null)
  const foto = useFotoPerfil(usuario)
  const [previa, setPrevia] = useState(null) // { archivo, url }
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null) // 'subir' | 'quitar'

  // La URL temporal de la vista previa se libera al cambiarla o al salir.
  useEffect(() => {
    if (!previa) return undefined
    return () => URL.revokeObjectURL(previa.url)
  }, [previa])

  function elegir(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    const problema = validarFoto(archivo)
    if (problema) {
      setError(problema)
      setPrevia(null)
      return
    }
    setError('')
    setPrevia({ archivo, url: URL.createObjectURL(archivo) })
  }

  async function guardar() {
    if (!previa) return
    setOcupado('subir')
    setError('')
    try {
      const actualizado = await cuentaApi.subirFoto(previa.archivo)
      await sincronizarFoto(actualizado, { forzar: true })
      onCambio(actualizado)
      setPrevia(null)
      toast.success('Foto actualizada')
    } catch (err) {
      setError(mensajeApi(err, 'No se pudo subir la foto.'))
    } finally {
      setOcupado(null)
    }
  }

  async function quitar() {
    setOcupado('quitar')
    setError('')
    try {
      const actualizado = await cuentaApi.quitarFoto()
      await sincronizarFoto(actualizado)
      onCambio(actualizado)
      toast.success('Foto quitada')
    } catch (err) {
      setError(mensajeApi(err, 'No se pudo quitar la foto.'))
    } finally {
      setOcupado(null)
    }
  }

  const tieneFoto = Boolean(usuario.has_avatar)

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <Avatar
        nombre={usuario.nombre}
        src={previa?.url ?? foto}
        alt={previa ? 'Vista previa de tu nueva foto' : tieneFoto ? `Foto de perfil de ${usuario.nombre}` : undefined}
        className={`h-20 w-20 text-xl transition-shadow duration-200 sm:h-24 sm:w-24 sm:text-2xl ${previa ? 'ring-4 ring-primary/25' : ''}`}
      />

      <div className="min-w-0 flex-1">
        <input
          ref={entrada}
          id={`${id}-archivo`}
          type="file"
          accept={FOTO_ACEPTA}
          onChange={elegir}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {previa ? (
          <>
            <p className="text-sm font-semibold text-on-surface">Vista previa</p>
            <p className="mt-0.5 truncate text-sm text-on-surface-variant">
              {previa.archivo.name} · {formatoPeso(previa.archivo.size)}. Se guarda recortada en cuadrado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={guardar} disabled={ocupado !== null}>
                {ocupado === 'subir' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {ocupado === 'subir' ? 'Guardando…' : 'Guardar foto'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPrevia(null)} disabled={ocupado !== null}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => entrada.current?.click()} disabled={ocupado !== null}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                {tieneFoto ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {tieneFoto && (
                <Button size="sm" variant="ghost" onClick={quitar} disabled={ocupado !== null}>
                  {ocupado === 'quitar' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Quitar foto
                </Button>
              )}
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">JPG, PNG o WebP de hasta 2 MB.</p>
          </>
        )}

        {error && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
