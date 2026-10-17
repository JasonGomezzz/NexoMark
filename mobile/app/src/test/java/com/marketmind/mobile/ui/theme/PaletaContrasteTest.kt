package com.marketmind.mobile.ui.theme

import androidx.compose.ui.graphics.Color
import java.io.File
import kotlin.math.pow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Contraste WCAG 2.1 de la paleta NexoMark en claro y oscuro, con los mismos pares que
 * frontend/tests/brandPalette.test.js más los usos propios de la app (tarjetas, iconos,
 * badges FSM). Texto normal: 4.5:1. Texto grande, iconos y bordes de campo: 3:1.
 */
class PaletaContrasteTest {

    private val temas = listOf("claro" to NexoLightColors, "oscuro" to NexoDarkColors)

    // Los 22 pares de texto verificados en la web (brandPalette.test.js).
    private val paresTextoWeb: List<Triple<String, (NexoPalette) -> Color, (NexoPalette) -> Color>> = listOf(
        Triple("on-surface / background", { it.onSurface }, { it.background }),
        Triple("on-surface / surface", { it.onSurface }, { it.surface }),
        Triple("on-surface-variant / background", { it.onSurfaceVariant }, { it.background }),
        Triple("on-surface-variant / surface-container-lowest", { it.onSurfaceVariant }, { it.surfaceContainerLowest }),
        Triple("on-surface-variant / surface-container-low", { it.onSurfaceVariant }, { it.surfaceContainerLow }),
        Triple("on-surface-variant / surface-container-high", { it.onSurfaceVariant }, { it.surfaceContainerHigh }),
        Triple("primary / background", { it.primary }, { it.background }),
        Triple("primary / surface-container-lowest", { it.primary }, { it.surfaceContainerLowest }),
        Triple("primary / surface-container-low", { it.primary }, { it.surfaceContainerLow }),
        Triple("on-primary / primary", { it.onPrimary }, { it.primary }),
        Triple("on-primary-container / primary-container", { it.onPrimaryContainer }, { it.primaryContainer }),
        Triple("on-primary-fixed / primary-fixed", { it.onPrimaryFixed }, { it.primaryFixed }),
        Triple("primary / primary-fixed", { it.primary }, { it.primaryFixed }),
        Triple("primary / secondary-container", { it.primary }, { it.secondaryContainer }),
        Triple("on-secondary-container / secondary-container", { it.onSecondaryContainer }, { it.secondaryContainer }),
        Triple("tertiary / warning-container", { it.tertiary }, { it.warningContainer }),
        Triple("on-tertiary-container / tertiary-container", { it.onTertiaryContainer }, { it.tertiaryContainer }),
        Triple("success / success-container", { it.success }, { it.successContainer }),
        Triple("error / error-container", { it.error }, { it.errorContainer }),
        Triple("error / surface-container-lowest", { it.error }, { it.surfaceContainerLowest }),
        Triple("success / surface-container-lowest", { it.success }, { it.surfaceContainerLowest }),
        Triple("outline / surface-container-lowest", { it.outline }, { it.surfaceContainerLowest }),
    )

    // Usos de la app Android que la web no cubre.
    private val paresTextoApp: List<Triple<String, (NexoPalette) -> Color, (NexoPalette) -> Color>> = listOf(
        Triple("on-surface / surface-container-lowest (tarjetas)", { it.onSurface }, { it.surfaceContainerLowest }),
        Triple("on-surface / surface-container-low (campos de cuenta)", { it.onSurface }, { it.surfaceContainerLow }),
        Triple("on-surface / surface-container-high (filtros)", { it.onSurface }, { it.surfaceContainerHigh }),
        Triple("on-error / error (botón destructivo)", { it.onError }, { it.error }),
        Triple("on-error-container / error-container (motivo del rechazo)", { it.onErrorContainer }, { it.errorContainer }),
        Triple("tertiary / surface-container-low (advertencias del brief)", { it.tertiary }, { it.surfaceContainerLow }),
        Triple("outline / surface-container-low (placeholder sobre campo)", { it.outline }, { it.surfaceContainerLow }),
        Triple("inverse-on-surface / inverse-surface", { it.inverseOnSurface }, { it.inverseSurface }),
    )

    // Iconos y bordes (no texto): 3:1.
    private val paresNoTexto: List<Triple<String, (NexoPalette) -> Color, (NexoPalette) -> Color>> = listOf(
        Triple("outline / surface-container-lowest (borde de campo)", { it.outline }, { it.surfaceContainerLowest }),
        Triple("primary / surface-container-lowest (iconos)", { it.primary }, { it.surfaceContainerLowest }),
        Triple("warning / surface-container-lowest (métrica pendientes)", { it.warning }, { it.surfaceContainerLowest }),
        Triple("on-success / success (paso medido)", { it.onSuccess }, { it.success }),
        Triple("outline / surface-container-high (paso pendiente)", { it.outline }, { it.surfaceContainerHigh }),
    )

