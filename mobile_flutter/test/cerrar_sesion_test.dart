import 'dart:async';

import 'package:flutter/cupertino.dart' show CupertinoDialogAction;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/providers.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/features/account/cerrar_sesion.dart';

/// Cuántas veces se cerró la sesión (el proveedor solo se crea si se llega a usar).
var _salidas = 0;

/// Si hay uno, el cierre de sesión espera a que se complete (simula un servidor lento).
Completer<void>? _espera;

/// Si hay uno, el cierre de sesión falla con él.
Object? _error;

class _SesionFalsa extends SessionController {
  @override
  SessionState build() => const SignedOut();

  @override
  Future<void> logout([String? aviso]) async {
    if (_espera != null) await _espera!.future;
    if (_error != null) throw _error!;
    _salidas++;
  }
}

void main() {
  group('cerrar sesión', () {
    setUp(() {
      _salidas = 0;
      _espera = null;
      _error = null;
    });

    Widget app({TargetPlatform? plataforma}) => ProviderScope(
      overrides: [sessionProvider.overrideWith(_SesionFalsa.new)],
      child: MaterialApp(
        theme: buildTheme(Brightness.light, platform: plataforma),
        home: Consumer(
          builder: (context, ref, _) => Scaffold(
            body: TextButton(onPressed: () => cerrarSesionConAviso(context, ref), child: const Text('Salir')),
          ),
        ),
      ),
    );

    Future<void> abrir(WidgetTester tester, {TargetPlatform? plataforma}) async {
      await tester.pumpWidget(app(plataforma: plataforma));
      await tester.tap(find.text('Salir'));
      await tester.pumpAndSettle();
    }

    /// Si el botón acepta toques.
    bool activo(WidgetTester tester, Finder boton) => (tester.widget(boton) as dynamic).onPressed != null;

    /// El gesto o botón de atrás del sistema, con tiempo de sobra para que un diálogo se fuera si lo dejara.
    Future<void> atras(WidgetTester tester) async {
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('pregunta antes y no sale si se cancela', (tester) async {
      await abrir(tester);
      expect(find.text('¿Cerrar sesión?'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(find.text('¿Cerrar sesión?'), findsNothing);
      expect(_salidas, 0);
    });

    testWidgets('sale solo al confirmar', (tester) async {
      await abrir(tester);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(_salidas, 1);
      expect(find.text('¿Cerrar sesión?'), findsNothing);
    });

    testWidgets('dice qué pasa al salir, con el mismo texto que la web', (tester) async {
      await abrir(tester);
      expect(
        find.text('Saldrás de NexoMark en este dispositivo. Para volver a entrar tendrás que iniciar sesión otra vez.'),
        findsOneWidget,
      );
    });

    testWidgets('el foco empieza en «Cancelar», no en la acción', (tester) async {
      await abrir(tester);
      final cancelar = tester.widget<TextButton>(find.widgetWithText(TextButton, 'Cancelar'));
      expect(cancelar.autofocus, isTrue);
      final foco = FocusManager.instance.primaryFocus!;
      expect(foco.context!.findAncestorWidgetOfExactType<TextButton>(), same(cancelar));
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Cerrar sesión')).autofocus, isFalse);
    });

    testWidgets('mientras cierra dice «Cerrando sesión…», bloquea los botones y no se puede descartar', (tester) async {
      _espera = Completer<void>();
      await abrir(tester);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pump();

      expect(find.text('Cerrando sesión…'), findsOneWidget);
      expect(find.text('Cerrar sesión'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(activo(tester, find.widgetWithText(TextButton, 'Cancelar')), isFalse);
      expect(activo(tester, find.widgetWithText(FilledButton, 'Cerrando sesión…')), isFalse);

      // Ni tocando fuera ni con el gesto de atrás.
      await tester.tapAt(const Offset(4, 4));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Cerrando sesión…'), findsOneWidget);
      await atras(tester);
      expect(find.text('Cerrando sesión…'), findsOneWidget);
      expect(_salidas, 0);

      _espera!.complete();
      await tester.pumpAndSettle();
      expect(_salidas, 1);
      expect(find.text('¿Cerrar sesión?'), findsNothing);
    });

    testWidgets('un segundo toque mientras cierra no vuelve a cerrar', (tester) async {
      _espera = Completer<void>();
      await abrir(tester);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pump();
      await tester.tap(find.text('Cerrando sesión…'), warnIfMissed: false);
      _espera!.complete();
      await tester.pumpAndSettle();
      expect(_salidas, 1);
    });

    testWidgets('si falla, avisa, deja reintentar y se puede cancelar', (tester) async {
      _error = Exception('sin red');
      await abrir(tester);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo completar. Inténtalo otra vez.'), findsOneWidget);
      expect(find.text('Cerrar sesión'), findsOneWidget);
      expect(activo(tester, find.widgetWithText(FilledButton, 'Cerrar sesión')), isTrue);

      _error = null;
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(_salidas, 1);
      expect(find.text('¿Cerrar sesión?'), findsNothing);
    });

    testWidgets('con «reducir movimiento» no dibuja el indicador que gira, pero sí el texto', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(reduceMotion: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      _espera = Completer<void>();
      await abrir(tester);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pump();

      expect(find.text('Cerrando sesión…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      _espera!.complete();
      await tester.pumpAndSettle();
    });

    group('en iOS', () {
      testWidgets('es la alerta nativa: cancelar no sale, confirmar sí', (tester) async {
        await abrir(tester, plataforma: TargetPlatform.iOS);
        expect(find.byType(CupertinoDialogAction), findsNWidgets(2));
        await tester.tap(find.text('Cancelar'));
        await tester.pumpAndSettle();
        expect(_salidas, 0);

        await tester.tap(find.text('Salir'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Cerrar sesión'));
        await tester.pumpAndSettle();
        expect(_salidas, 1);
      });

      testWidgets('mientras cierra bloquea ambas acciones y muestra «Cerrando sesión…»', (tester) async {
        _espera = Completer<void>();
        await abrir(tester, plataforma: TargetPlatform.iOS);
        await tester.tap(find.text('Cerrar sesión'));
        await tester.pump();

        expect(find.text('Cerrando sesión…'), findsOneWidget);
        expect(
          tester.widgetList<CupertinoDialogAction>(find.byType(CupertinoDialogAction)).map((a) => a.onPressed != null),
          [false, false],
        );
        await atras(tester);
        expect(find.text('Cerrando sesión…'), findsOneWidget);

        _espera!.complete();
        await tester.pumpAndSettle();
        expect(_salidas, 1);
        expect(find.text('¿Cerrar sesión?'), findsNothing);
      });

      testWidgets('la alerta entra escalando, salvo con «reducir movimiento»: ahí solo se funde', (tester) async {
        Finder escala() => find.ancestor(of: find.text('¿Cerrar sesión?'), matching: find.byType(ScaleTransition));

        await abrir(tester, plataforma: TargetPlatform.iOS);
        expect(escala(), findsWidgets);
        await tester.tap(find.text('Cancelar'));
        await tester.pumpAndSettle();

        tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(reduceMotion: true);
        addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
        await tester.tap(find.text('Salir'));
        await tester.pumpAndSettle();
        expect(find.text('¿Cerrar sesión?'), findsOneWidget);
        expect(escala(), findsNothing);
        await tester.tap(find.text('Cancelar'));
        await tester.pumpAndSettle();
        expect(_salidas, 0);
      });
    });
  });
}
