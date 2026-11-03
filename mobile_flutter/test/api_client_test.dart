import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/api/api_client.dart';
import 'package:nexomark/core/session/token_store.dart';

/// Responde según la ruta; `null` simula que no hay red.
class _Adaptador implements HttpClientAdapter {
  _Adaptador(this.responder);

  final ({int status, Map<String, dynamic> body})? Function(RequestOptions o) responder;
  final pedidos = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    pedidos.add(options);
    final r = responder(options);
    if (r == null) {
      throw DioException.connectionError(requestOptions: options, reason: 'sin red');
    }
    return ResponseBody.fromString(jsonEncode(r.body), r.status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late TokenStore tokens;
  late ApiClient api;
  late bool vencida;

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    tokens = TokenStore();
    await tokens.save(access: 'viejo', refresh: 'r1');
    api = ApiClient(tokens);
    vencida = false;
    api.onSessionExpired = () => vencida = true;
    api.django.httpClientAdapter = _Adaptador((o) => o.headers['Authorization'] == 'Bearer nuevo'
        ? (status: 200, body: {'success': true, 'data': {}})
        : (status: 401, body: {'detail': 'token vencido'}));
  });

  test('sin red al renovar no cierra la sesión ni borra los tokens', () async {
    api.refreshDio.httpClientAdapter = _Adaptador((_) => null);
    await expectLater(api.django.get<dynamic>('/api/auth/me/'), throwsA(isA<DioException>()));
    expect(vencida, isFalse);
    expect(await tokens.refresh(), 'r1');
  });

  test('un 5xx al renovar tampoco cierra la sesión', () async {
    api.refreshDio.httpClientAdapter = _Adaptador((_) => (status: 503, body: {}));
    await expectLater(api.django.get<dynamic>('/api/auth/me/'), throwsA(isA<DioException>()));
    expect(vencida, isFalse);
  });

  test('si el servidor rechaza el refresh, la sesión termina', () async {
    api.refreshDio.httpClientAdapter = _Adaptador((_) => (status: 401, body: {'detail': 'en lista negra'}));
    await expectLater(api.django.get<dynamic>('/api/auth/me/'), throwsA(isA<DioException>()));
    expect(vencida, isTrue);
  });

  test('con refresh válido renueva y reintenta la petición', () async {
    api.refreshDio.httpClientAdapter = _Adaptador((_) => (status: 200, body: {'access': 'nuevo', 'refresh': 'r2'}));
    final r = await api.django.get<dynamic>('/api/auth/me/');
    expect(r.statusCode, 200);
    expect(await tokens.refresh(), 'r2');
  });

  test('refreshRechazado solo reconoce respuestas que terminan la sesión', () {
    expect([400, 401, 403].every(refreshRechazado), isTrue);
    expect([null, 500, 502, 503, 429].any(refreshRechazado), isFalse);
  });
}