    private val estadosFsm = listOf(
        "borrador", "pendiente_ia", "generado", "pendiente_aprobacion", "aprobado", "rechazado", "fracaso",
    )

    @Test
    fun `la paleta conserva el marino y el turquesa del icono aprobado`() {
        assertEquals(0xFF14283F.toInt(), NexoNavy.argb())
        assertEquals(0xFF17B8AD.toInt(), NexoTurquoise.argb())
        assertEquals(0xFF14283F.toInt(), NexoLightColors.onSurface.argb())
        assertEquals(0xFF14283F.toInt(), NexoDarkColors.surface.argb())
        assertEquals(0xFF087B75.toInt(), NexoLightColors.primary.argb())
        assertEquals(0xFF17B8AD.toInt(), NexoDarkColors.primary.argb())
    }

    @Test
    fun `texto y estados cumplen AA en claro y oscuro`() {
        val fallos = temas.flatMap { (tema, p) ->
            (paresTextoWeb + paresTextoApp).mapNotNull { (nombre, fg, bg) ->
                val r = contraste(fg(p), bg(p))
                if (r < 4.5) "$tema · $nombre: ${"%.2f".format(r)}:1" else null
            }
        }
        assertTrue("Pares bajo 4.5:1:\n${fallos.joinToString("\n")}", fallos.isEmpty())
    }

    @Test
    fun `iconos y bordes de campo cumplen 3 a 1`() {
        val fallos = temas.flatMap { (tema, p) ->
            paresNoTexto.mapNotNull { (nombre, fg, bg) ->
                val r = contraste(fg(p), bg(p))
                if (r < 3.0) "$tema · $nombre: ${"%.2f".format(r)}:1" else null
            }
        }
        assertTrue("Pares bajo 3:1:\n${fallos.joinToString("\n")}", fallos.isEmpty())
    }

    @Test
    fun `los badges de estado FSM cumplen AA en ambos temas`() {
        val fallos = temas.flatMap { (tema, p) ->
            estadosFsm.mapNotNull { estado ->
                val c = coloresEstado(estado, p)
                val r = contraste(c.texto, c.fondo)
                if (r < 4.5) "$tema · $estado: ${"%.2f".format(r)}:1" else null
            }
        }
        assertTrue("Badges bajo 4.5:1:\n${fallos.joinToString("\n")}", fallos.isEmpty())
    }

    @Test
    fun `el texto sobre el panel marino de marca cumple AA`() {
        for (token in listOf(NexoOnNavy, NexoOnNavyMuted, NexoTurquoise, NexoTurquoiseSoft)) {
            val r = contraste(token, NexoNavy)
            assertTrue("${token.argb().toUInt().toString(16)} sobre marino: $r", r >= 4.5)
        }
    }

    @Test
    fun `el icono blanco se lee sobre el color de cada red`() {
        for (red in listOf(NexoRedes.Facebook, NexoRedes.Instagram, NexoRedes.LinkedIn)) {
            val r = contraste(NexoPaper, red)
            assertTrue("blanco sobre ${red.argb().toUInt().toString(16)}: $r", r >= 3.0)
        }
    }

    /** Los tokens de Kotlin son los mismos de frontend/src/index.css (si el archivo está en el repo). */
    @Test
    fun `los tokens coinciden con index css de la web`() {
        val css = listOf("../../frontend/src/index.css", "../frontend/src/index.css")
            .map(::File)
            .firstOrNull { it.isFile }
        assumeTrue("frontend/src/index.css no está disponible", css != null)
        val texto = css!!.readText()
        val claro = texto.substringAfter("@theme {").substringBefore("\n}")
        val oscuro = texto.substringAfter("html[data-theme='dark'] {").substringBefore("\n}")

        val diferencias = mutableListOf<String>()
        for ((bloque, paleta, tema) in listOf(Triple(claro, NexoLightColors, "claro"), Triple(oscuro, NexoDarkColors, "oscuro"))) {
            for ((token, valor) in tokensSemanticos(paleta)) {
                val web = hexDe(bloque, token) ?: continue
                if (web != valor.argb()) {
                    diferencias += "$tema · $token: web #${hex(web)} vs app #${hex(valor.argb())}"
                }
            }
        }
        for ((token, valor) in tokensMarca()) {
            val web = hexDe(claro, token)
            if (web == null || web != valor.argb()) diferencias += "marca · $token"
        }
        assertTrue("Tokens distintos de la web:\n${diferencias.joinToString("\n")}", diferencias.isEmpty())
    }

