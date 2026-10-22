import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models.dart';

/// Envío de una campaña aprobada al buzón de TikTok. Se completa cuando el
/// backend tenga TikTok (fase B4); mientras tanto no muestra nada.
class TikTokBlock extends ConsumerWidget {
  const TikTokBlock({super.key, required this.campana});
  final Campaign campana;

  @override
  Widget build(BuildContext context, WidgetRef ref) => const SizedBox.shrink();
}
