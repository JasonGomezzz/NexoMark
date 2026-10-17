package com.marketmind.mobile.ui.social

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.marketmind.mobile.R
import com.marketmind.mobile.ui.theme.NexoTheme

/** Logo de la red (los mismos PNG de la web). */
@Composable
fun RedLogo(red: String, size: Dp, modifier: Modifier = Modifier) {
    val logo = when (red) {
        "instagram" -> R.drawable.ig_logo
        "facebook" -> R.drawable.facebook_logo
        else -> null
    }
    if (logo == null) {
        Icon(Icons.Filled.Share, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = modifier.size(size))
    } else {
        Image(
            painter = painterResource(logo),
            contentDescription = null,
            modifier = modifier
                .size(size)
                .clip(RoundedCornerShape(size / 4)),
        )
    }
}

@Composable
fun EstadoPublicacionPill(estado: String, modifier: Modifier = Modifier) {
    val (texto, tono) = SocialFormat.estadoPublicacion(estado)
    // Mismos tonos que PublicationBadge de la web.
    val colores = NexoTheme.colors
    val (fondo, color) = when (tono) {
        SocialFormat.Tono.Ok -> colores.successContainer to colores.success
        SocialFormat.Tono.Error -> colores.errorContainer to colores.error
        SocialFormat.Tono.Neutral -> colores.surfaceContainerHigh to colores.onSurfaceVariant
    }
    Text(
        text = texto,
        color = color,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(fondo)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

/** Cifra con su etiqueta. Si Meta no la informa se lee "sin dato", más discreto pero legible. */
@Composable
fun CifraMetrica(etiqueta: String, valor: Int?, grande: Boolean = false, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(etiqueta, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        if (valor == null) {
            Text(
                "sin dato",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = if (grande) 8.dp else 2.dp),
            )
        } else {
            Text(
                SocialFormat.formatoMetrica(valor),
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = if (grande) 30.sp else 17.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
    }
}
