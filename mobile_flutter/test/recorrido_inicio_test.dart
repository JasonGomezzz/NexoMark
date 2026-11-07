import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/features/auth/login_screen.dart';
import 'package:nexomark/widgets/conforme.dart';

void main() {
  group('recorrido del inicio', () {
    Widget demo({bool reducir = false}) => MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reducir),
          child: const Scaffold(body: FlowDemo()),
        ),
      ),
    );

    int paso(WidgetTester tester) => tester.widget<FlowStepper>(find.byType(FlowStepper)).current;

    testWidgets('llega a Medir, descansa y vuelve a Dictar', (tester) async {
      await tester.pumpWidget(demo());
      expect(paso(tester), 0);
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 1500));
      }
      expect(paso(tester), 4);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(paso(tester), 4, reason: 'se queda un momento en Medir');
      await tester.pump(const Duration(milliseconds: 1500));
      expect(paso(tester), 0);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(paso(tester), 1);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('con reducir movimiento queda quieto en Medir', (tester) async {
      await tester.pumpWidget(demo(reducir: true));
      expect(paso(tester), 4);
      await tester.pump(const Duration(seconds: 10));
      expect(paso(tester), 4);
    });
  });
}
