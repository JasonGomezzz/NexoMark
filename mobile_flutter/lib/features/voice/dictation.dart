import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Dónde se transcribe la voz. Se muestra al usuario, así que describe lo
/// que de verdad hace el reconocedor elegido (misma regla que la app Kotlin).
enum ModoDictado {
  /// El reconocedor del propio teléfono tiene el español: el audio no sale del equipo.
  enDispositivo,

  /// Reconocedor del sistema: puede enviar el audio a Google (Android) o Apple (iOS).
  sistema,

  /// No hay reconocedor: solo se puede escribir el brief.
  noDisponible,
}

/// Estado del español para dictar sin conexión.
enum IdiomaOffline { listo, descargando, descargable, noSoportado, desconocido }

IdiomaOffline _idioma(String? v) => switch (v) {
  'listo' => IdiomaOffline.listo,
  'descargando' => IdiomaOffline.descargando,
  'descargable' => IdiomaOffline.descargable,
  'desconocido' => IdiomaOffline.desconocido,
  _ => IdiomaOffline.noSoportado,
};

/// Errores con los que el reconocedor en el dispositivo dice "no tengo este idioma".
const _sinModeloEnDispositivo = {
  'error_language_not_supported',
  'error_language_unavailable',
  'error_server_disconnected',
  'onDeviceError',
};

/// Dictado del brief con `speech_to_text`. A Django solo llega el texto que
/// la persona confirma; el audio nunca se sube a NexoMark ni a Gemini.
class DictationController extends ChangeNotifier {
  DictationController({required this.onText});

  /// Se llama con el texto acumulado mientras se habla (parciales incluidos).
  final void Function(String texto) onText;

  static const _canal = MethodChannel('nexomark/voz');
  final _stt = SpeechToText();

  ModoDictado modo = ModoDictado.noDisponible;
  IdiomaOffline idioma = IdiomaOffline.desconocido;
  String _etiqueta = 'es-PE';
  bool preparado = false;
  bool escuchando = false;
  bool descargando = false;
  bool _inicializado = false;
  String? aviso;

  /// Volumen de la voz entre 0 y 1, para animar el micrófono con el habla real.
  double nivel = 0;
  double _minNivel = double.infinity;
  double _maxNivel = -double.infinity;
  String _base = '';

  bool get esIos => Platform.isIOS;
  String get proveedorAudio => esIos ? 'Apple' : 'Google';

  /// Texto breve y verificable de dónde se transcribe; null si no hay dictado.
  String? get avisoPrivacidad => switch (modo) {
    ModoDictado.enDispositivo => 'El audio no sale del teléfono. NexoMark solo recibe el texto que confirmes.',
    ModoDictado.sistema =>
      'El sistema puede enviar el audio a los servidores de $proveedorAudio para transcribirlo. NexoMark solo recibe el texto.',
    ModoDictado.noDisponible => null,
  };

  bool get puedeDescargarIdioma =>
      !esIos &&
      modo == ModoDictado.sistema &&
      idioma == IdiomaOffline.descargable &&
      !descargando;

  /// Lee qué ofrece el teléfono, sin pedir permisos todavía.
  Future<void> preparar() async {
    try {
      final caps = Map<String, dynamic>.from(
        await _canal.invokeMethod<Map<dynamic, dynamic>>('capacidades') ?? {},
      );
      idioma = _idioma(caps['idioma'] as String?);
      _etiqueta = (caps['etiqueta'] as String?) ?? 'es-PE';
      final enDispositivo = caps['enDispositivo'] == true;
      final sistema = caps['sistema'] == true;
      if (enDispositivo &&
          (idioma == IdiomaOffline.listo ||
              idioma == IdiomaOffline.desconocido)) {
        modo = ModoDictado.enDispositivo;
      } else if (sistema || enDispositivo) {
        modo = ModoDictado.sistema;
        descargando = idioma == IdiomaOffline.descargando;
      } else {
        modo = ModoDictado.noDisponible;
      }
    } on PlatformException {
      modo = ModoDictado.sistema;
    } on MissingPluginException {
      modo = ModoDictado.noDisponible;
    }
    preparado = true;
    notifyListeners();
  }

  Future<void> descargarIdioma() async {
    descargando = true;
    notifyListeners();
    try {
      final r = await _canal.invokeMethod<String>('descargarIdioma', {
        'etiqueta': _etiqueta,
      });
      if (r == 'lista') {
        await preparar();
        aviso = 'Listo: el español quedó instalado. Ahora el audio no sale del teléfono.';
      } else if (r == 'error' || r == 'no_disponible') {
        descargando = false;
        aviso = 'No se pudo descargar el español. Puedes dictar igual o escribir el brief.';
      } else {
        aviso = 'Descargando el español en segundo plano. Mientras tanto puedes dictar igual.';
      }
    } on PlatformException {
      descargando = false;
      aviso = 'No se pudo descargar el español. Puedes dictar igual o escribir el brief.';
    }
    notifyListeners();
  }

