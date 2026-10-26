import 'dart:typed_data';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models.dart';

/// Campañas del marketero (Django): voz → intención → campaña → generar → enviar.
class CampaignRepository {
  CampaignRepository(this._api);

  final ApiClient _api;
  Dio get _dj => _api.django;
  int _nextDraft = 0;
  final _drafts = <int, Campaign?>{};
  final _uncertain = <int>{};

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  Campaign _campaign(Response<dynamic> r) =>
      Campaign.fromJson(envelopeData(r)['campaign'] as Map<String, dynamic>);

  /// Lista liviana (sin imágenes en base64): la imagen se pide como miniatura aparte.
  Future<({List<Campaign> items, bool hayMas})> list({int page = 1}) =>
      _call(() async {
        final r = await _dj.get<Map<String, dynamic>>(
          '/api/campaigns/',
          queryParameters: {'page': page},
        );
        final body = r.data ?? const {};
        final results = (body['results'] as List? ?? const [])
            .whereType<Map<String, dynamic>>();
        return (
          items: results.map(Campaign.fromJson).toList(),
          hayMas: body['next'] != null,
        );
      });

  Future<Uint8List?> thumbnail(int id, int version) => _call(() async {
    final campaign = await get(id);
    final image = campaign.imagenB64;
    if (image == null || image.isEmpty) return null;
    return base64Decode(image.contains(',') ? image.split(',').last : image);
  });

  Future<CampaignStats> stats() => _call(() async {
    final r = await _dj.get<dynamic>('/api/campaigns/stats/');
    return CampaignStats.fromJson(envelopeData(r));
  });

  Future<Campaign> get(int id) => _call(
    () async => _campaign(await _dj.get<dynamic>('/api/campaigns/$id/')),
  );

  // ── Voz → campaña ────────────────────────────────────────

  /// Borrador local, sin IA de extracción ni consumo de créditos. El backend
  /// actual no expone /api/intents/: el usuario completa los campos explícitos.
  Future<CampaignIntent> interpret(
    String texto, {
    required bool porVoz,
    int? capturaMs,
  }) => _call(() async {
    final id = ++_nextDraft;
    _drafts[id] = null;
    return CampaignIntent(
      id: id,
      estado: 'borrador',
      campos: {'prompt': texto.trim()},
      faltantes: camposIntent.where((key) => key != 'prompt').toList(),
      advertencias: const [
        'El brief se conserva como instrucciones. Completa los datos de la campaña; no se han extraído con IA.',
      ],
    );
  });

  /// Confirmar crea la campaña y la manda a generar (1 crédito). Repetirlo devuelve la misma.
  Future<Campaign> confirm(int intentId, Map<String, String?> campos) => _call(
    () async {
      if (!_drafts.containsKey(intentId)) {
        throw ApiException('El borrador ya no existe. Vuelve al formulario.');
      }
      final existing = _drafts[intentId];
      if (existing != null) return get(existing.id);
      if (_uncertain.contains(intentId)) {
        throw ApiException(
          'No se confirmó la creación. Revisa Proyectos antes de volver a crear la campaña para evitar duplicados.',
        );
      }
      _uncertain.add(intentId);
      try {
        // POST /campaigns ya genera contenido: no llamar /generate otra vez.
        final r = await _dj.post<dynamic>(
          '/api/campaigns/',
          data: {
            ...campos,
            'plataformas': [campos['plataforma']],
          },
        );
        final campaign = _campaign(r);
        _drafts[intentId] = campaign;
        _uncertain.remove(intentId);
        return campaign;
      } on DioException catch (error) {
        if (error.response != null && (error.response?.statusCode ?? 0) < 500) {
          _uncertain.remove(intentId);
        }
        rethrow;
      }
    },
  );

  Future<void> discard(int intentId) async {
    _drafts.remove(intentId);
    _uncertain.remove(intentId);
  }

  // ── Edición y generación ─────────────────────────────────

  Future<Campaign> improveText(int id) => _call(
    () async =>
        _campaign(await _dj.post<dynamic>('/api/campaigns/$id/improve-text/')),
  );

  Future<Campaign> editText(int id, String texto, int version) =>
      _call(() async {
        final r = await _dj.patch<dynamic>(
          '/api/campaigns/$id/',
          data: {'texto_generado': texto, 'version': version},
        );
        return _campaign(r);
      });

  Future<Campaign> editPrompt(int id, String prompt, int version) =>
      _call(() async {
        final r = await _dj.patch<dynamic>(
          '/api/campaigns/$id/',
          data: {'prompt': prompt, 'version': version},
        );
        return _campaign(r);
      });

  Future<Campaign> regenerate(int id) => _call(() async {
    final campaign = await get(id);
    return _campaign(
      await _dj.post<dynamic>(
        '/api/campaigns/$id/${campaign.estado == EstadoCampana.borrador ? 'generate' : 'regenerate'}/',
      ),
    );
  });

  Future<Campaign> submit(int id, List<int> destinos) => _call(() async {
    if (destinos.isNotEmpty) {
      throw ApiException(
        'La publicación automática al aprobar no está habilitada en este backend. Envía solo a revisión.',
      );
    }
    final campaign = await get(id);
    final r = await _dj.post<dynamic>(
      '/api/campaigns/$id/submit/',
      data: {'version': campaign.version},
    );
    return _campaign(r);
  });

  Future<void> delete(int id) =>
      _call(() => _dj.delete<dynamic>('/api/campaigns/$id/'));

  Future<List<CampaignVersion>> versions(int id) => _call(() async {
    final r = await _dj.get<Map<String, dynamic>>(
      '/api/campaigns/$id/versions/',
    );
    final data = r.data?['data'];
    return (data is List ? data : const [])
        .whereType<Map<String, dynamic>>()
        .map(CampaignVersion.fromJson)
        .toList();
  });

  Future<String> restoreVersion(int id, int versionId) => _call(() async {
    final r = await _dj.post<dynamic>(
      '/api/campaigns/$id/versions/$versionId/restore/',
    );
    return envelopeMessage(r) ?? 'Versión restaurada.';
  });
}
