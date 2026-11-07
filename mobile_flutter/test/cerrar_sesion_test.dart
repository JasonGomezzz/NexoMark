import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/providers.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/features/account/cerrar_sesion.dart';

/// Cuántas veces se cerró la sesión (el proveedor solo se crea si se llega a usar).
var _salidas = 0;

class _SesionFalsa extends SessionController {
  @override
  SessionState build() => const SignedOut();

  @override
  Future<void> logout([String? aviso]) async => _salidas++;
}

void main() {
  group('cerrar sesión', () {
    setUp(() => _salidas = 0);

    Widget app() => ProviderScope(
      overrides: [sessionProvider.overrideWith(_SesionFalsa.new)],
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Consumer(
          builder: (context, ref, _) => Scaffold(
            body: TextButton(onPressed: () => cerrarSesionConAviso(context, ref), child: const Text('Salir')),
          ),
        ),
      ),
    );

    testWidgets('pregunta antes y no sale si se cancela', (tester) async {
      await tester.pumpWidget(app());
      await tester.tap(find.text('Salir'));
      await tester.pumpAndSettle();
      expect(find.text('¿Cerrar sesión?'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(_salidas, 0);
    });

    testWidgets('sale solo al confirmar', (tester) async {
      await tester.pumpWidget(app());
      await tester.tap(find.text('Salir'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(_salidas, 1);
    });
  });
}
