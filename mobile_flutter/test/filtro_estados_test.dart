import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/data/models.dart';
import 'package:nexomark/features/marketero/projects_screen.dart';
import 'package:nexomark/features/marketero/providers.dart';

void main() {
  test('la clave del filtro es estable y usa los nombres de la API', () {
    expect(claveEstados(TramoCampanas.generar.estados), 'borrador,generado,pendiente_ia,rechazado');
    expect(claveEstados({EstadoCampana.pendienteAprobacion}), 'pendiente_aprobacion');
    expect(claveEstados(TramoCampanas.todas.estados), '');
  });

  test('la clave vuelve a los mismos estados', () {
    for (final tramo in TramoCampanas.values) {
      expect(estadosDesdeClave(claveEstados(tramo.estados)), tramo.estados);
    }
  });
}
