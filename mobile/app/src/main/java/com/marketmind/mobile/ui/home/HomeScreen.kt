package com.marketmind.mobile.ui.home

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WorkOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.marketmind.mobile.data.remote.dto.CampaignDto
import com.marketmind.mobile.data.remote.dto.CampaignIntentDto
import com.marketmind.mobile.data.remote.dto.CampaignStatsDto
import com.marketmind.mobile.data.repository.UserSession
import com.marketmind.mobile.R
import com.marketmind.mobile.ui.social.StatsContent
import com.marketmind.mobile.ui.voice.IntentFormMapper
import com.marketmind.mobile.ui.voice.VoiceBriefCard
import com.marketmind.mobile.ui.voice.VoiceResumen

private val BrandBlue = Color(0xFF4D4AF0)
private val BrandBlueSoft = Color(0xFF6865F3)
private val PageBackground = Color(0xFFFCF9FF)
private val TextDark = Color(0xFF12132A)
private val TextMuted = Color(0xFF74778A)
private val SuccessBlue = Color(0xFF7077FF)
private val WarningBrown = Color(0xFFA76525)
private val DangerRed = Color(0xFFD73737)
private val FieldBackground = Color(0xFFF4F1FB)
private val FieldBorder = Color(0xFFE1DDF3)

private val industryOptions = listOf(
    "tecnologia",
    "salud",
    "educacion",
    "retail",
    "gastronomia",
    "moda",
    "finanzas",
    "entretenimiento",
    "otro",
)

private val toneOptions = listOf(
    "profesional",
    "casual",
    "urgente",
    "inspiracional",
    "humoristico",
    "persuasivo",
)

private val platformOptions = listOf(
    PlatformOption(
        value = "facebook",
        label = "Facebook",
        color = Color(0xFF1877F2),
        drawableRes = R.drawable.facebook_logo,
    ),
    PlatformOption(
        value = "instagram",
        label = "Instagram",
        color = Color(0xFFE8409C),
        drawableRes = R.drawable.ig_logo,
    ),
    PlatformOption(
        value = "linkedin",
        label = "LinkedIn",
        color = Color(0xFF0A66C2),
        drawableRes = R.drawable.linkedin_logo,
    ),
)

