import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models.dart';

/// Redes sociales (Django /api/social/): conexiones, destinos, publicaciones,
/// métricas y la versión corta para X.
class SocialRepository {
  SocialRepository(this._api);

  final ApiClient _api;
  Dio get _dj => _api.django;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  List<T> _lista<T>(dynamic value, T Function(Map<String, dynamic>) parse) =>
      (value is List ? value : const []).whereType<Map<String, dynamic>>().map(parse).toList();

  // ── Conexiones ───────────────────────────────────────────

  Future<List<SocialConnection>> connections() => _call(() async {
        final r = await _dj.get<dynamic>('/api/social/connections/');
        return _lista(envelopeData(r)['conexiones'], SocialConnection.fromJson);
      });

  Future<void> disconnect(int id) => _call(() => _dj.delete<dynamic>('/api/social/connections/$id/'));

  /// URL del proveedor para abrir en el navegador del sistema (retorno por nexomark://).
  Future<String> connectUrl(String proveedor) => _call(() async {
        final r = await _dj.get<dynamic>('/api/social/$proveedor/connect/', queryParameters: {'plataforma': 'app'});
        return envelopeData(r)['url'] as String;
      });

  /// Canjea el código con el JWT del mismo usuario que inició la conexión.
  Future<String> complete(String proveedor, String code, String state) => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/$proveedor/complete/', data: {'code': code, 'state': state});
        return envelopeMessage(r) ?? 'Cuenta conectada.';
      });

  /// Cuentas de Instagram y Facebook del cliente donde se publica al aprobar.
  Future<List<SocialConnection>> destinos(String clienteEmail) => _call(() async {
        final r = await _dj.get<dynamic>(
          '/api/social/connections/destinos/',
          queryParameters: {'cliente_email': clienteEmail},
        );
        return _lista(envelopeData(r)['conexiones'], SocialConnection.fromJson);
      });

  // ── Publicaciones y métricas ─────────────────────────────

  Future<List<Publication>> publications({int? campaignId, int? anio}) => _call(() async {
        final r = await _dj.get<dynamic>('/api/social/publications/', queryParameters: {
          'campaign': ?campaignId,
          'anio': ?anio,
        });
        return _lista(envelopeData(r)['publicaciones'], Publication.fromJson);
      });

  Future<Publication> publish(int id) => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/publications/$id/publish/');
        return Publication.fromJson(envelopeData(r)['publicacion'] as Map<String, dynamic>);
      });

  Future<({Publication publicacion, List<Metric> historial, String? aviso})> stats(int id) => _call(() async {
        final r = await _dj.get<dynamic>('/api/social/publications/$id/stats/', queryParameters: {'refresh': 1});
        final d = envelopeData(r);
        return (
          publicacion: Publication.fromJson(d['publicacion'] as Map<String, dynamic>),
          historial: _lista(d['historial'], Metric.fromJson),
          aviso: d['aviso'] as String?,
        );
      });

  Future<StatsSummary> summary({int? anio}) => _call(() async {
        final r = await _dj.get<dynamic>(
          '/api/social/publications/summary/',
          queryParameters: {'anio': ?anio},
        );
        return StatsSummary.fromJson(envelopeData(r));
      });

  Future<String> refreshMetrics() => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/publications/refresh/');
        return envelopeMessage(r) ?? 'Métricas actualizadas.';
      });

  // ── X (opcional) ─────────────────────────────────────────

  Future<XConfig> xConfig() async {
    try {
      final r = await _dj.get<dynamic>('/api/social/x/config/');
      return XConfig.fromJson(envelopeData(r));
    } catch (_) {
      // Si no se puede saber, X no aparece: es una red opcional.
      return const XConfig();
    }
  }

  Future<List<XVariant>> xVariants({int? campaignId}) => _call(() async {
        final r = await _dj.get<dynamic>(
          '/api/social/x-variants/',
          queryParameters: {'campaign': ?campaignId},
        );
        final d = envelopeData(r);
        return _lista(d['variantes'] ?? d['results'], XVariant.fromJson);
      });

  Future<XVariant> createXVariant(int campaignId, {String? texto}) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/social/x-variants/',
          data: {'campaign': campaignId, 'texto': ?texto},
        );
        return XVariant.fromJson(envelopeData(r)['variante'] as Map<String, dynamic>);
      });

  Future<XVariant> editXVariant(int id, String texto) => _call(() async {
        final r = await _dj.patch<dynamic>('/api/social/x-variants/$id/', data: {'texto': texto});
        return XVariant.fromJson(envelopeData(r)['variante'] as Map<String, dynamic>);
      });

  Future<XVariant> sendXVariant(int id) => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/x-variants/$id/enviar/');
        return XVariant.fromJson(envelopeData(r)['variante'] as Map<String, dynamic>);
      });

  Future<XVariant> approveXVariant(int id, String hash) => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/x-variants/$id/aprobar/', data: {'hash_texto': hash});
        return XVariant.fromJson(envelopeData(r)['variante'] as Map<String, dynamic>);
      });

  Future<XVariant> rejectXVariant(int id, String feedback) => _call(() async {
        final r = await _dj.post<dynamic>('/api/social/x-variants/$id/rechazar/', data: {'feedback': feedback});
        return XVariant.fromJson(envelopeData(r)['variante'] as Map<String, dynamic>);
      });
}
