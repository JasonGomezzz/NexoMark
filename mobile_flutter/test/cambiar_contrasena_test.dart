import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/api/api_client.dart';
import 'package:nexomark/core/providers.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/data/auth_repository.dart';
import 'package:nexomark/features/account/change_password_screen.dart';

/// Lo que respondió el servidor al cambio de contraseña (o el error que lanzó).
Object _respuesta = 'Contraseña actualizada. Cerramos todas tus sesiones: inicia sesión con tu nueva contraseña.';

/// Avisos con los que se cerró la sesión.
final _salidas = <String?>[];

class _SesionFalsa extends SessionController {
  @override
  SessionState build() => const SignedOut();

  @override
  Future<void> logout([String? aviso]) async => _salidas.add(aviso);
}

class _RepoFalso implements AuthRepository {
  @override
  Future<String> changePassword(String actual, String nueva) async {
    final r = _respuesta;
    if (r is Exception) throw r;
    return r as String;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUp(() {
    _salidas.clear();
    _respuesta = 'Contraseña actualizada. Cerramos todas tus sesiones: inicia sesión con tu nueva contraseña.';
  });

  Widget app() => ProviderScope(
    overrides: [
      sessionProvider.overrideWith(_SesionFalsa.new),
      authRepositoryProvider.overrideWithValue(_RepoFalso()),
      currentUserProvider.overrideWithValue(null),
    ],
    child: MaterialApp(theme: buildTheme(Brightness.light), home: const ChangePasswordScreen()),
  );

  Future<void> escribirYGuardar(WidgetTester tester) async {
    await tester.pumpWidget(app());
    final campos = find.byType(TextField);
    await tester.enterText(campos.at(0), 'Test1234!');
    await tester.enterText(campos.at(1), 'NuevaClave2026!');
    await tester.enterText(campos.at(2), 'NuevaClave2026!');
    await tester.tap(find.widgetWithText(FilledButton, 'Guardar contraseña'));
    await tester.pumpAndSettle();
  }

  testWidgets('al cambiar la contraseña cierra la sesión con el aviso del servidor', (tester) async {
    await escribirYGuardar(tester);
    expect(_salidas, ['Contraseña actualizada. Cerramos todas tus sesiones: inicia sesión con tu nueva contraseña.']);
  });

  testWidgets('si el servidor rechaza el cambio, no cierra la sesión y muestra el motivo', (tester) async {
    _respuesta = ApiException('Demasiados intentos. Intenta nuevamente en 12 minutos.', status: 429);
    await escribirYGuardar(tester);
    expect(_salidas, isEmpty);
    expect(find.text('Demasiados intentos. Intenta nuevamente en 12 minutos.'), findsOneWidget);
  });
}
