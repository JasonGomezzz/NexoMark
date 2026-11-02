import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/theme/tokens.dart';

/// Contraste WCAG 2.1 entre dos colores opacos.
double contraste(Color a, Color b) {
  double canal(double c) => c <= 0.03928 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
  double luminancia(Color c) => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  final la = luminancia(a), lb = luminancia(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  // Mismos pares que la web (tests/brandPalette.test.js) más los de la mesa y los gráficos.
  for (final (nombre, s, n) in [
    ('claro', nexoLightScheme, NexoColors.light),
    ('oscuro', nexoDarkScheme, NexoColors.dark),
  ]) {
    group('tema $nombre: texto AA (4.5:1)', () {
      final pares = <String, (Color, Color)>{
        'texto sobre fondo': (s.onSurface, s.surface),
        'texto sobre tarjeta': (s.onSurface, s.surfaceContainerLowest),
        'secundario sobre fondo': (s.onSurfaceVariant, s.surface),
        'secundario sobre tarjeta': (s.onSurfaceVariant, s.surfaceContainerLowest),
        'botón primario': (s.onPrimary, s.primary),
        'enlace sobre fondo': (s.primary, s.surface),
        'píldora pendiente IA': (s.onPrimaryFixed, s.primaryFixed),
        'píldora generada': (s.onSecondaryContainer, s.secondaryContainer),
        'píldora pendiente de aprobación': (n.warning, n.warningContainer),
        'píldora aprobada': (n.success, n.successContainer),
        'píldora rechazada': (s.onErrorContainer, s.errorContainer),
        'error sobre fondo': (s.error, s.surface),
        'aviso snackbar': (s.onInverseSurface, s.inverseSurface),
      };
      pares.forEach((par, colores) {
        test(par, () => expect(contraste(colores.$1, colores.$2), greaterThanOrEqualTo(4.5)));
      });
      test('borde de campo 3:1', () => expect(contraste(s.outline, s.surfaceContainerLowest), greaterThanOrEqualTo(3)));
      test('texto terciario sobre fondo', () => expect(contraste(s.outline, s.surface), greaterThanOrEqualTo(4.5)));

      // Series de los gráficos: objetos gráficos, 3:1 sobre el fondo y sobre las superficies.
      for (final red in ['instagram', 'x', 'facebook', 'tiktok']) {
        test('serie $red 3:1 sobre fondo y superficie', () {
          expect(contraste(n.chart(red), s.surface), greaterThanOrEqualTo(3));
          expect(contraste(n.chart(red), s.surfaceContainerLowest), greaterThanOrEqualTo(3));
        });
      }
    });
  }

  for (final (nombre, n) in [('claro', NexoColors.light), ('oscuro', NexoColors.dark)]) {
    group('mesa en tema $nombre', () {
      test('texto sobre la mesa', () => expect(contraste(Nexo.onNavy, n.cama), greaterThanOrEqualTo(9)));
      test('paso inactivo sobre la mesa', () => expect(contraste(Nexo.onNavyMuted, n.cama), greaterThanOrEqualTo(4.5)));
      test('conteo sobre cama-2', () => expect(contraste(Nexo.onNavy, n.cama2), greaterThanOrEqualTo(4.5)));
      test('casilla actual sobre la mesa (3:1, objeto)', () => expect(contraste(Nexo.turquoise, n.cama), greaterThanOrEqualTo(3)));
      test('marcas de corte sobre la mesa (3:1, objeto)', () => expect(contraste(n.registro, n.cama), greaterThanOrEqualTo(3)));
    });
  }
  test('ícono de la casilla actual', () => expect(contraste(Nexo.navyDeep, Nexo.turquoise), greaterThanOrEqualTo(4.5)));

  group('marino', () {
    test('texto sobre marino', () => expect(contraste(Nexo.onNavy, Nexo.navy), greaterThanOrEqualTo(9)));
    test('secundario sobre marino', () => expect(contraste(Nexo.onNavyMuted, Nexo.navy), greaterThanOrEqualTo(4.5)));
    test('turquesa suave sobre marino', () => expect(contraste(Nexo.turquoiseSoft, Nexo.navy), greaterThanOrEqualTo(4.5)));
    test('error sobre marino', () => expect(contraste(Nexo.onNavyError, Nexo.navy), greaterThanOrEqualTo(4.5)));
  });

  test('los tokens coinciden con direcciones.md (C · Conforme)', () {
    expect(nexoLightScheme.primary, const Color(0xFF087B75));
    expect(nexoDarkScheme.primary, const Color(0xFF17B8AD));
    expect(Nexo.navy, const Color(0xFF14283F));
    expect(nexoLightScheme.surface, const Color(0xFFF7FBFB));
    expect(nexoDarkScheme.surface, const Color(0xFF0F2236));
    expect(NexoColors.dark.cama, const Color(0xFF07111D));
    expect(NexoColors.light.registro, const Color(0xFF79DDD3));
    expect(NexoColors.light.chartInstagram, const Color(0xFFB4307E));
    expect(NexoColors.dark.chartFacebook, const Color(0xFF5B8FE0));
  });
}
