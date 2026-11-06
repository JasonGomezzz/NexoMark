import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nexomark/widgets/nexo_widgets.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  test('las fechas van con el mes en minúscula y sin punto', () {
    expect(fechaCorta(DateTime(2026, 11, 5)), '5 nov 2026');
    expect(fechaHora(DateTime(2026, 9, 1, 8, 5)), '1 set 2026, 08:05');
    expect(fechaCorta(null), 'sin fecha');
  });
}
