import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nexomark/core/theme/app_theme.dart';
import 'package:nexomark/data/models.dart';
import 'package:nexomark/widgets/campaign_widgets.dart';

Widget _app(Widget child) => MaterialApp(theme: buildTheme(Brightness.light), home: Scaffold(body: Center(child: child)));

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('lo secundario va en una sola línea con « · »', (tester) async {
    final c = Campaign(id: 1, titulo: 'Promo', estado: EstadoCampana.generado, clienteNombre: 'Café Aurora', fechaCreacion: DateTime(2026, 11, 5));
    await tester.pumpWidget(_app(SizedBox(width: 360, child: CampaignCard(campaign: c, onTap: () {}))));
    expect(tester.widget<Text>(find.text('Café Aurora · 5 nov 2026')).maxLines, 1);
  });

  testWidgets('datos extremos: título largo, cliente sin espacios y letra 1.3× no desbordan', (tester) async {
    final c = Campaign(
      id: 1,
      titulo: 'Campaña de lanzamiento de la nueva línea de capuchinos de temporada con descuento ' * 3,
      estado: EstadoCampana.pendienteAprobacion,
      clienteNombre: 'CaféAuroraSucursalMirafloresYSanIsidroDelPerúSociedadAnónimaCerrada',
      plataforma: 'instagram',
      fechaCreacion: DateTime(2026, 9, 30),
    );
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
      child: _app(SizedBox(width: 320, child: Column(children: [CampaignCard(campaign: c, onTap: () {}), const CampaignCardSkeleton()]))),
    ));
    expect(tester.takeException(), isNull);
  });
}
