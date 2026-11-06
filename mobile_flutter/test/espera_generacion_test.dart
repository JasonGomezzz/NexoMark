import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/widgets/campaign_widgets.dart';

Widget _app(Widget child) => MaterialApp(theme: buildTheme(Brightness.light), home: Scaffold(body: Center(child: child)));

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('cuenta el tiempo desde que se pidió y dice cuánto suele tardar', (tester) async {
    await tester.pumpWidget(_app(EsperaGeneracion(desde: DateTime.now().subtract(const Duration(seconds: 12)))));
    expect(find.textContaining('Generando · 0:1'), findsOneWidget);
    expect(find.text('suele tardar entre 8 y 30 s'), findsOneWidget);
  });

  testWidgets('pasados 30 s lo reconoce, sin inventar etapas', (tester) async {
    await tester.pumpWidget(_app(EsperaGeneracion(desde: DateTime.now().subtract(const Duration(seconds: 45)))));
    expect(find.text('tarda más de lo habitual (8 a 30 s)'), findsOneWidget);
  });

  testWidgets('sin hora de inicio no muestra un reloj que mentiría', (tester) async {
    await tester.pumpWidget(_app(const EsperaGeneracion()));
    expect(find.text('Generando'), findsOneWidget);
  });

  testWidgets('con letra 1.3× en 320 px baja de línea en vez de desbordar', (tester) async {
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
      child: _app(SizedBox(width: 320, child: EsperaGeneracion(desde: DateTime.now().subtract(const Duration(minutes: 12))))),
    ));
    expect(tester.takeException(), isNull);
  });
}
