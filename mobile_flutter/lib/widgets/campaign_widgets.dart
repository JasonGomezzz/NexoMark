import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';
import '../data/models.dart';
import '../features/marketero/providers.dart';
import 'conforme.dart';
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
    final datos = b64.startsWith('data:') ? b64.substring(b64.indexOf(',') + 1) : b64;
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
  const CampaignImage({super.key, required this.campaign, this.radius = Nexo.radiusSurface, this.hero = true, this.fit = BoxFit.cover});

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
      final mini = ref.watch(thumbnailProvider((campaign.id, campaign.version)));
      child = mini.when(
        data: (bytes) => bytes == null ? const _SinImagen() : _FadeInImage(bytes: bytes, fit: fit),
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
      child: ColoredBox(color: context.colors.surfaceContainerHigh, child: SizedBox.expand(child: child)),
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
    return Center(child: Icon(LucideIcons.image, color: context.colors.onSurfaceVariant, size: 26));
  }
}

/// La imagen todavía no existe: el marco de la pieza, quieto (ni esqueleto ni
/// spinner). Si hay espacio, dice qué va a aparecer ahí.
class _Generando extends StatelessWidget {
  const _Generando();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.surfaceContainerLow,
      child: LayoutBuilder(
        builder: (context, box) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.sparkles, color: context.colors.primary, size: box.maxWidth > 160 ? 28 : 20),
              if (box.maxWidth > 160) ...[
                const SizedBox(height: 8),
                Text('Aquí va la imagen', style: context.text.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Líneas quietas con la forma del copy que viene. No pulsan: la IA tarda de
/// 8 a 30 s y algo que late tanto rato cansa; el avance lo cuenta el reloj.
class LineasCopy extends StatelessWidget {
  const LineasCopy({super.key});

  @override
  Widget build(BuildContext context) {
    final color = context.colors.surfaceContainerHigh;
    Widget linea(double factor) => FractionallySizedBox(
          widthFactor: factor,
          alignment: Alignment.centerLeft,
          child: Container(height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6))),
        );
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [linea(1), const SizedBox(height: 12), linea(0.92), const SizedBox(height: 12), linea(0.55)],
      ),
    );
  }
}

/// Cuánto lleva la generación y cuánto suele tardar. No inventa pasos: el
/// servidor solo dice "pendiente_ia". Sin [desde] (se abrió a mitad de camino)
/// no se muestra un reloj que mentiría.
class EsperaGeneracion extends StatefulWidget {
  const EsperaGeneracion({super.key, this.desde});

  final DateTime? desde;

  @override
  State<EsperaGeneracion> createState() => _EsperaGeneracionState();
}

class _EsperaGeneracionState extends State<EsperaGeneracion> {
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    if (widget.desde != null) {
      _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final desde = widget.desde;
    final lleva = desde == null ? null : DateTime.now().difference(desde);
    final reloj = lleva == null ? null : '${lleva.inMinutes}:${(lleva.inSeconds % 60).toString().padLeft(2, '0')}';
    final pasado = lleva != null && lleva.inSeconds > 30;
    return Semantics(
      label: 'Generando. Suele tardar entre 8 y 30 segundos.',
      excludeSemantics: true,
      // Wrap: con letra grande la segunda parte baja de línea en vez de desbordar.
      child: Wrap(
        spacing: 10,
        runSpacing: 2,
        crossAxisAlignment: WrapCrossAlignment.end,
        children: [
          Text(
            reloj == null ? 'Generando' : 'Generando · $reloj',
            style: context.text.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          Text(
            pasado ? 'tarda más de lo habitual (8 a 30 s)' : 'suele tardar entre 8 y 30 s',
            style: context.text.bodySmall,
          ),
        ],
      ),
    );
  }
}

/// Fila de campaña para las listas de cada estación. Sin tarjeta: las filas
/// se separan con hilos. La imagen viaja (Hero) al detalle.
class CampaignCard extends StatelessWidget {
  const CampaignCard({super.key, required this.campaign, required this.onTap, this.subtitle});

  final Campaign campaign;
  final VoidCallback onTap;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    // Lo secundario va en una sola línea, separado con « · ».
    final meta = subtitle ??
        [
          campaign.clienteNombre.isEmpty ? 'Sin cliente' : campaign.clienteNombre,
          if (campaign.fechaCreacion != null) fechaCorta(campaign.fechaCreacion),
        ].join(' · ');
    return Semantics(
      button: true,
      label: '${campaign.titulo}. ${campaign.estado.etiqueta}. $meta',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        scale: 0.98,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  children: [
                    SizedBox.square(dimension: 64, child: CampaignImage(campaign: campaign, radius: Nexo.radiusField)),
                    // Lo aprobado lleva el sello «conforme».
                    if (campaign.estado == EstadoCampana.aprobado) const Positioned(right: 0, bottom: 0, child: Sello(size: 30)),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(campaign.titulo, style: context.text.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(meta, style: context.text.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Flexible(child: StatePill(campaign.estado, dense: true)),
                        const SizedBox(width: 8),
                        if (campaign.plataforma.isNotEmpty) NetworkIcon(campaign.plataforma, size: 18),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(LucideIcons.chevronRight, size: 20, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

/// Esqueleto con la forma de una fila de campaña.
class CampaignCardSkeleton extends StatelessWidget {
  const CampaignCardSkeleton({super.key});

  // Mismas medidas que [CampaignCard] (imagen de 64 en una caja de 72, título,
  // una línea de datos y la píldora): al llegar la lista nada salta.
  @override
  Widget build(BuildContext context) {
    final t = context.text;
    final escala = MediaQuery.textScalerOf(context);
    // Alto de una línea de ese estilo, con la letra que eligió la persona.
    double alto(TextStyle? s) => escala.scale(s?.fontSize ?? 14) * (s?.height ?? 1.3);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const SizedBox(
            width: 72,
            height: 72,
            child: Align(alignment: Alignment.topLeft, child: Skeleton(width: 64, height: 64, radius: Nexo.radiusField)),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: alto(t.titleMedium), child: const Align(alignment: Alignment.centerLeft, child: Skeleton(width: 180, height: 14))),
                const SizedBox(height: 2),
                SizedBox(height: alto(t.bodySmall), child: const Align(alignment: Alignment.centerLeft, child: Skeleton(width: 130, height: 11))),
                const SizedBox(height: 8),
                const Skeleton(width: 90, height: 22, radius: 99),
              ],
            ),
          ),
          const SizedBox(width: 28),
        ],
      ),
    );
  }
}