    @Test
    fun `no quedan colores del diseno anterior en el codigo de la app`() {
        val fuentes = File("src/main/java").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assumeTrue("no se encontró src/main/java", fuentes.isNotEmpty())
        val prohibidos = Regex("(?i)4D4AF0|6865F3|E7E6FF|12132A|EDEAF6|FCF9FF|7077FF|Purple|Pink")
        val hallazgos = fuentes.flatMap { f ->
            f.readLines().mapIndexedNotNull { i, linea ->
                if (prohibidos.containsMatchIn(linea)) "${f.path}:${i + 1}: ${linea.trim()}" else null
            }
        }
        assertTrue("Restos del índigo anterior:\n${hallazgos.joinToString("\n")}", hallazgos.isEmpty())
    }

    private fun tokensSemanticos(p: NexoPalette): Map<String, Color> = mapOf(
        "background" to p.background,
        "surface" to p.surface,
        "surface-dim" to p.surfaceDim,
        "surface-bright" to p.surfaceBright,
        "surface-container-lowest" to p.surfaceContainerLowest,
        "surface-container-low" to p.surfaceContainerLow,
        "surface-container" to p.surfaceContainer,
        "surface-container-high" to p.surfaceContainerHigh,
        "surface-container-highest" to p.surfaceContainerHighest,
        "surface-variant" to p.surfaceVariant,
        "on-background" to p.onBackground,
        "on-surface" to p.onSurface,
        "on-surface-variant" to p.onSurfaceVariant,
        "inverse-surface" to p.inverseSurface,
        "inverse-on-surface" to p.inverseOnSurface,
        "outline" to p.outline,
        "outline-variant" to p.outlineVariant,
        "primary" to p.primary,
        "on-primary" to p.onPrimary,
        "primary-container" to p.primaryContainer,
        "on-primary-container" to p.onPrimaryContainer,
        "inverse-primary" to p.inversePrimary,
        "primary-fixed" to p.primaryFixed,
        "primary-fixed-dim" to p.primaryFixedDim,
        "on-primary-fixed" to p.onPrimaryFixed,
        "on-primary-fixed-variant" to p.onPrimaryFixedVariant,
        "secondary" to p.secondary,
        "on-secondary" to p.onSecondary,
        "secondary-container" to p.secondaryContainer,
        "on-secondary-container" to p.onSecondaryContainer,
        "tertiary" to p.tertiary,
        "on-tertiary" to p.onTertiary,
        "tertiary-container" to p.tertiaryContainer,
        "on-tertiary-container" to p.onTertiaryContainer,
        "error" to p.error,
        "on-error" to p.onError,
        "error-container" to p.errorContainer,
        "on-error-container" to p.onErrorContainer,
        "success" to p.success,
        "on-success" to p.onSuccess,
        "success-container" to p.successContainer,
        "warning" to p.warning,
        "warning-container" to p.warningContainer,
    )

    private fun tokensMarca(): Map<String, Color> = mapOf(
        "navy" to NexoNavy,
        "navy-deep" to NexoNavyDeep,
        "navy-raised" to NexoNavyRaised,
        "navy-line" to NexoNavyLine,
        "turquoise" to NexoTurquoise,
        "turquoise-soft" to NexoTurquoiseSoft,
        "on-navy" to NexoOnNavy,
        "on-navy-muted" to NexoOnNavyMuted,
        "on-navy-error" to NexoOnNavyError,
        "paper" to NexoPaper,
    )

    private fun hexDe(bloque: String, token: String): Int? =
        Regex("--color-${Regex.escape(token)}: #([0-9a-fA-F]{6});").find(bloque)
            ?.groupValues?.get(1)?.let { (0xFF000000 or it.toLong(16)).toInt() }

    private fun hex(argb: Int): String = (argb.toLong() and 0xFFFFFF).toString(16).padStart(6, '0').uppercase()

    private fun Color.argb(): Int {
        val r = (red * 255 + 0.5f).toInt()
        val g = (green * 255 + 0.5f).toInt()
        val b = (blue * 255 + 0.5f).toInt()
        return (0xFF shl 24) or (r shl 16) or (g shl 8) or b
    }

    private fun luminancia(c: Color): Double {
        fun canal(v: Float): Double {
            val x = v.toDouble()
            return if (x <= 0.04045) x / 12.92 else ((x + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * canal(c.red) + 0.7152 * canal(c.green) + 0.0722 * canal(c.blue)
    }

    private fun contraste(a: Color, b: Color): Double {
        val (alta, baja) = listOf(luminancia(a), luminancia(b)).sortedDescending()
        return (alta + 0.05) / (baja + 0.05)
    }
}
