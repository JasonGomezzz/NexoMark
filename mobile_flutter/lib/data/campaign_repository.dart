import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models.dart';

/// Campañas del marketero (Django): voz → intención → campaña → generar → enviar.
class CampaignRepository {
  CampaignRepository(this._api);

  final ApiClient _api;
  Dio get _dj => _api.django;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  Campaign _campaign(Response<dynamic> r) => Campaign.fromJson(envelopeData(r)['campaign'] as Map<String, dynamic>);

  /// Lista liviana (sin imágenes en base64): la imagen se pide como miniatura aparte.
  Future<({List<Campaign> items, bool hayMas})> list({int page = 1}) => _call(() async {
        final r = await _dj.get<Map<String, dynamic>>('/api/campaigns/', queryParameters: {'vista': 'ligera', 'page': page});
        final body = r.data ?? const {};
        final results = (body['results'] as List? ?? const []).whereType<Map<String, dynamic>>();
        return (items: results.map(Campaign.fromJson).toList(), hayMas: body['next'] != null);
      });

  Future<Uint8List?> thumbnail(int id, int version) => _call(() async {
        final r = await _dj.get<List<int>>(
          '/api/campaigns/$id/miniatura/',
          queryParameters: {'v': version},
          options: Options(responseType: ResponseType.bytes),
        );
        if (r.statusCode == 204 || r.data == null || r.data!.isEmpty) return null;
        return Uint8List.fromList(r.data!);
      });

  Future<CampaignStats> stats() => _call(() async {
        final r = await _dj.get<dynamic>('/api/campaigns/stats/');
        return CampaignStats.fromJson(envelopeData(r));
      });

  Future<Campaign> get(int id) => _call(() async => _campaign(await _dj.get<dynamic>('/api/campaigns/$id/')));

  // ── Voz → campaña ────────────────────────────────────────

  /// Interpretar no genera ni cobra crédito.
  Future<CampaignIntent> interpret(String texto, {required bool porVoz}) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/intents/interpret/',
          data: {'texto': texto.trim(), 'origen': porVoz ? 'voz' : 'formulario'},
        );
        return CampaignIntent.fromJson(envelopeData(r)['intent'] as Map<String, dynamic>);
      });

  /// Confirmar crea la campaña y la manda a generar (1 crédito). Repetirlo devuelve la misma.
  Future<Campaign> confirm(int intentId, Map<String, String?> campos) => _call(() async {
        final r = await _dj.post<dynamic>('/api/intents/$intentId/confirm/', data: {'campos': campos});
        return _campaign(r);
      });

  Future<void> discard(int intentId) => _call(() => _dj.post<dynamic>('/api/intents/$intentId/discard/'));

  // ── Edición y generación ─────────────────────────────────

  Future<Campaign> improveText(int id) =>
      _call(() async => _campaign(await _dj.post<dynamic>('/api/campaigns/$id/improve-text/')));

  Future<Campaign> editText(int id, String texto, int version) => _call(() async {
        final r = await _dj.patch<dynamic>('/api/campaigns/$id/', data: {'texto_generado': texto, 'version': version});
        return _campaign(r);
      });

  Future<Campaign> editPrompt(int id, String prompt, int version) => _call(() async {
        final r = await _dj.patch<dynamic>('/api/campaigns/$id/', data: {'prompt': prompt, 'version': version});
        return _campaign(r);
      });

  Future<Campaign> regenerate(int id) =>
      _call(() async => _campaign(await _dj.post<dynamic>('/api/campaigns/$id/regenerate/')));

  Future<Campaign> submit(int id, List<int> destinos) => _call(() async {
        final r = await _dj.post<dynamic>('/api/campaigns/$id/submit/', data: {'destinos': destinos});
        return _campaign(r);
      });

  Future<void> delete(int id) => _call(() => _dj.delete<dynamic>('/api/campaigns/$id/'));

  Future<List<CampaignVersion>> versions(int id) => _call(() async {
        final r = await _dj.get<Map<String, dynamic>>('/api/campaigns/$id/versions/');
        final data = r.data?['data'];
        return (data is List ? data : const [])
            .whereType<Map<String, dynamic>>()
            .map(CampaignVersion.fromJson)
            .toList();
      });

  Future<String> restoreVersion(int id, int versionId) => _call(() async {
        final r = await _dj.post<dynamic>('/api/campaigns/$id/versions/$versionId/restore/');
        return envelopeMessage(r) ?? 'Versión restaurada.';
      });
}
