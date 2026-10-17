import RetornoConexion from '@/components/social/RetornoConexion'
import { mensajeMotivoRetornoMeta, textoCuentasConectadas } from '../services/social'
import { socialApi } from '../services/socialApi'

const mensajeExito = (data) => textoCuentasConectadas(data.conectadas)

/**
 * Retorno del login de Meta (/redes/meta-retorno#code=...&state=...). La lógica
 * compartida con X (leer el fragmento, borrarlo y completar con la sesión del
 * usuario) vive en RetornoConexion.
 */
export default function MetaRetornoPage() {
  return (
    <RetornoConexion
      titulo="Conectar Instagram y Facebook"
      textoConectando="Conectando tus cuentas de Meta…"
      mensajeMotivo={mensajeMotivoRetornoMeta}
      completar={socialApi.completarConexionMeta}
      mensajeExito={mensajeExito}
    />
  )
}
