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

    // La app Kotlin está congelada con la paleta del 17/10 y ya no replica frontend/src/index.css.

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
