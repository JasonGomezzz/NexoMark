package com.marketmind.mobile.ui.campaigns

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.marketmind.mobile.data.remote.dto.CampaignDto
import com.marketmind.mobile.data.remote.dto.PublicationDto
import com.marketmind.mobile.ui.social.DestinosSheet
import com.marketmind.mobile.ui.social.PublicationsSection
import com.marketmind.mobile.ui.theme.coloresEstado

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignDetailScreen(
    onBack: () -> Unit,
    viewModel: CampaignDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showDeleteDialog by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is CampaignDetailEvent.ShowSnackbar -> snackbarHostState.showSnackbar(event.message)
                CampaignDetailEvent.NavigateBack -> onBack()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalle de campaña") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Volver",
                        )
                    }
                },
            )
        },
        bottomBar = {
            DetailActionsBar(
                state = state,
                onSendClick = viewModel::sendToClient,
                onDeleteClick = { showDeleteDialog = true },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when (val s = state) {
                CampaignDetailUiState.Loading -> LoadingState()
                is CampaignDetailUiState.Success -> CampaignDetailBody(
                    state = s,
                    onPublish = viewModel::publish,
                )
                is CampaignDetailUiState.Error -> ErrorState(
                    message = s.message,
                    onRetry = viewModel::retry,
                )
            }
        }
    }

    (state as? CampaignDetailUiState.Success)?.takeIf { it.eligiendoDestinos }?.let { s ->
        DestinosSheet(
            destinos = s.destinos,
            elegidos = s.elegidos,
            enviando = s.submitting,
            onAlternar = viewModel::toggleDestino,
            onConfirmar = viewModel::confirmSend,
            onCancelar = viewModel::cancelSend,
        )
    }

    if (showDeleteDialog) {
        DeleteCampaignDialog(
            onDismiss = { showDeleteDialog = false },
            onConfirm = {
                showDeleteDialog = false
                viewModel.deleteCampaign()
            },
        )
    }

}

@Composable
private fun DetailActionsBar(
    state: CampaignDetailUiState,
    onSendClick: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    val successState = state as? CampaignDetailUiState.Success
    val submitting = successState?.submitting == true
    val deleting = successState?.deleting == true
    val canAct = successState != null && !submitting && !deleting
    val estado = successState?.campaign?.estado
    // Django solo deja enviar una campaña generada y eliminar en borrador o generado.
    val canSend = estado == "generado"
    val canDelete = estado == "borrador" || estado == "generado"
    if (successState != null && !canSend && !canDelete) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (canDelete || successState == null) IconButton(
            onClick = onDeleteClick,
            enabled = canAct,
            modifier = Modifier.size(52.dp),
        ) {
            if (deleting) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                    color = MaterialTheme.colorScheme.error,
                )
            } else {
                Icon(
                    imageVector = Icons.Outlined.Delete,
                    contentDescription = "Eliminar campaña",
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (canSend || successState == null) Button(
            onClick = onSendClick,
            enabled = canAct,
            modifier = Modifier.weight(1f),
        ) {
            if (submitting) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text("Enviar al cliente")
            }
        }
    }
}

@Composable
private fun DeleteCampaignDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Eliminar campaña") },
        text = { Text("Esta acción eliminará la campaña si aún está en borrador o generado.") },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Text("Eliminar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        },
    )
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "No pudimos cargar la campaña",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error,
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onRetry,
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text("Reintentar")
        }
    }
}

@Composable
private fun CampaignDetailBody(
    state: CampaignDetailUiState.Success,
    onPublish: (PublicationDto) -> Unit,
) {
    val campaign = state.campaign
    val scroll = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        MetadataCard(campaign)
        PublicationsSection(
            publicaciones = state.publicaciones,
            estadoCampana = campaign.estado,
            publicando = state.publicando,
            onPublicar = onPublish,
        )
        HorizontalDivider()
        Text(
            text = campaign.textoGenerado
                ?.takeIf { it.isNotBlank() }
                ?: campaign.prompt
                    ?.takeIf { it.isNotBlank() }
                ?: "Sin contenido generado.",
            style = MaterialTheme.typography.bodyLarge,
        )
        HorizontalDivider()
        val imagenB64 = campaign.imagenB64
        if (imagenB64 != null) {
            val imageBytes = Base64.decode(imagenB64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            bitmap?.let {
                Image(
                    bitmap = it.asImageBitmap(),
                    contentDescription = "Imagen generada",
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(MaterialTheme.shapes.medium),
                    contentScale = ContentScale.FillWidth,
                )
            }
        } else {
            Text(
                text = "Imagen no generada aún",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun MetadataCard(campaign: CampaignDto) {
    val estado = coloresEstado(campaign.estado)
    Card(
        modifier = Modifier.fillMaxWidth(),
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
                    style = MaterialTheme.typography.titleLarge,
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
                )
            }

            campaign.plataforma?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Plataforma: $it",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            campaign.industria?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Industria: $it",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            campaign.fechaCreacion?.let { iso ->
                Text(
                    text = "Creada: ${formatFecha(iso)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RejectFeedbackSheet(
    feedbackText: String,
    onFeedbackChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val isValid = feedbackText.trim().length in 10..500

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Motivo del rechazo", style = MaterialTheme.typography.titleMedium)

            OutlinedTextField(
                value = feedbackText,
                onValueChange = onFeedbackChange,
                label = { Text("Motivo del rechazo") },
                placeholder = { Text("Describe el motivo (mínimo 10 caracteres)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 4,
                maxLines = 6,
                isError = feedbackText.isNotEmpty() && feedbackText.trim().length < 10,
            )

            Text(
                text = "${feedbackText.length} / 500 (mínimo 10)",
                color = if (feedbackText.trim().length in 10..500 || feedbackText.isEmpty())
                    MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.align(Alignment.End),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar")
                }
                Button(
                    onClick = { onConfirm(feedbackText.trim()) },
                    enabled = isValid,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Confirmar rechazo")
                }
            }
        }
    }
}
