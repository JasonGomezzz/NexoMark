package com.marketmind.mobile.ui.voice

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoFixHigh
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

/** Resumen de lo que la IA completó, para mostrarlo bajo el brief. */
data class VoiceResumen(
    val completados: Int,
    val pendientes: List<String>,
    val advertencias: List<String>,
)

/**
 * Paso previo al formulario del laboratorio de IA: el marketero dicta o
 * escribe la idea y la IA propone los campos. Interpretar no genera la
 * campaña ni consume créditos; eso ocurre al pulsar "Generar con IA".
 */
@Composable
fun VoiceBriefCard(
    interpreting: Boolean,
    resumen: VoiceResumen?,
    enabled: Boolean,
    onInterpret: (texto: String, porVoz: Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var texto by remember { mutableStateOf("") }
    var parcial by remember { mutableStateOf("") }
    var escuchando by remember { mutableStateOf(false) }
    var porVoz by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var estadoActualizado by remember { mutableStateOf<EstadoDictado?>(null) }

    val dictado = remember {
        SpeechDictation(
            context = context,
            onPartial = { parcial = it },
            onFinal = {
                porVoz = true
                texto = IntentFormMapper.agregarDictado(texto, it)
            },
            onError = { error = it },
            onEnd = {
                escuchando = false
                parcial = ""
            },
            onEstado = { estadoActualizado = it },
        )
    }
    DisposableEffect(dictado) { onDispose { dictado.destroy() } }
    val voz = estadoActualizado ?: dictado.estado
    val puedeDictar = voz.modo != ModoDictado.NO_DISPONIBLE

    fun empezar() {
        error = null
        escuchando = true
        dictado.start()
    }

    val pedirPermiso = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { concedido ->
        if (concedido) empezar() else error = "Sin permiso de micrófono. Puedes escribir el brief."
    }

    val ocupado = interpreting || !enabled

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Cuéntame la campaña",
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "Dicta o escribe la idea y completo el formulario por ti. Aún no se usa ningún crédito.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                lineHeight = 18.sp,
            )

            OutlinedTextField(
                value = texto,
                onValueChange = { texto = it.take(2000) },
                enabled = !ocupado,
                minLines = 3,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceContainerLowest),
                shape = RoundedCornerShape(8.dp),
                placeholder = {
                    Text(
                        text = "Ej: Campaña para una cafetería en Instagram, tono casual, 2x1 en capuchinos para universitarios.",
                        color = MaterialTheme.colorScheme.outline,
                        fontSize = 14.sp,
                    )
                },
            )
            if (escuchando) {
                Text(
                    text = parcial.ifBlank { "Escuchando…" },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                    fontStyle = FontStyle.Italic,
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (puedeDictar) {
                    OutlinedButton(
                        onClick = {
                            when {
                                escuchando -> dictado.stop()
                                ContextCompat.checkSelfPermission(
                                    context,
                                    Manifest.permission.RECORD_AUDIO,
                                ) == PackageManager.PERMISSION_GRANTED -> empezar()
                                else -> pedirPermiso.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        },
                        enabled = !ocupado,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.height(46.dp),
                    ) {
                        Icon(
                            imageVector = if (escuchando) Icons.Filled.Stop else Icons.Filled.Mic,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                        Text(
                            text = if (escuchando) "  Detener" else "  Dictar",
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Button(
                    onClick = {
                        dictado.stop()
                        onInterpret(texto, porVoz)
                    },
                    enabled = !ocupado && texto.trim().length >= 10,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    modifier = Modifier.height(46.dp),
                ) {
                    if (interpreting) {
                        CircularProgressIndicator(
                            color = LocalContentColor.current,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp),
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Filled.AutoFixHigh,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Text(
                        text = if (interpreting) "  Interpretando…" else "  Completar formulario",
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            AvisoDictado(
                estado = voz,
                descargaHabilitada = !ocupado && !escuchando,
                onDescargar = { dictado.descargarIdioma() },
            )
            if (!puedeDictar) {
                Text(
                    text = "Este teléfono no tiene reconocimiento de voz disponible. Escribe el brief.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                )
            }
            error?.let {
                Text(text = it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            resumen?.let { info ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceContainerLow, RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = "Completé ${info.completados} de 7 campos. Revísalos antes de generar.",
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (info.pendientes.isNotEmpty()) {
                        Text(
                            text = "Te falta completar: ${info.pendientes.joinToString(", ")}.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 13.sp,
                        )
                    }
                    info.advertencias.forEach { aviso ->
                        Row(
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                text = aviso,
                                color = MaterialTheme.colorScheme.tertiary,
                                fontSize = 13.sp,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Dice dónde se transcribe la voz según el reconocedor que de verdad se usa
 * y, si el teléfono puede bajar español para dictar sin enviar audio, lo ofrece.
 */
@Composable
private fun AvisoDictado(
    estado: EstadoDictado,
    descargaHabilitada: Boolean,
    onDescargar: () -> Unit,
) {
    val aviso = SeleccionDictado.avisoPrivacidad(estado.modo)
    if (aviso != null) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(
                imageVector = if (estado.modo == ModoDictado.EN_DISPOSITIVO) {
                    Icons.Outlined.PhoneAndroid
                } else {
                    Icons.Outlined.Cloud
                },
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(top = 1.dp)
                    .size(14.dp),
            )
            Text(
                text = aviso,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                modifier = Modifier.weight(1f),
            )
        }
    }
    when {
        estado.descargando -> Text(
            text = "Descargando español para dictar sin enviar audio. Mientras tanto se usa el reconocedor de Google.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 12.sp,
            lineHeight = 16.sp,
        )
        estado.idiomaDescargable -> TextButton(
            onClick = onDescargar,
            enabled = descargaHabilitada,
        ) {
            Text(
                text = "Descargar español para dictar sin enviar audio",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
