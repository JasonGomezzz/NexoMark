import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/session/splash_gate.dart';
import 'package:nexomark/features/auth/splash_screen.dart';
import 'package:nexomark/widgets/nexo_mark_logo.dart';

/// [primerCuadro] pendiente deja la pantalla en el arranque nativo; ya
/// dibujado, la animación corre. En las pruebas el motor nunca lo avisa solo.
Widget _splash({bool reducirMovimiento = false, Future<void>? primerCuadro}) => ProviderScope(
  overrides: [splashGateProvider.overrideWith((ref) => SplashGate(firstFrame: primerCuadro ?? Future.value()))],
  child: MaterialApp(
    home: Builder(
      builder: (context) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reducirMovimiento),
        child: const SplashScreen(),
      ),
    ),
  ),
);

NexoMarkLogo _logo(WidgetTester tester) => tester.widget<NexoMarkLogo>(find.byType(NexoMarkLogo));

SplashGate _gate(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(SplashScreen))).read(splashGateProvider);

double _nombre(WidgetTester tester) =>
    tester.widget<Opacity>(find.descendant(of: find.byType(SplashScreen), matching: find.byType(Opacity))).opacity;

void main() {
  group('compuerta de la pantalla de carga', () {
    test('se libera una sola vez y avisa al enrutador', () {
      final gate = SplashGate();
      var avisos = 0;
      gate.addListener(() => avisos++);
      expect(gate.released, isFalse);
      gate.release();
      gate.release();
      expect(gate.released, isTrue);
      expect(avisos, 1);
    });
  });

  group('pantalla de carga', () {
    testWidgets('las piezas parten separadas, encajan y recién entonces libera la compuerta', (tester) async {
      await tester.pumpWidget(_splash());
      await tester.pump(); // primer cuadro a la vista: arranca el reloj
      expect(_logo(tester).white.value, 1);
      expect(_logo(tester).teal.value, 1);
      expect(_nombre(tester), 0);
      expect(_gate(tester).released, isFalse);

      await tester.pump(const Duration(milliseconds: 260));
      expect(_logo(tester).white.value, inExclusiveRange(0.2, 0.8));
      expect(_logo(tester).teal.value, inExclusiveRange(0.2, 0.8));

      await tester.pump(const Duration(milliseconds: 440));
      expect(_logo(tester).white.value, 0);
      expect(_logo(tester).teal.value, 0);
      expect(_gate(tester).released, isFalse, reason: 'el nombre todavía está entrando');

      await tester.pump(const Duration(milliseconds: 120));
      expect(_nombre(tester), 1);
      expect(_logo(tester).scale.value, 1);
      expect(_gate(tester).released, isTrue);
    });

    testWidgets('la N ocupa el cuadro de 120 pt y queda en el centro, como el arranque nativo', (tester) async {
      await tester.pumpWidget(_splash());
      expect(tester.getSize(find.byType(NexoMarkLogo)), const Size(120, 120));
      expect(tester.getCenter(find.byType(NexoMarkLogo)), tester.getCenter(find.byType(Scaffold)));
    });

    testWidgets('el reloj no corre mientras se ve el arranque nativo', (tester) async {
      final primerCuadro = Completer<void>();
      await tester.pumpWidget(_splash(primerCuadro: primerCuadro.future));
      await tester.pump(const Duration(seconds: 3));
      expect(_logo(tester).white.value, 1, reason: 'la animación no puede gastarse detrás del arranque nativo');
      expect(_gate(tester).released, isFalse);

      primerCuadro.complete();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_logo(tester).white.value, 0);
      expect(_gate(tester).released, isTrue);
    });

    testWidgets('si el motor nunca avisa del primer cuadro, arranca igual y no deja la app detenida', (tester) async {
      await tester.pumpWidget(_splash(primerCuadro: Completer<void>().future));
      await tester.pump(const Duration(seconds: 8));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_gate(tester).released, isTrue);
    });

    testWidgets('con reducir movimiento la N ya está encajada y solo se funde el nombre', (tester) async {
      await tester.pumpWidget(_splash(reducirMovimiento: true));
      await tester.pump();
      expect(_logo(tester).white.value, 0);
      expect(_logo(tester).teal.value, 0);
      expect(_logo(tester).scale.value, 1);
      expect(_nombre(tester), 0);
      expect(_gate(tester).released, isTrue, reason: 'sin animación no hay nada que esperar');

      await tester.pump(const Duration(milliseconds: 120));
      expect(_nombre(tester), inExclusiveRange(0, 1));
      await tester.pump(const Duration(milliseconds: 200));
      expect(_nombre(tester), 1);
      expect(_logo(tester).white.value, 0);
    });
  });
}
