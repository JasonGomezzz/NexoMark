import 'package:flutter/widgets.dart';

/// Movimiento NexoMark (direcciones.md → «Dirección elegida: C · Conforme»).
/// Reglas: transform y opacidad; nada aparece desde escala 0 (se parte de
/// 0.95, siempre con opacidad); la interfaz se queda entre 150 y 300 ms; lo
/// que se usa decenas de veces al día (pestañas, filtros, filas) no se anima;
/// con "reducir movimiento" todo queda en su estado final.
abstract final class Motion {
  /// Entrar o aparecer.
  static const easeOut = Cubic(0.23, 1, 0.32, 1);

  /// Algo que se mueve o cambia de forma en pantalla.
  static const easeInOut = Cubic(0.77, 0, 0.175, 1);

  /// Hojas inferiores y cajones (curva de iOS).
  static const drawer = Cubic(0.32, 0.72, 0, 1);

  /// Presionar: escala 0.97.
  static const press = Duration(milliseconds: 140);

  /// La casilla se sella (y cambios de color pequeños).
  static const fast = Duration(milliseconds: 160);

  /// Párrafo o parada nueva.
  static const stop = Duration(milliseconds: 180);

  /// Entradas de contenido.
  static const base = Duration(milliseconds: 220);

  /// Hojas inferiores.
  static const sheet = Duration(milliseconds: 220);

  /// Algo que se mueve de lugar.
  static const move = Duration(milliseconds: 240);

  /// Momentos firma: el encaje de la N y el sello del cliente (una vez).
  static const signature = Duration(milliseconds: 420);

  /// Vuelta del aro «escuchando · mm:ss» del micrófono (lineal, solo mientras escucha).
  static const aroMicrofono = Duration(seconds: 24);

  /// Una carga más corta que esto no muestra esqueleto: evita el parpadeo.
  static const esperaEsqueleto = Duration(milliseconds: 300);

  /// Fundido con el que llega el contenido real (o aparece el esqueleto).
  static const llegada = Duration(milliseconds: 150);

  /// Pulso del esqueleto (ida y vuelta), suave y sin brillo que corre.
  static const pulso = Duration(milliseconds: 1800);

  /// Volver al inicio de sesión al cerrar sesión: fundido, sin deslizar.
  static const salida = Duration(milliseconds: 300);

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
