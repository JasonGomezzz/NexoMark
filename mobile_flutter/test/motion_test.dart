import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/theme/motion.dart';

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

    testWidgets('sin ajustes de accesibilidad no se reduce nada', (
      tester,
    ) async {
      expect(await leer(tester), isFalse);
    });

    testWidgets(
      'lo pide iOS (reduceMotion, que Flutter no refleja en disableAnimations)',
      (tester) async {
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            const FakeAccessibilityFeatures(reduceMotion: true);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );
        expect(await leer(tester), isTrue);
      },
    );

    testWidgets('lo pide Android (disableAnimations)', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      expect(await leer(tester), isTrue);
    });
  });
}
