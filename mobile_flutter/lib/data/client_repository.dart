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

  Future<List<Campaign>> pending() => _call(() => _todas('/api/v1/campaigns/pending'));

  /// Las ya decididas (aprobadas, rechazadas) para el historial del cliente.
  Future<List<Campaign>> mine() => _call(() => _todas('/api/v1/campaigns/mine'));

  /// Spring pagina de 30 en 30: se piden las páginas hasta la última (`last`),
  /// con un tope de [maxPaginas] para no quedar en bucle si la respuesta viene rara.
  static const maxPaginas = 10;

  Future<List<Campaign>> _todas(String ruta) async {
    final todas = <Campaign>[];
    for (var pagina = 0; pagina < maxPaginas; pagina++) {
      final r = await _sp.get<dynamic>(ruta, queryParameters: {'page': pagina, 'size': 30});
      final datos = envelopeData(r);
      final content = datos['content'];
      final items = (content is List ? content : const []).whereType<Map<String, dynamic>>().toList();
      todas.addAll(items.map(Campaign.fromJson));
      if (items.isEmpty || datos['last'] != false) break;
    }
    return todas;
  }

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
