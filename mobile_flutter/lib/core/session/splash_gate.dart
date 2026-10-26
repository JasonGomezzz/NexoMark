import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Retiene la pantalla de carga hasta que termina su animación de arranque.
/// Sin esto, una sesión que se resuelve en milisegundos (sin sesión guardada,
/// o con red rápida) cambiaría de pantalla a mitad de la animación y la N
/// nunca llegaría a encajar. Se libera una sola vez por arranque: la espera
/// máxima es lo que dura la animación, y si la sesión tarda más no añade nada.
class SplashGate extends ChangeNotifier {
  SplashGate({Future<void>? firstFrame}) : _frame = firstFrame;

  final Future<void>? _frame;

  /// Se completa cuando el primer cuadro de Flutter ya se dibujó. Hasta
  /// entonces sigue a la vista el arranque nativo, y una animación que corra
  /// por detrás se gastaría sin que nadie la vea (en depuración el primer
  /// cuadro llega a tardar segundos).
  Future<void> get firstFrame =>
      _frame ?? WidgetsBinding.instance.waitUntilFirstFrameRasterized;

  bool _released = false;
  bool get released => _released;

  void release() {
    if (_released) return;
    _released = true;
    notifyListeners();
  }
}

final splashGateProvider = Provider<SplashGate>((ref) {
  final gate = SplashGate();
  ref.onDispose(gate.dispose);
  return gate;
});
