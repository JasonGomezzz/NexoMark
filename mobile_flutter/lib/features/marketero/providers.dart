import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/models.dart';

final campaignStatsProvider = FutureProvider.autoDispose<CampaignStats>(
  (ref) => ref.watch(campaignRepositoryProvider).stats(),
);

/// Primera página de campañas (lista liviana, sin base64) y si el servidor tiene más.
/// La clave son los estados que filtra el servidor, separados por coma ("" = todas).
final campaignListProvider =
    FutureProvider.autoDispose.family<({List<Campaign> items, bool hayMas}), String>((ref, estados) {
  return ref.watch(campaignRepositoryProvider).list(estados: estadosDesdeClave(estados));
});

/// Clave estable del filtro por estado para [campaignListProvider].
String claveEstados(Set<EstadoCampana> estados) => (estados.map((e) => e.api).toList()..sort()).join(',');

Set<EstadoCampana> estadosDesdeClave(String clave) =>
    clave.isEmpty ? const {} : clave.split(',').map(EstadoCampana.desde).toSet();

final campaignProvider = FutureProvider.autoDispose.family<Campaign, int>(
  (ref, id) => ref.watch(campaignRepositoryProvider).get(id),
);

/// Miniaturas: se quedan en memoria mientras la app está abierta (≈30 KB c/u).
/// La clave lleva la versión de la campaña para refrescar si cambió la imagen.
final thumbnailProvider = FutureProvider.family<Uint8List?, (int, int)>(
  (ref, key) => ref.watch(campaignRepositoryProvider).thumbnail(key.$1, key.$2),
);

final campaignPublicationsProvider = FutureProvider.autoDispose.family<List<Publication>, int>(
  (ref, id) => ref.watch(socialRepositoryProvider).publications(campaignId: id),
);

final xConfigProvider = FutureProvider.autoDispose<XConfig>(
  (ref) => ref.watch(socialRepositoryProvider).xConfig(),
);

final tiktokConfigProvider = FutureProvider.autoDispose<TikTokConfig>(
  (ref) => ref.watch(socialRepositoryProvider).tiktokConfig(),
);
