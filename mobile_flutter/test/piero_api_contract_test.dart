import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/api/api_client.dart';
import 'package:nexomark/app.dart';
import 'package:nexomark/core/session/token_store.dart';
import 'package:nexomark/data/campaign_repository.dart';
import 'package:nexomark/data/social_repository.dart';
import 'package:nexomark/data/models.dart';
import 'package:nexomark/features/auth/google_auth.dart';

class _Tokens extends TokenStore {
  @override
  Future<String?> access() async => 'local-test-token';
}

class _Adapter implements HttpClientAdapter {
  final calls = <RequestOptions>[];
  Map<String, dynamic> Function(RequestOptions) reply = (_) => {};
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add(options);
    return ResponseBody.fromString(
      jsonEncode({'data': reply(options)}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late ApiClient api;
  late _Adapter adapter;
  setUp(() {
    api = ApiClient(_Tokens());
    adapter = _Adapter();
    api.django.httpClientAdapter = adapter;
  });
  tearDown(() {
    api.django.close();
    api.spring.close();
  });

  test('brief remains local and creation generates exactly once', () async {
    final repo = CampaignRepository(api);
    final draft = await repo.interpret(
      'Campaña con instrucciones dictadas',
      porVoz: true,
    );
    expect(adapter.calls, isEmpty);
    expect(draft.campos['prompt'], contains('dictadas'));
    expect(draft.campos['cliente_email'], isNull);
    adapter.reply = (_) => {
      'campaign': {
        'id': 7,
        'titulo': 'Prueba',
        'estado': 'pendiente_ia',
        'version': 2,
      },
    };
    final campaign = await repo.confirm(draft.id, {
      'titulo': 'Prueba',
      'plataforma': 'instagram',
    });
    expect(campaign.id, 7);
    expect(adapter.calls.single.path, '/api/campaigns/');
    expect(adapter.calls.single.data['plataformas'], ['instagram']);
    await repo.confirm(draft.id, {});
    expect(adapter.calls.where((r) => r.method == 'POST').length, 1);
    expect(adapter.calls.last.path, '/api/campaigns/7/');
  });

  test(
    'submit never requests automatic publishing and passes saved version',
    () async {
      final repo = CampaignRepository(api);
      adapter.reply = (_) => {
        'campaign': {
          'id': 7,
          'titulo': 'Prueba',
          'estado': 'generado',
          'version': 4,
        },
      };
      await expectLater(repo.submit(7, [1]), throwsA(isA<ApiException>()));
      expect(adapter.calls, isEmpty);
      await repo.submit(7, []);
      expect(adapter.calls.last.path, '/api/campaigns/7/submit/');
      expect(adapter.calls.last.data, {'version': 4});
    },
  );

  test('native social writes fail closed before making a request', () async {
    final repo = SocialRepository(api);
    await expectLater(repo.connectUrl('meta'), throwsA(isA<ApiException>()));
    await expectLater(repo.publish(1), throwsA(isA<ApiException>()));
    await expectLater(repo.disconnect(1), throwsA(isA<ApiException>()));
    await expectLater(repo.tiktokEnviar(7, 1), throwsA(isA<ApiException>()));
    await expectLater(repo.refreshMetrics(), throwsA(isA<ApiException>()));
    expect(adapter.calls, isEmpty);
    expect(GoogleAuth.disponibleEnEsteTelefono, false);
  });

  test(
    'summary maps real zero and missing metrics without inventing counters',
    () async {
      adapter.reply = (_) => {
        'year': 2026,
        'platforms': {
          for (final platform in ['facebook', 'instagram', 'twitter', 'tiktok'])
            platform: {
              'publications': 1,
              'pending': 0,
              'metrics': {
                'likes': {
                  'value': platform == 'tiktok' ? 0 : null,
                  'covered': platform == 'tiktok' ? 1 : 0,
                },
                'shares': {'value': null},
                'views': {'value': platform == 'twitter' ? 10 : null},
              },
            },
        },
        'monthly': [
          {
            'month': '2026-10',
            'facebook': 1,
            'instagram': 1,
            'twitter': 1,
            'tiktok': 1,
          },
        ],
        'monthly_likes': [
          {
            'month': '2026-10',
            'facebook': null,
            'instagram': null,
            'twitter': null,
            'tiktok': 0,
          },
        ],
      };
      final summary = await SocialRepository(api).summary(anio: 2026);
      expect(
        adapter.calls.single.path,
        '/api/campaigns/publication-statistics/',
      );
      expect(adapter.calls.single.queryParameters, {'year': 2026});
      expect(summary.redes['tiktok']!.metricas.meGusta, 0);
      expect(summary.redes['instagram']!.metricas.meGusta, isNull);
      expect(summary.redes['x']!.metricas.vistas, 10);
      expect(summary.meGustaPorMes.single.valores['tiktok'], 0);
      expect(summary.totalPublicaciones, 4);
    },
  );

  test('publication IDs are namespaced by platform and native detail stays read-only', () async {
    adapter.reply = (_) => {
      'publications': [
        for (final platform in ['twitter', 'tiktok'])
          {
            'platform': platform,
            'publication_id': 1,
            'campaign_id': 7,
            'destination': 'Cuenta de prueba',
            'registered_at': '2026-10-01T12:00:00Z',
            'metrics': {'likes': 0, 'shares': null, 'views': 10},
          },
      ],
    };
    final repo = SocialRepository(api);
    final rows = await repo.publications(campaignId: 7, anio: 2026);
    expect(rows.map((r) => r.id).toSet().length, 2);
    expect(rows.every((r) => r.estado == 'publicado'), true);
    expect(
      adapter.calls.single.path,
      '/api/campaigns/7/publication-statistics/',
    );
    final detail = await repo.stats(rows.first.id);
    expect(detail.publicacion.ultimaMetrica!.meGusta, 0);
    expect(adapter.calls.length, 1);
  });

  test('mobile application root compiles without starting authentication', () {
    expect(const NexoMarkApp(), isNotNull);
  });

  test(
    'ambiguous create response cannot trigger a second charged request',
    () async {
      final repo = CampaignRepository(api);
      final draft = await repo.interpret(
        'Instrucciones para la campaña',
        porVoz: false,
      );
      adapter.reply = (_) => {};
      await expectLater(
        repo.confirm(draft.id, {'plataforma': 'facebook'}),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        repo.confirm(draft.id, {'plataforma': 'facebook'}),
        throwsA(isA<ApiException>()),
      );
      expect(adapter.calls.length, 1);
    },
  );

  test('current user avatar does not require absent avatar_version', () {
    final user = AppUser.fromJson({
      'id': 3,
      'email': 'test@example.com',
      'has_avatar': true,
    });
    expect(user.avatarVersion, 3);
  });
}
