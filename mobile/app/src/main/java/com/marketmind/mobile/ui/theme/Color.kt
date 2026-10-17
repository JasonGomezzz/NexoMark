package com.marketmind.mobile.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/*
 * Identidad NexoMark IA (frontend/DESIGN.md): azul marino #14283F + turquesa #17B8AD.
 * Los valores son los mismos de frontend/src/index.css (@theme para claro y
 * html[data-theme='dark'] para oscuro). Si cambia un token en la web se cambia aquí;
 * PaletaContrasteTest comprueba que coinciden y que los pares de texto cumplen AA.
 */

// Marca: iguales en ambos temas.
val NexoNavy = Color(0xFF14283F)
val NexoNavyDeep = Color(0xFF0B1929)
val NexoNavyRaised = Color(0xFF1D3550)
val NexoNavyLine = Color(0xFF2C4862)
val NexoTurquoise = Color(0xFF17B8AD)
val NexoTurquoiseSoft = Color(0xFF79DDD3)
val NexoOnNavy = Color(0xFFFFFFFF)
val NexoOnNavyMuted = Color(0xFFB9CBD8)
val NexoOnNavyError = Color(0xFFFFB4AB)

/** Blanco que no cambia con el modo oscuro (fondo de logos, icono sobre color de red). */
val NexoPaper = Color(0xFFFFFFFF)

/** Colores propios de cada red social; solo identifican la red (bordes, miniaturas). */
object NexoRedes {
    val Facebook = Color(0xFF1877F2)
    val Instagram = Color(0xFFE8409C)
    val LinkedIn = Color(0xFF0A66C2)
}

/** Tokens semánticos de un tema (claro u oscuro), con los nombres de index.css. */
@Immutable
data class NexoPalette(
    val background: Color,
    val surface: Color,
    val surfaceDim: Color,
    val surfaceBright: Color,
    val surfaceContainerLowest: Color,
    val surfaceContainerLow: Color,
    val surfaceContainer: Color,
    val surfaceContainerHigh: Color,
    val surfaceContainerHighest: Color,
    val surfaceVariant: Color,
    val onBackground: Color,
    val onSurface: Color,
    val onSurfaceVariant: Color,
    val inverseSurface: Color,
    val inverseOnSurface: Color,
    val outline: Color,
    val outlineVariant: Color,
    val primary: Color,
    val onPrimary: Color,
    val primaryContainer: Color,
    val onPrimaryContainer: Color,
    val inversePrimary: Color,
    val primaryFixed: Color,
    val primaryFixedDim: Color,
    val onPrimaryFixed: Color,
    val onPrimaryFixedVariant: Color,
    val secondary: Color,
    val onSecondary: Color,
    val secondaryContainer: Color,
    val onSecondaryContainer: Color,
    val tertiary: Color,
    val onTertiary: Color,
    val tertiaryContainer: Color,
    val onTertiaryContainer: Color,
    val error: Color,
    val onError: Color,
    val errorContainer: Color,
    val onErrorContainer: Color,
    val success: Color,
    val onSuccess: Color,
    val successContainer: Color,
    val warning: Color,
    val warningContainer: Color,
)

