import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/features/marketero/lab_screen.dart';

void main() {
  test('el correo se revisa al salir del campo', () {
    expect(validarCampoFicha('cliente_email', 'cafe@aurora'), isNotNull);
    expect(validarCampoFicha('cliente_email', 'cafe@aurora.pe'), isNull);
  });

  test('vacío no es error: la ficha ya lo marca como «falta»', () {
    expect(validarCampoFicha('cliente_email', '  '), isNull);
    expect(validarCampoFicha('prompt', ''), isNull);
  });

  test('las instrucciones piden al menos 10 caracteres, como el servidor', () {
    expect(validarCampoFicha('prompt', 'corto'), isNotNull);
    expect(validarCampoFicha('prompt', 'dos capuchinos sobre madera'), isNull);
  });
}