@Composable
fun HomeScreen(
    onLogout: () -> Unit,
    onCampaignClick: (Long) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableStateOf(AppTab.Home) }
    var selectedProject by remember { mutableStateOf<CampaignDto?>(null) }

    Scaffold(
        containerColor = PageBackground,
        topBar = {
            if (selectedTab == AppTab.ProjectDetail) {
                ProjectDetailTopBar(
                    title = selectedProject?.titulo.orEmpty().ifBlank { "Campaña" },
                    onBack = { selectedTab = AppTab.Projects },
                )
            } else {
                HomeTopBar(
                    nombre = (uiState as? HomeUiState.Success)?.user?.nombre,
                    onAvatarClick = { selectedTab = AppTab.Account },
                )
            }
        },
        floatingActionButton = {
            if (selectedTab == AppTab.Home) {
                FloatingActionButton(
                    onClick = { selectedTab = AppTab.AiLab },
                    containerColor = BrandBlue,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.size(58.dp),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = null,
                        modifier = Modifier.size(30.dp),
                    )
                }
            }
        },
        bottomBar = {
            if (selectedTab != AppTab.ProjectDetail) {
                BottomNavigationBar(
                    selectedTab = selectedTab,
                    onTabSelected = { selectedTab = it },
                )
            }
        },
    ) { innerPadding ->
        when (val state = uiState) {
            HomeUiState.Loading -> Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = BrandBlue)
            }
            is HomeUiState.Error -> ErrorPanel(
                message = state.message,
                onRetry = viewModel::refresh,
                modifier = Modifier.padding(innerPadding),
            )
            HomeUiState.Empty -> ErrorPanel(
                message = "No hay campañas registradas para este marketero.",
                onRetry = viewModel::refresh,
                modifier = Modifier.padding(innerPadding),
            )
            is HomeUiState.Success -> when (selectedTab) {
                AppTab.Home -> HomeDashboard(
                    user = state.user,
                    campaigns = state.items,
                    stats = state.stats,
                    onCampaignClick = onCampaignClick,
                    modifier = Modifier.padding(innerPadding),
                )
                AppTab.AiLab -> AiLabScreen(
                    creating = state.creating,
                    generating = state.creating || state.items.any { it.estado == "pendiente_ia" },
                    previewCampaign = state.items.firstOrNull { it.hasReadyImage() },
                    message = state.message,
                    interpreting = state.interpreting,
                    intent = state.intent,
                    onInterpret = viewModel::interpretBrief,
                    onCreate = viewModel::createCampaign,
                    modifier = Modifier.padding(innerPadding),
                )
                AppTab.Projects -> ProjectsScreen(
                    campaigns = state.items,
                    onProjectClick = {
                        selectedProject = it
                        selectedTab = AppTab.ProjectDetail
                    },
                    modifier = Modifier.padding(innerPadding),
                )
                AppTab.Stats -> StatsContent(
                    alcance = "Las publicaciones de todos tus clientes.",
                    modifier = Modifier.padding(innerPadding),
                )
                AppTab.Account -> AccountScreen(
                    user = state.user,
                    onLogout = {
                        viewModel.logout()
                        onLogout()
                    },
                    modifier = Modifier.padding(innerPadding),
                )
                AppTab.ProjectDetail -> selectedProject?.let {
                    ProjectDetailScreen(
                        campaign = it,
                        onImproveText = { onDone ->
                            viewModel.improveText(it.id) { updated ->
                                if (updated != null) selectedProject = updated
                                onDone()
                            }
                        },
                        onEditText = { nuevoTexto, onDone ->
                            viewModel.editText(it.id, nuevoTexto, it.version) { updated ->
                                if (updated != null) selectedProject = updated
                                onDone()
                            }
                        },
                        modifier = Modifier.padding(innerPadding),
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeDashboard(
    user: UserSession,
    campaigns: List<CampaignDto>,
    stats: CampaignStatsDto,
    onCampaignClick: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
    ) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            ) {
                Text(
                    text = "Hola, ${user.nombre}",
                    color = TextDark,
                    fontSize = 19.sp,
                    lineHeight = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 10.dp),
                )
                Text(
                    text = "Este es el rendimiento de tus campañas.",
                    color = TextDark,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )

                MetricsGrid(stats = stats, modifier = Modifier.padding(top = 18.dp))

                ResumenCard(stats = stats, modifier = Modifier.padding(top = 18.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Campañas recientes",
                        color = TextDark,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    TextButton(onClick = { }) {
                        Text(
                            text = "Ver todo",
                            color = BrandBlue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        items(campaigns.take(5).size, key = { campaigns[it].id }) { index ->
            CampaignPreviewCard(
                campaign = campaigns[index].toPreview(),
                onClick = onCampaignClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
            )
        }

        item {
            Spacer(modifier = Modifier.height(14.dp))
        }
    }
}

@Composable
private fun AiLabScreen(
    creating: Boolean,
    generating: Boolean,
    previewCampaign: CampaignDto?,
    message: String?,
    interpreting: Boolean,
    intent: CampaignIntentDto?,
    onInterpret: (texto: String, porVoz: Boolean) -> Unit,
    onCreate: (
        titulo: String,
        clienteNombre: String,
        clienteEmail: String,
        industria: String,
        tono: String,
        plataforma: String,
        prompt: String,
    ) -> Unit,
    modifier: Modifier = Modifier,
) {
    var titulo by remember { mutableStateOf("") }
    var clienteNombre by remember { mutableStateOf("") }
    var clienteEmail by remember { mutableStateOf("") }
    var industria by remember { mutableStateOf("") }
    var tono by remember { mutableStateOf("") }
    var plataforma by remember { mutableStateOf("") }
    var prompt by remember { mutableStateOf("") }
    var resumen by remember { mutableStateOf<VoiceResumen?>(null) }

    // Al llegar una interpretación nueva se vuelcan al formulario los campos válidos.
    LaunchedEffect(intent?.id) {
        if (intent == null) return@LaunchedEffect
        val resultado = IntentFormMapper.paraFormulario(
            intent.camposFinales,
            mapOf(
                "industria" to industryOptions,
                "tono" to toneOptions,
                "plataforma" to platformOptions.map { it.value },
            ),
        )
        resultado.valores["titulo"]?.let { titulo = it }
        resultado.valores["cliente_nombre"]?.let { clienteNombre = it }
        resultado.valores["cliente_email"]?.let { clienteEmail = it }
        resultado.valores["industria"]?.let { industria = it }
        resultado.valores["tono"]?.let { tono = it }
        resultado.valores["plataforma"]?.let { plataforma = it }
        resultado.valores["prompt"]?.let { prompt = it }
        resumen = VoiceResumen(
            completados = resultado.completados.size,
            pendientes = resultado.pendientesLegibles,
            advertencias = intent.advertencias.orEmpty(),
        )
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(top = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Nueva campaña",
                    color = TextDark,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
            Box(
                modifier = Modifier
                    .padding(horizontal = 8.dp)
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFE7E3F4)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.28f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(BrandBlue),
                )
            }
        }

        item {
            VoiceBriefCard(
                interpreting = interpreting,
                resumen = resumen,
                enabled = !generating,
                onInterpret = onInterpret,
                modifier = Modifier
                    .padding(horizontal = 8.dp)
                    .padding(top = 22.dp),
            )
        }

        item {
            CampaignBuilderCard(
                titulo = titulo,
                onTituloChange = { titulo = it },
                clienteNombre = clienteNombre,
                onClienteNombreChange = { clienteNombre = it },
                clienteEmail = clienteEmail,
                onClienteEmailChange = { clienteEmail = it },
                industria = industria,
                onIndustriaChange = { industria = it },
                tono = tono,
                onTonoChange = { tono = it },
                plataforma = plataforma,
                onPlataformaChange = { plataforma = it },
                prompt = prompt,
                onPromptChange = { prompt = it },
                creating = creating,
                generating = generating,
                onCreate = {
                    onCreate(titulo, clienteNombre, clienteEmail, industria, tono, plataforma, prompt)
                },
                modifier = Modifier
                    .padding(horizontal = 8.dp)
                    .padding(top = 22.dp),
            )
        }

        message?.takeIf { !generating }?.let {
            item {
                Text(
                    text = it,
                    color = BrandBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 18.sp,
                    modifier = Modifier
                        .padding(horizontal = 8.dp)
                        .padding(top = 12.dp),
                )
            }
        }

        if (previewCampaign != null) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp)
                        .padding(top = 12.dp, bottom = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "AI Generation Preview",
                        color = TextDark,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = BrandBlue,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            item {
                AiPreviewCard(
                    campaign = previewCampaign,
                    modifier = Modifier
                        .padding(horizontal = 8.dp)
                        .padding(bottom = 18.dp),
                )
            }
        }
    }
}

@Composable
private fun HomeTopBar(nombre: String?, onAvatarClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.72f))
            .statusBarsPadding()
            .height(56.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.nexomark_logo),
            contentDescription = null,
            modifier = Modifier
                .padding(end = 10.dp)
                .size(30.dp),
        )
        Text(
            text = "NexoMark IA",
            color = Color(0xFF252166),
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = Icons.Filled.NotificationsNone,
            contentDescription = null,
            tint = TextDark,
            modifier = Modifier
                .padding(end = 12.dp)
                .size(22.dp),
        )
        Surface(
            onClick = onAvatarClick,
            modifier = Modifier.size(31.dp),
            shape = CircleShape,
            color = Color(0xFFE4F2F4),
            border = BorderStroke(1.dp, Color.White),
            shadowElevation = 2.dp,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    nombre?.trim()?.firstOrNull()?.uppercase() ?: "M",
                    color = TextDark,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun ProjectDetailTopBar(
    title: String,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.82f))
            .statusBarsPadding()
            .height(56.dp)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            onClick = onBack,
            shape = CircleShape,
            color = Color.Transparent,
            modifier = Modifier.size(36.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Filled.ArrowBack,
                    contentDescription = null,
                    tint = BrandBlue,
                    modifier = Modifier.size(22.dp),
                )
            }
        }
        Text(
            text = title,
            color = TextDark,
            fontSize = 17.sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 8.dp),
        )
        Button(
            onClick = { },
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.height(38.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp),
        ) {
            Text(
                text = "Publicar",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
    }
}

