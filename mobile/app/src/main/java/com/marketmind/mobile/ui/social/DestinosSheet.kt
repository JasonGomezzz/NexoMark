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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.marketmind.mobile.data.remote.dto.SocialConnectionDto

/**
 * "Enviar al cliente": el marketero elige en qué cuentas se publicará automáticamente
 * cuando el cliente apruebe. Sin cuentas conectadas se envía sin publicación automática.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DestinosSheet(
    destinos: List<SocialConnectionDto>?,
    elegidos: Set<Long>,
    enviando: Boolean,
    onAlternar: (Long) -> Unit,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onCancelar, sheetState = sheetState, containerColor = MaterialTheme.colorScheme.surfaceContainerLowest) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Enviar al cliente", color = MaterialTheme.colorScheme.onSurface, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Text(
                "Publicar automáticamente cuando el cliente apruebe en:",
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            when {
                destinos == null -> Text("Cargando cuentas…", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                destinos.isEmpty() -> Text(
                    "Ni el cliente ni tú tienen cuentas conectadas. Se enviará sin publicación automática; " +
                        "las cuentas se conectan en la web, en Configuración → Redes conectadas.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerLow)
                        .padding(12.dp),
                )
                else -> destinos.forEach { d ->
                    val marcado = d.id in elegidos
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, if (marcado) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                            .toggleable(value = marcado, role = Role.Checkbox, onValueChange = { onAlternar(d.id) })
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                    ) {
                        Checkbox(
                            checked = marcado,
                            onCheckedChange = null,
                            colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
                        )
                        RedLogo(red = d.red, size = 24.dp)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            d.cuentaNombre,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            if (d.propietarioRol == "cliente") "del cliente" else "de la agencia",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 4.dp)) {
                OutlinedButton(onClick = onCancelar, enabled = !enviando, modifier = Modifier.weight(1f)) {
                    Text("Cancelar")
                }
                Button(
                    onClick = onConfirmar,
                    enabled = destinos != null && !enviando,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (enviando) "Enviando…" else "Confirmar envío")
                }
            }
        }
    }
}
