import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models.dart';

/// El cliente final revisa y decide contra Spring Boot (:8080).
/// Spring valida el JWT de Django y solo escribe estado, valoración y motivo.
class ClientRepository {
  ClientRepository(this._api);

  final ApiClient _api;
  Dio get _sp => _api.spring;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  Future<List<Campaign>> pending() => _call(() async {
        final r = await _sp.get<dynamic>('/api/v1/campaigns/pending', queryParameters: {'page': 0, 'size': 30});
        final content = envelopeData(r)['content'];
        return (content is List ? content : const [])
            .whereType<Map<String, dynamic>>()
            .map(Campaign.fromJson)
            .toList();
      });

  /// Las ya decididas (aprobadas, rechazadas) para el historial del cliente.
  Future<List<Campaign>> mine() => _call(() async {
        final r = await _sp.get<dynamic>('/api/v1/campaigns/mine', queryParameters: {'page': 0, 'size': 30});
        final content = envelopeData(r)['content'];
        return (content is List ? content : const [])
            .whereType<Map<String, dynamic>>()
            .map(Campaign.fromJson)
            .toList();
      });

  Future<Campaign> get(int id) => _call(() async {
        final r = await _sp.get<dynamic>('/api/v1/campaigns/$id');
        return Campaign.fromJson(envelopeData(r));
      });

  Future<Campaign> decide(
    int id, {
    required bool aprobar,
    required int version,
    required int valoracion,
    String? feedback,
  }) =>
      _call(() async {
        final r = await _sp.patch<dynamic>('/api/v1/campaigns/$id/status', data: {
          'estado': aprobar ? 'aprobado' : 'rechazado',
          'version': version,
          'valoracion': valoracion,
          if (!aprobar) 'feedback': feedback?.trim(),
        });
        return Campaign.fromJson(envelopeData(r));
      });
}
