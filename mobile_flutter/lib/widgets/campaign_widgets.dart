import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';
import '../data/models.dart';
import '../features/marketero/providers.dart';
import 'motion_widgets.dart';
import 'nexo_widgets.dart';

/// Base64 → bytes una sola vez por texto (decodificar 1,5 MB en cada build se nota).
final _cache = <int, Uint8List>{};

Uint8List? decodeImagen(String? b64) {
  if (b64 == null || b64.isEmpty) return null;
  final key = Object.hash(b64.length, b64.hashCode);
  final hit = _cache[key];
  if (hit != null) return hit;
  try {
    final datos = b64.startsWith('data:')
        ? b64.substring(b64.indexOf(',') + 1)
        : b64;
    final bytes = base64Decode(datos);
    if (_cache.length > 12) _cache.remove(_cache.keys.first);
    return _cache[key] = bytes;
  } catch (_) {
    return null;
  }
}

String heroImagen(int id) => 'campana-imagen-$id';

/// Imagen de la campaña: completa si viene en base64, si no la miniatura.
/// Entra con un fundido corto al terminar de cargar (sin saltos).
class CampaignImage extends ConsumerWidget {
  const CampaignImage({
    super.key,
    required this.campaign,
    this.radius = Nexo.radiusCard,
    this.hero = true,
    this.fit = BoxFit.cover,
  });

  final Campaign campaign;
  final double radius;
  final bool hero;
  final BoxFit fit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget child;
    final completa = decodeImagen(campaign.imagenB64);
    if (completa != null) {
      child = Image.memory(completa, fit: fit, gaplessPlayback: true);
    } else if (campaign.tieneImagen) {
      final mini = ref.watch(
        thumbnailProvider((campaign.id, campaign.version)),
      );
      child = mini.when(
        data: (bytes) => bytes == null
            ? const _SinImagen()
            : _FadeInImage(bytes: bytes, fit: fit),
        loading: () => const Skeleton(height: double.infinity, radius: 0),
        error: (_, _) => const _SinImagen(),
      );
    } else if (campaign.estado == EstadoCampana.pendienteIa) {
      child = const _Generando();
    } else {
      child = const _SinImagen();
    }
    final clipped = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: ColoredBox(
        color: context.colors.surfaceContainerHigh,
        child: SizedBox.expand(child: child),
      ),
    );
    return hero ? Hero(tag: heroImagen(campaign.id), child: clipped) : clipped;
  }
}

class _FadeInImage extends StatelessWidget {
  const _FadeInImage({required this.bytes, required this.fit});
  final Uint8List bytes;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Image.memory(
      bytes,
      fit: fit,
      gaplessPlayback: true,
      frameBuilder: (context, child, frame, sync) {
        if (sync) return child;
        return AnimatedOpacity(
          opacity: frame == null ? 0 : 1,
          duration: Motion.of(context, Motion.base),
          curve: Motion.easeOut,
          child: child,
        );
      },
    );
  }
}

class _SinImagen extends StatelessWidget {
  const _SinImagen();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        Icons.image_outlined,
        color: context.colors.onSurfaceVariant,
        size: 28,
      ),
    );
  }
}

class _Generando extends StatelessWidget {
  const _Generando();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const Skeleton(height: double.infinity, radius: 0),
        Center(child: Icon(Icons.auto_awesome, color: context.colors.primary)),
      ],
    );
  }
}

/// Tarjeta de campaña para listas. La imagen viaja (Hero) al detalle:
/// conserva el lugar de donde vino.
class CampaignCard extends StatelessWidget {
  const CampaignCard({
    super.key,
    required this.campaign,
    required this.onTap,
    this.subtitle,
  });

  final Campaign campaign;
  final VoidCallback onTap;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return NexoCard(
      onTap: onTap,
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 76,
            child: CampaignImage(campaign: campaign, radius: 10),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campaign.titulo,
                  style: context.text.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle ??
                      (campaign.clienteNombre.isEmpty
                          ? 'Sin cliente'
                          : campaign.clienteNombre),
                  style: context.text.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Flexible(child: StatePill(campaign.estado, dense: true)),
                    const SizedBox(width: 8),
                    if (campaign.plataforma.isNotEmpty)
                      NetworkIcon(campaign.plataforma, size: 18),
                  ],
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: context.colors.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

/// Esqueleto con la forma de una tarjeta de campaña.
class CampaignCardSkeleton extends StatelessWidget {
  const CampaignCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const NexoCard(
      padding: EdgeInsets.all(10),
      child: Row(
        children: [
          Skeleton(width: 76, height: 76, radius: 10),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton(width: 160, height: 14),
                SizedBox(height: 8),
                Skeleton(width: 100, height: 12),
                SizedBox(height: 12),
                Skeleton(width: 90, height: 22, radius: 99),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
