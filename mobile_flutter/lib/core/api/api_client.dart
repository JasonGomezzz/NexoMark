import 'dart:async';

import 'package:dio/dio.dart';

import '../config.dart';
import '../session/token_store.dart';

/// Error de la API ya traducido a algo que se puede mostrar.
class ApiException implements Exception {
  ApiException(this.message, {this.status, this.data = const {}});

  final String message;
  final int? status;

  /// `data` del sobre {success, message, data} (motivos como `link_required`).
  final Map<String, dynamic> data;

  bool get isNetwork => status == null;
  bool flag(String key) => data[key] == true;

  @override
  String toString() => message;
}

/// Lee el sobre estándar {success, message, data} de Django y Spring.
Map<String, dynamic> envelopeData(Response<dynamic> response) {
  final body = response.data;
  if (body is Map<String, dynamic>) {
    final data = body['data'];
    if (data is Map<String, dynamic>) return data;
    return const {};
  }
  return const {};
}

String? envelopeMessage(Response<dynamic> response) {
  final body = response.data;
  return body is Map<String, dynamic> ? body['message'] as String? : null;
}

ApiException toApiException(Object error) {
  if (error is ApiException) return error;
  if (error is DioException) {
    final response = error.response;
    if (response == null) {
      return ApiException(
        'No hay conexión con el servidor de NexoMark. Revisa tu internet o que el servidor esté encendido.',
      );
    }
    final body = response.data;
    String? message;
    Map<String, dynamic> data = const {};
    if (body is Map<String, dynamic>) {
      message = (body['message'] ?? body['detail']) as String?;
      final d = body['data'];
      if (d is Map<String, dynamic>) data = d;
    }
    final status = response.statusCode;
    message ??= switch (status) {
      401 => 'Tu sesión venció. Inicia sesión otra vez.',
      403 => 'No tienes permiso para hacer esto.',
      404 => 'No encontramos lo que buscabas.',
      429 => 'Demasiados intentos. Espera un momento y vuelve a intentar.',
      _ when (status ?? 500) >= 500 => 'El servidor tuvo un problema. Intenta de nuevo en un momento.',
      _ => 'No se pudo completar la acción.',
    };
    return ApiException(message, status: status, data: data);
  }
  return ApiException('Ocurrió un error inesperado.');
}

/// Dos clientes HTTP (Django y Spring) que comparten la sesión.
///
/// Un 401 renueva el access con el refresh una sola vez, aunque fallen varias
/// peticiones a la vez (las demás esperan la misma renovación), y reintenta.
/// Si la renovación falla, se avisa con [onSessionExpired].
class ApiClient {
  ApiClient(this._tokens) {
    django = _build(AppConfig.djangoUrl);
    spring = _build(AppConfig.springUrl);
  }

  final TokenStore _tokens;
  late final Dio django;
  late final Dio spring;
  void Function()? onSessionExpired;
  Future<String?>? _refreshing;

  Dio _build(String baseUrl) {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 40),
      sendTimeout: const Duration(seconds: 40),
      headers: {'Accept': 'application/json'},
    ));
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.extra['public'] != true) {
          final access = await _tokens.access();
          if (access != null) options.headers['Authorization'] = 'Bearer $access';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final options = error.requestOptions;
        final unauthorized = error.response?.statusCode == 401;
        if (!unauthorized || options.extra['public'] == true || options.extra['retried'] == true) {
          return handler.next(error);
        }
        final access = await _refreshOnce();
        if (access == null) {
          onSessionExpired?.call();
          return handler.next(error);
        }
        options.headers['Authorization'] = 'Bearer $access';
        options.extra['retried'] = true;
        try {
          handler.resolve(await dio.fetch<dynamic>(options));
        } on DioException catch (retryError) {
          handler.next(retryError);
        }
      },
    ));
    return dio;
  }

  Future<String?> _refreshOnce() {
    return _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _refresh() async {
    final refresh = await _tokens.refresh();
    if (refresh == null) return null;
    try {
      final response = await Dio(BaseOptions(baseUrl: AppConfig.djangoUrl)).post<Map<String, dynamic>>(
        '/api/auth/token/refresh/',
        data: {'refresh': refresh},
      );
      final access = response.data?['access'] as String?;
      if (access == null) return null;
      // La rotación de refresh tokens devuelve uno nuevo: el anterior queda en la lista negra.
      await _tokens.updateTokens(access: access, refresh: response.data?['refresh'] as String?);
      return access;
    } on DioException {
      return null;
    }
  }
}

/// Opciones para endpoints públicos (sin JWT ni renovación).
final publicOptions = Options(extra: {'public': true});
