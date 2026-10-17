package com.marketmind.mobile.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LocalNexoColors = staticCompositionLocalOf { NexoLightColors }

/** Acceso a los tokens que Material no tiene (éxito, aviso, primary-fixed) en el tema actual. */
object NexoTheme {
    val colors: NexoPalette
        @Composable
        @ReadOnlyComposable
        get() = LocalNexoColors.current
}

/** Colores del badge de estado FSM en el tema actual. */
@Composable
@ReadOnlyComposable
fun coloresEstado(estado: String?): ColoresPill = coloresEstado(estado, NexoTheme.colors)

internal fun NexoPalette.toColorScheme(dark: Boolean): ColorScheme =
    if (dark) darkScheme(this) else lightScheme(this)

private fun lightScheme(p: NexoPalette): ColorScheme = lightColorScheme(
    primary = p.primary,
    onPrimary = p.onPrimary,
    primaryContainer = p.primaryContainer,
    onPrimaryContainer = p.onPrimaryContainer,
    inversePrimary = p.inversePrimary,
    secondary = p.secondary,
    onSecondary = p.onSecondary,
    secondaryContainer = p.secondaryContainer,
    onSecondaryContainer = p.onSecondaryContainer,
    tertiary = p.tertiary,
    onTertiary = p.onTertiary,
    tertiaryContainer = p.tertiaryContainer,
    onTertiaryContainer = p.onTertiaryContainer,
    background = p.background,
    onBackground = p.onBackground,
    surface = p.surface,
    onSurface = p.onSurface,
    surfaceVariant = p.surfaceVariant,
    onSurfaceVariant = p.onSurfaceVariant,
    surfaceTint = p.primary,
    inverseSurface = p.inverseSurface,
    inverseOnSurface = p.inverseOnSurface,
    error = p.error,
    onError = p.onError,
    errorContainer = p.errorContainer,
    onErrorContainer = p.onErrorContainer,
    outline = p.outline,
    outlineVariant = p.outlineVariant,
    scrim = Color.Black,
    surfaceBright = p.surfaceBright,
    surfaceContainer = p.surfaceContainer,
    surfaceContainerHigh = p.surfaceContainerHigh,
    surfaceContainerHighest = p.surfaceContainerHighest,
    surfaceContainerLow = p.surfaceContainerLow,
    surfaceContainerLowest = p.surfaceContainerLowest,
    surfaceDim = p.surfaceDim,
)

private fun darkScheme(p: NexoPalette): ColorScheme = darkColorScheme(
    primary = p.primary,
    onPrimary = p.onPrimary,
    primaryContainer = p.primaryContainer,
    onPrimaryContainer = p.onPrimaryContainer,
    inversePrimary = p.inversePrimary,
    secondary = p.secondary,
    onSecondary = p.onSecondary,
    secondaryContainer = p.secondaryContainer,
    onSecondaryContainer = p.onSecondaryContainer,
    tertiary = p.tertiary,
    onTertiary = p.onTertiary,
    tertiaryContainer = p.tertiaryContainer,
    onTertiaryContainer = p.onTertiaryContainer,
    background = p.background,
    onBackground = p.onBackground,
    surface = p.surface,
    onSurface = p.onSurface,
    surfaceVariant = p.surfaceVariant,
    onSurfaceVariant = p.onSurfaceVariant,
    surfaceTint = p.primary,
    inverseSurface = p.inverseSurface,
    inverseOnSurface = p.inverseOnSurface,
    error = p.error,
    onError = p.onError,
    errorContainer = p.errorContainer,
    onErrorContainer = p.onErrorContainer,
    outline = p.outline,
    outlineVariant = p.outlineVariant,
    scrim = Color.Black,
    surfaceBright = p.surfaceBright,
    surfaceContainer = p.surfaceContainer,
    surfaceContainerHigh = p.surfaceContainerHigh,
    surfaceContainerHighest = p.surfaceContainerHighest,
    surfaceContainerLow = p.surfaceContainerLow,
    surfaceContainerLowest = p.surfaceContainerLowest,
    surfaceDim = p.surfaceDim,
)

/**
 * Tema NexoMark en claro y oscuro (sigue al sistema). El color dinámico de Android 12+
 * queda desactivado por defecto para que el fondo de pantalla no cambie la marca.
 */
@Composable
fun MarketMindMobileTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val palette = if (darkTheme) NexoDarkColors else NexoLightColors
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        else -> palette.toColorScheme(darkTheme)
    }

    CompositionLocalProvider(LocalNexoColors provides palette) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}
