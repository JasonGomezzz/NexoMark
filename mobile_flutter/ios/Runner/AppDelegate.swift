import Flutter
import Speech
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "NexoMarkVoz") {
      let canal = FlutterMethodChannel(name: "nexomark/voz", binaryMessenger: registrar.messenger())
      canal.setMethodCallHandler { llamada, resultado in
        switch llamada.method {
        case "capacidades":
          resultado(Self.capacidades())
        case "descargarIdioma":
          // iOS no permite pedir la descarga desde una app: se explica en pantalla cómo hacerlo.
          resultado("no_disponible")
        default:
          resultado(FlutterMethodNotImplemented)
        }
      }
    }
  }

  /// Dónde transcribiría iOS el español: en el iPhone (supportsOnDeviceRecognition)
  /// o en los servidores de Apple. Referencia: developer.apple.com/documentation/speech/sfspeechrecognizer
  static func capacidades() -> [String: Any] {
    let variantes = ["es-PE", "es-419", "es-US", "es-MX", "es-CO", "es-CL", "es-ES"]
    for etiqueta in variantes {
      guard let reconocedor = SFSpeechRecognizer(locale: Locale(identifier: etiqueta)) else { continue }
      return [
        "plataforma": "ios",
        "sistema": reconocedor.isAvailable,
        "enDispositivo": reconocedor.supportsOnDeviceRecognition,
        "idioma": reconocedor.supportsOnDeviceRecognition ? "listo" : "no_soportado",
        "etiqueta": etiqueta,
      ]
    }
    return ["plataforma": "ios", "sistema": false, "enDispositivo": false, "idioma": "no_soportado"]
  }
}
