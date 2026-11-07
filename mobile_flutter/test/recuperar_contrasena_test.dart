import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/providers.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/features/auth/forgot_password_screen.dart';

Widget _pantalla({String? email}) => ProviderScope(
  overrides: [currentUserProvider.overrideWithValue(null)],
  child: MaterialApp(theme: buildTheme(Brightness.light), home: ForgotPasswordScreen(email: email)),
);

void main() {
  testWidgets('llega con el correo de Google ya escrito al vincular', (tester) async {
    await tester.pumpWidget(_pantalla(email: 'persona@gmail.com'));
    expect(find.widgetWithText(TextField, 'persona@gmail.com'), findsOneWidget);
  });

  testWidgets('sin sesión ni correo conocido, el campo queda vacío', (tester) async {
    await tester.pumpWidget(_pantalla());
    final campo = tester.widget<TextField>(find.byType(TextField));
    expect(campo.controller!.text, isEmpty);
  });
}
