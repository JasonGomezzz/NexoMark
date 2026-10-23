import RetornoConexion from '@/components/social/RetornoConexion'
import { mensajeMotivoRetornoTikTok } from '../services/social'
import { socialApi } from '../services/socialApi'

const mensajeExito = (data) =>
  `Se conectó ${data.conexiones?.[0]?.cuenta_nombre ?? 'tu cuenta de TikTok'}. Conectar no envía ni publica nada.`

/**
 * Retorno del login de TikTok (/redes/tiktok-retorno#code=...&state=...). Igual que
 * Meta y X: Django canjea el código solo cuando esta página lo presenta con la
 * sesión de quien inició la conexión.
 */
export default function TikTokRetornoPage() {
  return (
    <RetornoConexion
      titulo="Conectar TikTok"
      textoConectando="Conectando tu cuenta de TikTok…"
      mensajeMotivo={mensajeMotivoRetornoTikTok}
      completar={socialApi.completarConexionTikTok}
      mensajeExito={mensajeExito}
    />
  )
}
