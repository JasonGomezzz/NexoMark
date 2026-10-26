package com.marketmind.nexomark

import android.content.Intent
import android.os.Build
import android.speech.ModelDownloadListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Canal "nexomark/voz": dice con honestidad dónde se transcribiría la voz.
 *
 * El plugin speech_to_text elige el reconocedor en el dispositivo si existe
 * (Android 12+), pero no informa si tiene el español instalado. Aquí se lee
 * con checkRecognitionSupport (Android 13+) y se puede pedir la descarga con
 * triggerModelDownload, igual que la app Kotlin (ui/voice/SpeechDictation.kt).
 * Referencias: developer.android.com/reference/android/speech/SpeechRecognizer.
 */
class MainActivity : FlutterActivity() {
    private val espanolCercano = listOf("es-PE", "es-419", "es-US", "es-MX", "es-CO", "es-AR", "es-CL", "es-ES")

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "nexomark/voz").setMethodCallHandler { call, result ->
            when (call.method) {
                "capacidades" -> capacidades(result)
                "descargarIdioma" -> descargarIdioma(call.argument<String>("etiqueta") ?: "es-PE", result)
                else -> result.notImplemented()
            }
        }
    }

    private fun intentDictado(idioma: String) = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma)
        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
    }

    private fun normalizar(etiqueta: String) = etiqueta.trim().replace('_', '-').lowercase()

    private fun espanol(disponibles: List<String>): String? {
        val porClave = disponibles.associateBy(::normalizar)
        espanolCercano.firstNotNullOfOrNull { porClave[normalizar(it)] }?.let { return it }
        return disponibles.firstOrNull { normalizar(it).startsWith("es") }
    }

    private fun capacidades(result: MethodChannel.Result) {
        val sistema = SpeechRecognizer.isRecognitionAvailable(this)
        val enDispositivo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        val base = mapOf(
            "plataforma" to "android",
            "sdk" to Build.VERSION.SDK_INT,
            "sistema" to sistema,
            "enDispositivo" to enDispositivo,
        )
        if (!enDispositivo || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Android 12: hay reconocedor en el dispositivo pero no se puede saber si tiene español.
            result.success(base + mapOf("idioma" to if (enDispositivo) "desconocido" else "no_soportado"))
            return
        }
        val reconocedor = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        var respondido = false
        reconocedor.checkRecognitionSupport(
            intentDictado("es-PE"),
            mainExecutor,
            object : RecognitionSupportCallback {
                override fun onSupportResult(soporte: RecognitionSupport) {
                    if (respondido) return
                    respondido = true
                    val listo = espanol(soporte.installedOnDeviceLanguages)
                    val pendiente = espanol(soporte.pendingOnDeviceLanguages)
                    val descargable = espanol(soporte.supportedOnDeviceLanguages)
                    val (estado, etiqueta) = when {
                        listo != null -> "listo" to listo
                        pendiente != null -> "descargando" to pendiente
                        descargable != null -> "descargable" to descargable
                        else -> "no_soportado" to null
                    }
                    reconocedor.destroy()
                    result.success(base + mapOf("idioma" to estado, "etiqueta" to etiqueta))
                }

                override fun onError(error: Int) {
                    if (respondido) return
                    respondido = true
                    reconocedor.destroy()
                    result.success(base + mapOf("idioma" to "desconocido"))
                }
            },
        )
    }

    private fun descargarIdioma(etiqueta: String, result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        ) {
            result.success("no_disponible")
            return
        }
        val reconocedor = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            var respondido = false
            fun responder(valor: String) {
                if (respondido) return
                respondido = true
                reconocedor.destroy()
                result.success(valor)
            }
            reconocedor.triggerModelDownload(
                intentDictado(etiqueta),
                mainExecutor,
                object : ModelDownloadListener {
                    override fun onProgress(completedPercent: Int) = Unit
                    override fun onSuccess() = responder("lista")
                    override fun onScheduled() = responder("programada")
                    override fun onError(error: Int) = responder("error")
                },
            )
        } else {
            reconocedor.triggerModelDownload(intentDictado(etiqueta))
            reconocedor.destroy()
            result.success("iniciada")
        }
    }
}
