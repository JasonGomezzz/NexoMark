import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/data/models.dart';
import 'package:nexomark/features/marketero/project_detail_screen.dart';

void main() {
  final ig = Publication.fromJson({'id': 1, 'red': 'instagram', 'cuenta_nombre': '@nexomarkia', 'estado': 'pendiente'});

  test('mientras cargan los destinos no afirma que no hay publicación automática', () {
    expect(avisoEnvio('Café Aurora', const AsyncLoading()), 'Enviada a Café Aurora.');
  });

  test('si falla la carga lo dice en vez de inventar «sin destinos»', () {
    final aviso = avisoEnvio('Café Aurora', AsyncError(Exception('sin red'), StackTrace.empty));
    expect(aviso, contains('No pudimos leer sus destinos'));
    expect(aviso, isNot(contains('No tiene publicación automática')));
  });

  test('ya cargado: sin destinos o con la cuenta donde se publicará', () {
    expect(avisoEnvio('Café Aurora', const AsyncData([])), contains('No tiene publicación automática'));
    expect(avisoEnvio('Café Aurora', AsyncData([ig])), contains('se publicará en @nexomarkia'));
  });
}
