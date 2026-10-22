import 'package:flutter/widgets.dart';

/// Movimiento NexoMark. Mismas curvas que `index.css` (`--ease-out`,
/// `--ease-drawer`). Reglas: transform y opacidad; nada aparece desde escala
/// 0 (se parte de 0.95); la interfaz se queda bajo 300 ms; lo que se usa
/// decenas de veces al día casi no se mueve; con "reducir movimiento" del
/// sistema se cambia de estado sin desplazar nada.
abstract final class Motion {
  /// Entradas y salidas.
  static const easeOut = Cubic(0.23, 1, 0.32, 1);

  /// Algo que se mueve o cambia de forma en pantalla.
  static const easeInOut = Cubic(0.77, 0, 0.175, 1);

  /// Hojas inferiores y cajones (curva de iOS).
  static const drawer = Cubic(0.32, 0.72, 0, 1);

  static const press = Duration(milliseconds: 140);
  static const fast = Duration(milliseconds: 180);
  static const base = Duration(milliseconds: 240);
  static const sheet = Duration(milliseconds: 320);

  /// Separación entre elementos que entran juntos.
  static const stagger = Duration(milliseconds: 50);

  /// "Reducir movimiento" (iOS) o "Quitar animaciones" (Android). Flutter los
  /// expone por separado: `disableAnimations` solo trae el de Android y el de
  /// iOS llega como `reduceMotion`, así que hay que mirar los dos.
  static bool reduced(BuildContext context) =>
      (MediaQuery.maybeDisableAnimationsOf(context) ?? false) ||
      (View.maybeOf(context)?.platformDispatcher.accessibilityFeatures.reduceMotion ?? false);

  /// Duración efectiva: cero si el sistema pide no animar.
  static Duration of(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;
}
