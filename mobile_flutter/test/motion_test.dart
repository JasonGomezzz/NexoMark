import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/theme/motion.dart';
import 'package:nexomark/widgets/motion_widgets.dart';

void main() {
  group('reducir movimiento', () {
    Future<bool> leer(WidgetTester tester) async {
      late bool resultado;
      await tester.pumpWidget(
        Builder(
          builder: (context) {
            resultado = Motion.reduced(context);
            return const SizedBox();
          },
        ),
      );
      return resultado;
    }

    testWidgets('sin ajustes de accesibilidad no se reduce nada', (tester) async {
      expect(await leer(tester), isFalse);
    });

    testWidgets('lo pide iOS (reduceMotion, que Flutter no refleja en disableAnimations)', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(reduceMotion: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      expect(await leer(tester), isTrue);
    });

    testWidgets('lo pide Android (disableAnimations)', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
        disableAnimations: true,
      );
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      expect(await leer(tester), isTrue);
    });
  });

  group('entrada', () {
    double opacidad(WidgetTester tester) =>
        tester.widget<Opacity>(find.descendant(of: find.byType(Entrance), matching: find.byType(Opacity))).opacity;
    double desplazamiento(WidgetTester tester) => tester
        .widget<Transform>(find.descendant(of: find.byType(Entrance), matching: find.byType(Transform)))
        .transform
        .getTranslation()
        .y;

    testWidgets('sube 12 px mientras aparece', (tester) async {
      await tester.pumpWidget(const Directionality(textDirection: TextDirection.ltr, child: Entrance(child: SizedBox())));
      await tester.pump(const Duration(milliseconds: 40)); // vence el temporizador y arranca
      await tester.pump(const Duration(milliseconds: 40));
      expect(opacidad(tester), inExclusiveRange(0, 1));
      expect(desplazamiento(tester), greaterThan(0));
      await tester.pumpAndSettle();
    });

    testWidgets('con reducir movimiento se funde sin subir', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(reduceMotion: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      await tester.pumpWidget(const Directionality(textDirection: TextDirection.ltr, child: Entrance(child: SizedBox())));
      await tester.pump(const Duration(milliseconds: 40)); // vence el temporizador y arranca
      await tester.pump(const Duration(milliseconds: 40));
      expect(opacidad(tester), inExclusiveRange(0, 1));
      expect(desplazamiento(tester), 0);
      await tester.pumpAndSettle();
      expect(opacidad(tester), 1);
    });
  });
}