  Future<void> alternar(String textoActual) =>
      escuchando ? detener() : escuchar(textoActual);

  Future<void> escuchar(String textoActual) async {
    if (modo == ModoDictado.noDisponible) return;
    aviso = null;
    if (!_inicializado) {
      _inicializado = await _stt.initialize(
        onError: _alError,
        onStatus: _alEstado,
      );
      if (!_inicializado) {
        aviso = 'Sin permiso del micrófono o del reconocimiento de voz. Actívalo en Ajustes, o escribe el brief.';
        notifyListeners();
        return;
      }
    }
    _base = textoActual.trim().isEmpty ? '' : '${textoActual.trim()} ';
    _minNivel = double.infinity;
    _maxNivel = -double.infinity;
    try {
      await _stt.listen(
        onResult: _alResultado,
        onSoundLevelChange: _alNivel,
        listenOptions: SpeechListenOptions(
          localeId: _etiqueta,
          listenFor: const Duration(seconds: 90),
          pauseFor: const Duration(seconds: 5),
          onDevice: modo == ModoDictado.enDispositivo,
          partialResults: true,
          listenMode: ListenMode.dictation,
          cancelOnError: true,
          autoPunctuation: true,
        ),
      );
      escuchando = true;
      HapticFeedback.lightImpact();
    } on PlatformException catch (e) {
      if (modo == ModoDictado.enDispositivo &&
          _sinModeloEnDispositivo.contains(e.code)) {
        _pasarASistema();
        return escuchar(textoActual);
      }
      aviso = 'No se pudo iniciar el dictado. Escribe el brief o vuelve a intentarlo.';
    }
    notifyListeners();
  }

  Future<void> detener() async {
    await _stt.stop();
    escuchando = false;
    nivel = 0;
    notifyListeners();
  }

  void _pasarASistema() {
    modo = ModoDictado.sistema;
    idioma = esIos ? IdiomaOffline.noSoportado : IdiomaOffline.descargable;
    aviso =
        'Este teléfono no tiene el español para dictar sin conexión. '
        'Ahora el sistema puede enviar el audio a $proveedorAudio.';
  }

  void _alResultado(SpeechRecognitionResult r) {
    final texto = '$_base${r.recognizedWords}';
    onText(texto);
    if (r.finalResult) {
      _base = '${texto.trim()} ';
    }
  }

  /// Normaliza el nivel con el mínimo y el máximo vistos en esta escucha:
  /// Android e iOS informan escalas distintas (dB).
  void _alNivel(double valor) {
    _minNivel = math.min(_minNivel, valor);
    _maxNivel = math.max(_maxNivel, valor);
    final rango = _maxNivel - _minNivel;
    nivel = rango < 1 ? 0 : ((valor - _minNivel) / rango).clamp(0.0, 1.0);
    notifyListeners();
  }

  void _alEstado(String status) {
    final activo = status == SpeechToText.listeningStatus;
    if (escuchando != activo) {
      escuchando = activo;
      if (!activo) nivel = 0;
      notifyListeners();
    }
  }

  void _alError(SpeechRecognitionError e) {
    escuchando = false;
    nivel = 0;
    if (modo == ModoDictado.enDispositivo &&
        _sinModeloEnDispositivo.contains(e.errorMsg)) {
      _pasarASistema();
    } else {
      aviso = switch (e.errorMsg) {
        'error_no_match' || 'error_speech_timeout' =>
          'No te escuché. Toca el micrófono y vuelve a intentarlo.',
        'error_permission' || 'error_insufficient_permissions' =>
          'Sin permiso del micrófono. Actívalo en Ajustes o escribe el brief.',
        'error_network' || 'error_network_timeout' || 'error_server' => 'Sin conexión para transcribir. Escribe el brief o vuelve a intentarlo con internet.',
        'error_busy' => 'El reconocedor está ocupado. Espera un momento.',
        _ => 'El dictado se detuvo. Puedes continuar escribiendo.',
      };
      // En depuración se ve el código del reconocedor para diagnosticar en el teléfono.
      if (kDebugMode) aviso = '$aviso (${e.errorMsg})';
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _stt.cancel();
    super.dispose();
  }
}