@Composable
private fun MetricsGrid(stats: CampaignStatsDto, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MetricCard(
                icon = Icons.Filled.Campaign,
                label = "Campañas",
                value = stats.total.toString(),
                color = BrandBlue,
                modifier = Modifier.weight(1f),
            )
            MetricCard(
                icon = Icons.Filled.HourglassEmpty,
                label = "Pendientes",
                value = stats.pendienteAprobacion.toString(),
                color = WarningBrown,
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MetricCard(
                icon = Icons.Filled.CheckCircle,
                label = "Aprobadas",
                value = stats.aprobado.toString(),
                color = SuccessBlue,
                modifier = Modifier.weight(1f),
            )
            MetricCard(
                icon = Icons.Filled.Close,
                label = "Rechazadas",
                value = stats.rechazado.toString(),
                color = DangerRed,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MetricCard(
    icon: ImageVector,
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier,
    trend: String? = null,
) {
    Card(
        modifier = modifier.aspectRatio(1.48f),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(2.dp, color.copy(alpha = 0.68f)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background(color.copy(alpha = 0.13f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(16.dp),
                    )
                }
                trend?.let {
                    Text(it, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(modifier = Modifier.height(9.dp))
            Text(
                text = label,
                color = TextMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = value,
                color = TextDark,
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun ResumenCard(stats: CampaignStatsDto, modifier: Modifier = Modifier) {
    val resumen = resumenInicio(stats)
    Card(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 146.dp),
        shape = RoundedCornerShape(11.dp),
        colors = CardDefaults.cardColors(containerColor = BrandBlue),
        elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.horizontalGradient(listOf(BrandBlue, BrandBlueSoft))),
        ) {
            Icon(
                imageVector = Icons.Filled.Settings,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.18f),
                modifier = Modifier
                    .size(92.dp)
                    .align(Alignment.BottomEnd)
                    .padding(end = 4.dp, bottom = 2.dp),
            )
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(15.dp),
                    )
                    Text(
                        text = "  Tu resumen",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
                Text(
                    text = resumen.titulo,
                    color = Color.White,
                    fontSize = 20.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 8.dp, end = 56.dp),
                )
                Text(
                    text = resumen.detalle,
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun CampaignBuilderCard(
    titulo: String,
    onTituloChange: (String) -> Unit,
    clienteNombre: String,
    onClienteNombreChange: (String) -> Unit,
    clienteEmail: String,
    onClienteEmailChange: (String) -> Unit,
    industria: String,
    onIndustriaChange: (String) -> Unit,
    tono: String,
    onTonoChange: (String) -> Unit,
    plataforma: String,
    onPlataformaChange: (String) -> Unit,
    prompt: String,
    onPromptChange: (String) -> Unit,
    creating: Boolean,
    generating: Boolean,
    onCreate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        border = BorderStroke(1.dp, Color(0xFFEDEAF6)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            CampaignField(label = "Título de campaña", value = titulo, onValueChange = onTituloChange)
            CampaignField(label = "Nombre del cliente", value = clienteNombre, onValueChange = onClienteNombreChange)
            CampaignField(label = "Email del cliente", value = clienteEmail, onValueChange = onClienteEmailChange)
            CampaignDropdown(
                label = "Industria",
                value = industria,
                options = industryOptions,
                onValueChange = onIndustriaChange,
                placeholder = "Selecciona una industria",
            )
            CampaignDropdown(
                label = "Tono",
                value = tono,
                options = toneOptions,
                onValueChange = onTonoChange,
                placeholder = "Selecciona un tono",
            )
            PlatformSelector(
                selected = plataforma,
                onSelected = onPlataformaChange,
            )
            CampaignField(label = "Prompt IA", value = prompt, onValueChange = onPromptChange)

            Button(
                onClick = onCreate,
                enabled = !generating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
            ) {
                if (generating) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp),
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = "  Generar con IA",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }

            if (generating) {
                GeneratingImageStatus()
            }
        }
    }
}

@Composable
private fun CampaignField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = label != "Prompt IA",
            minLines = if (label == "Prompt IA") 3 else 1,
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White),
            shape = RoundedCornerShape(8.dp),
            placeholder = {
                Text(text = label, color = Color(0xFF8B8DA0), fontSize = 14.sp)
            },
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun CampaignDropdown(
    label: String,
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit,
    placeholder: String = "Selecciona una opción",
) {
    var expanded by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = {},
                readOnly = true,
                placeholder = { Text(placeholder, color = TextMuted) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onValueChange(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun PlatformSelector(
    selected: String,
    onSelected: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(
            text = "Selecciona la plataforma",
            color = TextMuted,
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            platformOptions.forEach { option ->
                val isSelected = selected == option.value
                PlatformLogoButton(
                    option = option,
                    selected = isSelected,
                    onClick = { onSelected(option.value) },
                )
            }
        }
    }
}

@Composable
private fun PlatformLogoButton(
    option: PlatformOption,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Surface(
            onClick = onClick,
            modifier = Modifier.size(72.dp),
            shape = CircleShape,
            color = Color(0xFFF7F6FF),
            border = BorderStroke(
                width = if (selected) 3.dp else 2.dp,
                color = if (selected) option.color else Color(0xFFD8D6E8),
            ),
            shadowElevation = if (selected) 5.dp else 1.dp,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(id = option.drawableRes),
                        contentDescription = option.label,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop,
                    )
                }
            }
        }
        Text(
            text = option.label,
            color = if (selected) option.color else TextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
        )
    }
}

@Composable
private fun GeneratingImageStatus() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFECEBFF))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(
            color = BrandBlue,
            strokeWidth = 2.dp,
            modifier = Modifier.size(20.dp),
        )
        Text(
            text = "Generando imagen...",
            color = BrandBlue,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}

@Composable
private fun AiPreviewCard(
    campaign: CampaignDto,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(2.dp, Color(0xFFE3DDF9)),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(232.dp)
                    .background(Color(0xFFF4F1EC)),
            ) {
                CampaignImage(campaign)
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = BrandBlue,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(14.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.AutoAwesome,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = " AI IMAGE",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(22.dp),
            ) {
                Text(
                    text = "GENERATED COPY",
                    color = Color(0xFF7B74F2),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                )
                Text(
                    text = campaign.titulo.orEmpty().ifBlank { "Campaña generada" },
                    color = TextDark,
                    fontSize = 23.sp,
                    lineHeight = 27.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 10.dp),
                )
                Text(
                    text = campaign.textoGenerado
                        ?.takeIf { it.isNotBlank() }
                        ?: campaign.prompt
                        ?.takeIf { it.isNotBlank() }
                        ?: "Contenido generado por IA.",
                    color = Color(0xFF76798D),
                    fontSize = 16.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 14.dp),
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(top = 18.dp),
                ) {
                    TagPill("#${campaign.plataforma ?: "marketmind"}")
                    TagPill("#${campaign.industria ?: "ia"}")
                }
            }
        }
    }
}

