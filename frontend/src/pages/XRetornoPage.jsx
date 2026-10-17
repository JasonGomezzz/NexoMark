import RetornoConexion from '@/components/social/RetornoConexion'
import { mensajeMotivoRetornoX } from '../services/social'
import { socialApi } from '../services/socialApi'

const mensajeExito = (data) => `Se conectó ${data.conexiones?.[0]?.cuenta_nombre ?? 'tu cuenta de X'}.`

/**
 * Retorno del login de X (/redes/x-retorno#code=...&state=...). Igual que Meta:
 * Django canjea el código (con el code_verifier de PKCE que guardó cifrado) solo
 * cuando esta página lo presenta con la sesión de quien inició la conexión.
 */
export default function XRetornoPage() {
  return (
    <RetornoConexion
      titulo="Conectar X"
      textoConectando="Conectando tu cuenta de X…"
      mensajeMotivo={mensajeMotivoRetornoX}
      completar={socialApi.completarConexionX}
      mensajeExito={mensajeExito}
    />
  )
}
