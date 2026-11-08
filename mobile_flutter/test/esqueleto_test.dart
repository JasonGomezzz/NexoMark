import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/data/models.dart';
import 'package:nexomark/widgets/campaign_widgets.dart';
import 'package:nexomark/widgets/motion_widgets.dart';

Widget _app(Widget child) => MaterialApp(theme: buildTheme(Brightness.light), home: Scaffold(body: Center(child: child)));

double _opacidad(WidgetTester tester) =>
    tester.widget<AnimatedOpacity>(find.descendant(of: find.byType(Skeleton), matching: find.byType(AnimatedOpacity))).opacity;

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('no se ve si la carga dura menos de 300 ms, pero ya ocupa su lugar', (tester) async {
    await tester.pumpWidget(_app(const Skeleton(width: 120, height: 20)));
    expect(_opacidad(tester), 0);
    expect(tester.getSize(find.byType(Skeleton)), const Size(120, 20));
    await tester.pump(const Duration(milliseconds: 250));
    expect(_opacidad(tester), 0);
    await tester.pump(const Duration(milliseconds: 60));
    expect(_opacidad(tester), 1);
  });

  testWidgets('con reducir movimiento aparece con el mismo fundido, pero no late', (tester) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(reduceMotion: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpWidget(_app(const Skeleton(width: 120, height: 20)));
    await tester.pump(const Duration(milliseconds: 250));
    expect(_opacidad(tester), 0);
    await tester.pump(const Duration(milliseconds: 60));
    await tester.pump(const Duration(milliseconds: 160));
    expect(_opacidad(tester), 1);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('la fila de carga mide lo mismo que la tarjeta real', (tester) async {
    const c = Campaign(id: 1, titulo: 'Promo', estado: EstadoCampana.generado, clienteNombre: 'Café Aurora');
    await tester.pumpWidget(_app(const SizedBox(width: 360, child: CampaignCardSkeleton())));
    final alto = tester.getSize(find.byType(CampaignCardSkeleton)).height;
    await tester.pumpWidget(_app(SizedBox(width: 360, child: CampaignCard(campaign: c, onTap: () {}))));
    expect(tester.getSize(find.byType(CampaignCard)).height, closeTo(alto, 4));
  });
}