@Composable
private fun CampaignImage(campaign: CampaignDto) {
    val imagenB64 = campaign.imagenB64?.takeIf { it.isNotBlank() }
    if (imagenB64 != null) {
        val imageBytes = runCatching { Base64.decode(imagenB64, Base64.DEFAULT) }.getOrNull()
        val bitmap = imageBytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Imagen generada",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
            return
        }
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFFF8F5EE), Color(0xFFE9DFD2), Color(0xFFCEC0AF)),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = campaign.imagenUrl?.takeIf { it.isNotBlank() } ?: "Imagen lista",
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
    }
}

@Composable
private fun TagPill(text: String) {
    Text(
        text = text,
        color = Color(0xFF7B7E91),
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier
            .clip(RoundedCornerShape(7.dp))
            .background(Color(0xFFECEEFF))
            .padding(horizontal = 10.dp, vertical = 7.dp),
    )
}

@Composable
private fun ProjectDetailScreen(
    campaign: CampaignDto,
    onImproveText: (onDone: () -> Unit) -> Unit,
    onEditText: (nuevoTexto: String, onDone: () -> Unit) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 8.dp),
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                DetailChip("GENERADO POR IA", selected = true)
                DetailChip("Actualizado hace 5 min")
            }

            Surface(
                shape = RoundedCornerShape(9.dp),
                color = Color(0xFFF7F5FE),
                border = BorderStroke(1.dp, Color(0xFFDCD6F1)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Filled.History,
                        contentDescription = null,
                        tint = TextDark,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = "Historial de versiones",
                        color = TextDark,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 10.dp),
                    )
                    Icon(
                        imageVector = Icons.Filled.ExpandMore,
                        contentDescription = null,
                        tint = TextDark,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            EditorCard(
                campaign = campaign,
                onImproveText = onImproveText,
                onEditText = onEditText,
                modifier = Modifier.padding(top = 16.dp, bottom = 18.dp),
            )
        }
    }
}

