package com.marketmind.mobile.ui.social

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.marketmind.mobile.data.remote.dto.DestinoDto

/**
 * Lo que el cliente necesita saber antes de aprobar: dónde se publicará exactamente
 * esta versión. Después de aprobar, el estado de cada publicación y su enlace.
 */
@Composable
fun DestinosCampanaCard(destinos: List<DestinoDto>?, estadoCampana: String, modifier: Modifier = Modifier) {
    if (destinos == null) return
    val pendiente = estadoCampana == "pendiente_aprobacion"
    if (destinos.isEmpty() && !pendiente) return
    val uriHandler = LocalUriHandler.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (pendiente) MaterialTheme.colorScheme.surfaceContainerLow else MaterialTheme.colorScheme.surfaceContainerLowest)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            when {
                destinos.isEmpty() -> "Esta campaña no se publicará automáticamente en redes."
                pendiente -> "Al aprobar, esta versión se publicará en:"
                else -> "Publicación en redes"
            },
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
        destinos.forEach { d ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                RedLogo(red = d.red, size = 24.dp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(d.cuentaNombre, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(SocialFormat.etiquetaRed(d.red), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                }
                if (!pendiente) d.estado?.let { EstadoPublicacionPill(it) }
            }
            if (d.estado == "publicado" && !d.permalink.isNullOrBlank()) {
                TextButton(onClick = { uriHandler.openUri(d.permalink) }, modifier = Modifier.padding(start = 26.dp)) {
                    Text("Ver en ${SocialFormat.etiquetaRed(d.red)}")
                }
            }
        }
    }
}
