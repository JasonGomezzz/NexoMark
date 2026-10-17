package com.marketmind.mobile.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.marketmind.mobile.data.remote.dto.CampaignDto
import com.marketmind.mobile.ui.campaigns.formatEstado
import com.marketmind.mobile.ui.campaigns.formatFecha
import com.marketmind.mobile.ui.theme.coloresEstado

@Composable
fun CampaignCard(
    campaign: CampaignDto,
    onClick: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val estado = coloresEstado(campaign.estado)
    Card(
        onClick = { onClick(campaign.id) },
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    text = campaign.titulo.orEmpty().ifBlank { "Sin título" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f, fill = false),
                )
                AssistChip(
                    onClick = {},
                    enabled = false,
                    label = { Text(formatEstado(campaign.estado)) },
                    colors = AssistChipDefaults.assistChipColors(
                        disabledLabelColor = estado.texto,
                        disabledContainerColor = estado.fondo,
                    ),
                )
            }

            campaign.clienteNombre?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Cliente: $it",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            val extracto = campaign.textoGenerado?.takeIf { it.isNotBlank() }
                ?: campaign.prompt
            extracto?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it.trim().take(120).let { snippet ->
                        if (it.length > 120) "$snippet…" else snippet
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            campaign.fechaCreacion?.let { iso ->
                Text(
                    text = formatFecha(iso),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
}