@Composable
private fun DetailChip(
    text: String,
    selected: Boolean = false,
) {
    val background = if (selected) Color(0xFFECEBFF) else Color(0xFFF4F1F8)
    val color = if (selected) BrandBlue else TextMuted
    Text(
        text = text,
        color = color,
        fontSize = 9.sp,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .border(1.dp, Color(0xFFE0DCEE), RoundedCornerShape(14.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        maxLines = 1,
    )
}

@Composable
private fun EditorCard(
    campaign: CampaignDto,
    onImproveText: (onDone: () -> Unit) -> Unit,
    onEditText: (nuevoTexto: String, onDone: () -> Unit) -> Unit,
    modifier: Modifier = Modifier,
) {
    var improving by remember(campaign.id) { mutableStateOf(false) }
    var editing by remember(campaign.id) { mutableStateOf(false) }
    var saving by remember(campaign.id) { mutableStateOf(false) }
    var editText by remember(campaign.id, campaign.textoGenerado) {
        mutableStateOf(campaign.textoGenerado.orEmpty())
    }
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, Color(0xFFE2DDF0)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.FormatBold,
                    contentDescription = null,
                    tint = TextDark,
                    modifier = Modifier.size(21.dp),
                )
                Icon(
                    imageVector = Icons.Filled.FormatItalic,
                    contentDescription = null,
                    tint = TextDark,
                    modifier = Modifier
                        .padding(start = 18.dp)
                        .size(21.dp),
                )
                Icon(
                    imageVector = Icons.Filled.FormatListBulleted,
                    contentDescription = null,
                    tint = TextDark,
                    modifier = Modifier
                        .padding(start = 18.dp)
                        .size(21.dp),
                )
                Icon(
                    imageVector = Icons.Filled.Link,
                    contentDescription = null,
                    tint = TextDark,
                    modifier = Modifier
                        .padding(start = 18.dp)
                        .size(21.dp),
                )
                Spacer(modifier = Modifier.weight(1f))
                IconButton(
                    onClick = {
                        editText = campaign.textoGenerado.orEmpty()
                        editing = !editing
                    },
                    modifier = Modifier.size(28.dp),
                ) {
                    Icon(
                        imageVector = if (editing) Icons.Filled.Close else Icons.Filled.Edit,
                        contentDescription = if (editing) "Cancelar edición" else "Editar texto",
                        tint = if (editing) Color(0xFFE23D3D) else BrandBlue,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            Text(
                text = campaign.titulo.orEmpty().ifBlank { "Campaña sin título" },
                color = TextDark,
                fontSize = 20.sp,
                lineHeight = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 24.dp),
            )
            if (editing) {
                OutlinedTextField(
                    value = editText,
                    onValueChange = { editText = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 14.sp,
                        lineHeight = 21.sp,
                        color = TextDark,
                    ),
                    shape = RoundedCornerShape(8.dp),
                    minLines = 4,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Button(
                        onClick = {
                            if (!saving && editText.isNotBlank()) {
                                saving = true
                                onEditText(editText.trim()) {
                                    saving = false
                                    editing = false
                                }
                            }
                        },
                        enabled = !saving && editText.isNotBlank(),
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                    ) {
                        if (saving) {
                            CircularProgressIndicator(
                                color = Color.White,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(16.dp),
                            )
                        } else {
                            Text("Guardar cambios", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Text(
                    text = campaign.textoGenerado
                        ?.takeIf { it.isNotBlank() }
                        ?: campaign.prompt
                        ?.takeIf { it.isNotBlank() }
                        ?: "La campaña todavía no tiene contenido generado.",
                    color = Color(0xFF4A4D66),
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${campaign.textoGenerado.orEmpty().split(Regex("\\s+")).filter { it.isNotBlank() }.size} palabras",
                    color = TextDark,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF18B65B)),
                    )
                    Text(
                        text = " Guardado",
                        color = TextDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            Button(
                onClick = {
                    if (!improving) {
                        improving = true
                        onImproveText { improving = false }
                    }
                },
                enabled = !improving,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(top = 12.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 3.dp),
            ) {
                if (improving) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "  Mejorando…",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "  Mejorar redacción con IA",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun CampaignPreviewCard(
    campaign: CampaignPreview,
    onClick: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = { onClick(campaign.id) },
        modifier = modifier.height(72.dp),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CampaignThumbnail(campaign.accent)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 14.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = campaign.title,
                    color = TextDark,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "Actualizada el ${campaign.updated}",
                    color = TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
            StatusPill(campaign.status)
        }
    }
}

@Composable
private fun ErrorPanel(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = message,
            color = TextDark,
            fontSize = 16.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Bold,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text("Reintentar", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

private fun CampaignDto.toPreview(): CampaignPreview {
    return CampaignPreview(
        id = id,
        title = titulo.orEmpty().ifBlank { "Campaña sin título" },
        updated = fechaActualizacion?.let { formatShortDate(it) }
            ?: fechaCreacion?.let { formatShortDate(it) }
            ?: "sin fecha",
        status = estado,
        accent = when (plataforma?.lowercase()) {
            "facebook" -> Color(0xFF1877F2)
            "instagram" -> Color(0xFFE8409C)
            "linkedin" -> Color(0xFF0A66C2)
            "tiktok" -> Color(0xFF111111)
            else -> BrandBlue
        },
    )
}

private fun CampaignDto.statusColor(): Pair<Color, Color> = when (estado) {
    "aprobado" -> Color(0xFF087A44) to Color(0xFFCFF8E4)
    "rechazado" -> DangerRed to Color(0xFFFFE0E0)
    "pendiente_aprobacion" -> WarningBrown to Color(0xFFF3E0C8)
    "generado" -> BrandBlue to Color(0xFFE8E7FF)
    else -> TextMuted to Color(0xFFECEAF5)
}

private fun CampaignDto.hasReadyImage(): Boolean =
    !imagenB64.isNullOrBlank() || !imagenUrl.isNullOrBlank()

private fun formatShortDate(value: String): String =
    value.substringBefore("T").ifBlank { value }

private data class PlatformOption(
    val value: String,
    val label: String,
    val color: Color,
    val drawableRes: Int,
)

@Composable
private fun CampaignThumbnail(accent: Color) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .clip(RoundedCornerShape(7.dp))
            .background(Color(0xFFF3F4FA))
            .border(1.dp, Color.White, RoundedCornerShape(7.dp)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(accent.copy(alpha = 0.88f), Color.White, Color(0xFF1D1B25)),
                    ),
                ),
        )
        Icon(
            imageVector = Icons.Filled.AutoAwesome,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(4.dp)
                .size(14.dp),
        )
    }
}

@Composable
private fun StatusPill(estado: String) {
    val colors = when (estado) {
        "aprobado" -> Color(0xFF087A44) to Color(0xFFCFF8E4)
        "rechazado", "fracaso" -> DangerRed to Color(0xFFFFE0E0)
        "pendiente_aprobacion" -> Color(0xFF9B6933) to Color(0xFFF3E0C8)
        "generado", "pendiente_ia" -> Color(0xFF4D4AF0) to Color(0xFFE7E6FF)
        else -> TextMuted to Color(0xFFECEAF5)
    }
    Text(
        text = etiquetaEstadoCorta(estado).uppercase(),
        color = colors.first,
        fontSize = 9.sp,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(colors.second)
            .padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

@Composable
private fun ProjectsScreen(
    campaigns: List<CampaignDto>,
    onProjectClick: (CampaignDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by remember { mutableStateOf("") }
    val filteredCampaigns = remember(query, campaigns) {
        val normalized = query.trim().lowercase()
        if (normalized.isBlank()) {
            campaigns
        } else {
            campaigns.filter { campaign ->
                listOfNotNull(
                    campaign.titulo,
                    campaign.clienteNombre,
                    campaign.industria,
                    campaign.plataforma,
                    campaign.estado,
                ).any { it.lowercase().contains(normalized) }
            }
        }
    }
    LazyColumn(modifier = modifier.fillMaxSize()) {
        item {
            SearchBox(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .padding(horizontal = 8.dp)
                    .padding(top = 14.dp),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(top = 14.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                FilterPill("Todas", selected = true)
                FilterPill("Activas")
                FilterPill("Borradores")
                FilterPill("Terminadas")
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(top = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Mis Campañas",
                    color = TextDark,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "${filteredCampaigns.size} TOTAL",
                    color = TextMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                )
            }
        }

        items(filteredCampaigns.size, key = { filteredCampaigns[it].id }) { index ->
            ProjectSummaryCard(
                campaign = filteredCampaigns[index],
                onClick = onProjectClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            )
        }

        item {
            Spacer(modifier = Modifier.height(14.dp))
        }
    }
}

@Composable
private fun AccountScreen(
    user: UserSession,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(modifier = modifier.fillMaxSize()) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(top = 14.dp),
            ) {
                Text(
                    text = "Cuenta",
                    color = TextDark,
                    fontSize = 27.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "Datos reales de la sesión autenticada en el backend.",
                    color = TextDark,
                    fontSize = 16.sp,
                    lineHeight = 22.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }

        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(top = 26.dp, bottom = 18.dp),
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                border = BorderStroke(1.dp, Color(0xFFDAD4EA)),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    ProfileAvatar()

                    Spacer(modifier = Modifier.height(24.dp))

                    AccountField(label = "NOMBRE", value = user.nombre)
                    AccountField(label = "EMAIL", value = user.email)
                    AccountField(label = "ROL", value = user.role)
                    AccountField(label = "TOKENS IA", value = user.tokensDisponibles.toString())

                    Button(
                        onClick = onLogout,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .padding(top = 4.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE23D3D)),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
                    ) {
                        Text(
                            text = "Cerrar sesión",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchBox(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        leadingIcon = {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = null,
                tint = TextMuted,
                modifier = Modifier.size(22.dp),
            )
        },
        placeholder = {
            Text(
                text = "Buscar campañas...",
                color = Color(0xFFAAA6B8),
                fontSize = 15.sp,
            )
        },
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp),
    )
}

@Composable
private fun FilterPill(
    label: String,
    selected: Boolean = false,
) {
    val background = if (selected) BrandBlue else Color(0xFFECEAF5)
    val color = if (selected) Color.White else TextDark

    Surface(
        shape = RoundedCornerShape(22.dp),
        color = background,
    ) {
        Text(
            text = label,
            color = color,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            maxLines = 1,
        )
    }
}

@Composable
private fun ProjectSummaryCard(
    campaign: CampaignDto,
    onClick: (CampaignDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = { onClick(campaign) },
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, Color(0xFFDAD4EA)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    val statusColor = campaign.statusColor()
                    StatusBadge(campaign.estado.uppercase(), statusColor.first, statusColor.second)
                    Text(
                        text = campaign.titulo.orEmpty().ifBlank { "Campaña sin título" },
                        color = TextDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(top = 9.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Icon(
                    imageVector = Icons.Filled.MoreVert,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(24.dp),
                )
            }

            Row(
                modifier = Modifier.padding(top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PlatformBubble(Icons.Filled.Campaign, BrandBlue)
                Text(
                    text = listOfNotNull(campaign.plataforma, campaign.industria)
                        .filter { it.isNotBlank() }
                        .joinToString(" · ")
                        .ifBlank { "Sin plataforma" },
                    color = TextMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(start = 9.dp),
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFECEAF3))
                    .padding(top = 18.dp),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 18.dp),
            ) {
                MetricText("TOKENS", (campaign.tokensConsumidos ?: 0).toString(), modifier = Modifier.weight(1f))
                MetricText("INTENTOS", (campaign.intentosGeneracion ?: 0).toString(), modifier = Modifier.weight(1f))
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = campaign.fechaCreacion?.let { "Creada ${formatShortDate(it)}" } ?: "Sin fecha",
                    color = TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
                Text(
                    text = "Ver detalles  ->",
                    color = BrandBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    color: Color,
    background: Color,
) {
    Text(
        text = text,
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier
            .clip(RoundedCornerShape(5.dp))
            .background(background)
            .padding(horizontal = 9.dp, vertical = 5.dp),
    )
}

@Composable
private fun PlatformBubble(icon: ImageVector, color: Color) {
    Box(
        modifier = Modifier
            .size(23.dp)
            .clip(CircleShape)
            .background(Color(0xFFE8E7FF)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(14.dp),
        )
    }
}

@Composable
private fun MetricText(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Text(
            text = value,
            color = BrandBlue,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun ProfileAvatar() {
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(86.dp)
                .clip(CircleShape)
                .background(Color(0xFFECEAFF))
                .border(1.dp, Color(0xFFD3CFF0), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFFF6D7C6), Color(0xFFB56E58)),
                        ),
                    ),
            )
        }
    }
}

@Composable
private fun AccountField(label: String, value: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 18.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = label,
            color = TextDark,
            fontSize = 12.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(FieldBackground)
                .border(1.dp, Color(0xFFD7D0E8), RoundedCornerShape(9.dp))
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            Text(
                text = value,
                color = TextDark,
                fontSize = 16.sp,
            )
        }
    }
}

@Composable
private fun BottomNavigationBar(
    selectedTab: AppTab,
    onTabSelected: (AppTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .navigationBarsPadding()
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        navItems.forEach { item ->
            NavItem(
                item = item,
                selected = selectedTab == item.tab,
                onClick = { onTabSelected(item.tab) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun NavItem(
    item: NavItemSpec,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color = if (selected) Color.White else TextMuted
    val background = if (selected) BrandBlue else Color.Transparent

    Surface(
        onClick = onClick,
        modifier = modifier
            .height(58.dp)
            .padding(horizontal = 3.dp),
        shape = RoundedCornerShape(12.dp),
        color = background,
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = item.label,
                color = color,
                fontSize = 12.sp,
                lineHeight = 14.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
            )
        }
    }
}

private enum class AppTab {
    Home,
    AiLab,
    Projects,
    Stats,
    Account,
    ProjectDetail,
}

private data class NavItemSpec(
    val tab: AppTab,
    val label: String,
    val icon: ImageVector,
)

private val navItems = listOf(
    NavItemSpec(AppTab.Home, "Inicio", Icons.Filled.Home),
    NavItemSpec(AppTab.AiLab, "IA", Icons.Filled.Science),
    NavItemSpec(AppTab.Projects, "Proyectos", Icons.Filled.WorkOutline),
    NavItemSpec(AppTab.Stats, "Métricas", Icons.Filled.BarChart),
    NavItemSpec(AppTab.Account, "Cuenta", Icons.Filled.AccountCircle),
)

private data class CampaignPreview(
    val id: Long,
    val title: String,
    val updated: String,
    /** Estado real de la campaña (borrador, generado, aprobado…). */
    val status: String,
    val accent: Color,
)


