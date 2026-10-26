import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models.dart';

/// Contrato de piero: leer mediciones guardadas no llama a proveedores.
class SocialRepository {
  SocialRepository(this._api);
  final ApiClient _api;
  Dio get _dj => _api.django;
  final _publications = <int, Publication>{};
  static const _keys = ['facebook', 'instagram', 'twitter', 'tiktok'];
  static const _webOnly =
      'Usa la web de NexoMark para esta acción. El backend actual no admite este flujo nativo. No se publicó ni conectó ninguna cuenta.';
  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  Future<T> _unsupported<T>() async => throw ApiException(_webOnly);
  String _red(String key) => key == 'twitter' ? 'x' : key;

  Future<List<SocialConnection>> connections() => _call(() async {
    final result = <SocialConnection>[];
    for (final (index, endpoint) in [
      ('facebook', 'facebook/pages'),
      ('instagram', 'instagram/accounts'),
      ('twitter', 'x/accounts'),
      ('tiktok', 'tiktok/accounts'),
    ].indexed) {
      final r = await _dj.get<dynamic>('/api/auth/${endpoint.$2}/');
      final data = envelopeData(r);
      final items =
          data[endpoint.$1 == 'facebook' ? 'pages' : 'accounts'] as List? ??
          const [];
      for (final item in items.whereType<Map<String, dynamic>>()) {
        result.add(
          SocialConnection(
            id: (item['id'] as int) * 10 + index,
            red: _red(endpoint.$1),
            cuentaNombre:
                (item['name'] ??
                        item['username'] ??
                        item['display_name'] ??
                        'Cuenta conectada')
                    .toString(),
            estado: item['expired'] == true ? 'vencida' : 'activa',
          ),
        );
      }
    }
    return result;
  });
  Future<void> disconnect(int id) => _unsupported();
  Future<String> connectUrl(String proveedor) => _unsupported();
  Future<String> complete(String proveedor, String code, String state) =>
      _unsupported();
  Future<List<SocialConnection>> destinos(String clienteEmail) async =>
      const [];

  Future<Map<String, dynamic>> _saved({int? campaignId, int? anio}) async {
    final path = campaignId == null
        ? '/api/campaigns/publication-statistics/'
        : '/api/campaigns/$campaignId/publication-statistics/';
    return envelopeData(
      await _dj.get<dynamic>(
        path,
        queryParameters: {'year': anio ?? DateTime.now().year},
      ),
    );
  }

  Future<List<Publication>> publications({
    int? campaignId,
    int? anio,
  }) => _call(() async {
    final data = await _saved(campaignId: campaignId, anio: anio);
    final year = anio ?? DateTime.now().year;
    final rows = data['publications'] as List? ?? const [];
    final result = <Publication>[];
    for (final row in rows.whereType<Map<String, dynamic>>()) {
      final platform = row['platform'] as String;
      final registered = DateTime.tryParse(
        row['registered_at'] as String? ?? '',
      );
      if (!_keys.contains(platform) ||
          registered == null ||
          registered.toUtc().subtract(const Duration(hours: 5)).year != year) {
        continue;
      }
      final metrics = row['metrics'] as Map<String, dynamic>? ?? const {};
      final id = (row['publication_id'] as int) * 10 + _keys.indexOf(platform);
      final item = Publication(
        id: id,
        campaignId: row['campaign_id'] as int,
        red: _red(platform),
        cuentaNombre: row['destination'] as String? ?? '',
        estado: 'publicado',
        campaignTitulo: row['title'] as String?,
        publicadoAt: registered,
        ultimaMetrica: Metric(
          meGusta: metrics['likes'] as int?,
          compartidos: metrics['shares'] as int?,
          vistas: metrics['views'] as int?,
          obtenida: DateTime.tryParse(row['measured_at'] as String? ?? ''),
        ),
      );
      _publications[id] = item;
      result.add(item);
    }
    return result;
  });
  Future<Publication> publish(int id) => _unsupported();
  Future<({Publication publicacion, List<Metric> historial, String? aviso})>
  stats(int id) async {
    final item = _publications[id];
    if (item == null) {
      throw ApiException(
        'Recarga las publicaciones para ver la medición guardada.',
      );
    }
    return (
      publicacion: item,
      historial: item.ultimaMetrica == null
          ? <Metric>[]
          : [item.ultimaMetrica!],
      aviso: 'Medición guardada. Actualiza los contadores desde la web; no se hizo una consulta externa.',
    );
  }

  Future<StatsSummary> summary({int? anio}) => _call(() async {
    final data = await _saved(anio: anio);
    final platforms = data['platforms'] as Map<String, dynamic>;
    final redes = <String, NetworkSummary>{};
    var total = 0;
    var pending = 0;
    for (final key in _keys) {
      final group = platforms[key] as Map<String, dynamic>;
      final metrics = group['metrics'] as Map<String, dynamic>;
      int? value(String metric) =>
          (metrics[metric] as Map<String, dynamic>?)?['value'] as int?;
      final count = group['publications'] as int;
      total += count;
      pending += group['pending'] as int? ?? 0;
      redes[_red(key)] = NetworkSummary(
        red: _red(key),
        publicaciones: count,
        conMetricas:
            (metrics['likes'] as Map<String, dynamic>?)?['covered'] as int? ??
            0,
        metricas: Metric(
          meGusta: value('likes'),
          compartidos: value('shares'),
          vistas: value('views'),
        ),
      );
    }
    List<MonthPoint> series(String key) => (data[key] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => MonthPoint(row['month'] as String, {
            for (final key in _keys) _red(key): row[key] as int?,
          }),
        )
        .toList();
    final year = data['year'] as int;
    return StatsSummary(
      redes: redes,
      totalPublicaciones: total,
      pendientes: pending,
      anio: year,
      anios: List.generate(5, (i) => DateTime.now().year - i),
      publicacionesPorMes: series('monthly'),
      meGustaPorMes: series('monthly_likes'),
    );
  });
  Future<String> refreshMetrics() async => throw ApiException(
    'Consulta los contadores desde la web. Aquí solo se leen mediciones guardadas, sin consumir presupuesto de X.',
  );
  Future<XConfig> xConfig() async => const XConfig();
  Future<List<XVariant>> xVariants({int? campaignId}) async => const [];
  Future<XVariant> createXVariant(int campaignId, {String? texto}) =>
      _unsupported();
  Future<XVariant> editXVariant(int id, String texto) => _unsupported();
  Future<XVariant> sendXVariant(int id) => _unsupported();
  Future<XVariant> approveXVariant(int id, String hash) => _unsupported();
  Future<XVariant> rejectXVariant(int id, String feedback) => _unsupported();
  Future<TikTokConfig> tiktokConfig() async => const TikTokConfig();
  Future<List<SocialConnection>> tiktokDestinos(int campaignId) async =>
      const [];
  Future<({Publication publicacion, String mensaje})> tiktokEnviar(
    int campaignId,
    int conexionId,
  ) => _unsupported();
  Future<({Publication publicacion, String mensaje})> tiktokEstado(
    int publicacionId,
  ) => _unsupported();
}
