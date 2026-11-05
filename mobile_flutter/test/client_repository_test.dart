import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/api/api_client.dart';
import 'package:nexomark/core/session/token_store.dart';
import 'package:nexomark/data/client_repository.dart';

/// Spring con [total] campañas pendientes, paginadas como Page de Spring Data.
class _Spring implements HttpClientAdapter {
  _Spring(this.total);
  final int total;
  final paginas = <int>[];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? _, Future<void>? _) async {
    final page = o.queryParameters['page'] as int;
    final size = o.queryParameters['size'] as int;
    paginas.add(page);
    final desde = page * size;
    final hasta = (desde + size).clamp(0, total);
    final content = [for (var i = desde; i < hasta; i++) {'id': i + 1, 'titulo': 'c$i', 'estado': 'pendiente_aprobacion'}];
    final body = {'success': true, 'data': {'content': content, 'last': hasta >= total, 'number': page}};
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  ClientRepository repo(_Spring spring) {
    final api = ApiClient(TokenStore())..spring.httpClientAdapter = spring;
    return ClientRepository(api);
  }

  test('trae todas las pendientes aunque pasen de una página', () async {
    final spring = _Spring(65);
    final lista = await repo(spring).pending();
    expect(lista, hasLength(65));
    expect(spring.paginas, [0, 1, 2]);
  });

  test('una sola página no pide más', () async {
    final spring = _Spring(4);
    expect(await repo(spring).mine(), hasLength(4));
    expect(spring.paginas, [0]);
  });

  test('tiene tope de páginas', () async {
    final spring = _Spring(10000);
    expect(await repo(spring).pending(), hasLength(30 * ClientRepository.maxPaginas));
  });
}