val NexoLightColors = NexoPalette(
    background = Color(0xFFF5FAFA),
    surface = Color(0xFFF5FAFA),
    surfaceDim = Color(0xFFD4E2E5),
    surfaceBright = Color(0xFFF5FAFA),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFEDF5F5),
    surfaceContainer = Color(0xFFE5EFEF),
    surfaceContainerHigh = Color(0xFFDCE9EA),
    surfaceContainerHighest = Color(0xFFD3E3E5),
    surfaceVariant = Color(0xFFD3E3E5),
    onBackground = Color(0xFF14283F),
    onSurface = Color(0xFF14283F),
    onSurfaceVariant = Color(0xFF425C67),
    inverseSurface = Color(0xFF14283F),
    inverseOnSurface = Color(0xFFEDF5F5),
    outline = Color(0xFF5A737D),
    outlineVariant = Color(0xFFB6CDD1),
    primary = Color(0xFF087B75),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFF086A65),
    onPrimaryContainer = Color(0xFFFFFFFF),
    inversePrimary = Color(0xFF79DDD3),
    primaryFixed = Color(0xFFE4F6F3),
    primaryFixedDim = Color(0xFF79DDD3),
    onPrimaryFixed = Color(0xFF14283F),
    onPrimaryFixedVariant = Color(0xFF086A65),
    secondary = Color(0xFF36566B),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE9F2F5),
    onSecondaryContainer = Color(0xFF294858),
    tertiary = Color(0xFF904900),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFE3C2),
    onTertiaryContainer = Color(0xFF301400),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF93000A),
    success = Color(0xFF2A7430),
    onSuccess = Color(0xFFFFFFFF),
    successContainer = Color(0xFFDCF3DD),
    warning = Color(0xFF9A4F00),
    warningContainer = Color(0xFFFFE3C2),
)

val NexoDarkColors = NexoPalette(
    background = Color(0xFF0B1929),
    surface = Color(0xFF14283F),
    surfaceDim = Color(0xFF0B1929),
    surfaceBright = Color(0xFF26445C),
    surfaceContainerLowest = Color(0xFF14283F),
    surfaceContainerLow = Color(0xFF193249),
    surfaceContainer = Color(0xFF203B52),
    surfaceContainerHigh = Color(0xFF29485F),
    surfaceContainerHighest = Color(0xFF33546B),
    surfaceVariant = Color(0xFF33546B),
    onBackground = Color(0xFFF3FAFB),
    onSurface = Color(0xFFF3FAFB),
    onSurfaceVariant = Color(0xFFBDCFD7),
    inverseSurface = Color(0xFFF3FAFB),
    inverseOnSurface = Color(0xFF14283F),
    outline = Color(0xFF90ACBA),
    outlineVariant = Color(0xFF3D5A6E),
    primary = Color(0xFF17B8AD),
    onPrimary = Color(0xFF0B1929),
    primaryContainer = Color(0xFF21C9BB),
    onPrimaryContainer = Color(0xFF0B1929),
    inversePrimary = Color(0xFF087B75),
    primaryFixed = Color(0xFF143A42),
    primaryFixedDim = Color(0xFF205960),
    onPrimaryFixed = Color(0xFFD1F4EE),
    onPrimaryFixedVariant = Color(0xFF79DDD3),
    secondary = Color(0xFFB8D0DD),
    onSecondary = Color(0xFF14283F),
    secondaryContainer = Color(0xFF1C364B),
    onSecondaryContainer = Color(0xFFE5F1F5),
    tertiary = Color(0xFFFFBD7C),
    onTertiary = Color(0xFF4B2700),
    tertiaryContainer = Color(0xFF633600),
    onTertiaryContainer = Color(0xFFFFDCC0),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    success = Color(0xFF8FD991),
    onSuccess = Color(0xFF00390A),
    successContainer = Color(0xFF173D1B),
    warning = Color(0xFFFFBD7C),
    warningContainer = Color(0xFF563100),
)

/** Texto y fondo de una pill. */
@Immutable
data class ColoresPill(val texto: Color, val fondo: Color)

/**
 * Badge de estado FSM, igual que la tabla "Badge de estado FSM" de frontend/DESIGN.md.
 * `fracaso` usa el tono de rechazo; cualquier estado desconocido, el de borrador.
 */
fun coloresEstado(estado: String?, paleta: NexoPalette): ColoresPill = with(paleta) {
    when (estado) {
        "pendiente_ia" -> ColoresPill(primary, primaryFixed)
        "generado" -> ColoresPill(primary, secondaryContainer)
        "pendiente_aprobacion" -> ColoresPill(tertiary, warningContainer)
        "aprobado" -> ColoresPill(success, successContainer)
        "rechazado", "fracaso" -> ColoresPill(error, errorContainer)
        else -> ColoresPill(onSurfaceVariant, surfaceContainerHigh)
    }
}
