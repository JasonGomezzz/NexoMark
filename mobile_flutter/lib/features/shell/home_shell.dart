import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/conforme.dart';
import '../client/client_home_screen.dart';
import '../marketero/projects_screen.dart';
import '../marketero/providers.dart';
import 'acciones.dart';

/// La app es una prueba de imprenta: la mesa marina enmarca, el trabajo va
/// en el pliego y la navegación es la orden de trabajo. El marketero ve los
/// cinco pasos (Dictar → Generar → Aprobar → Publicar → Medir); el cliente,
/// su tramo (Aprobar → Publicar → Medir). Cada casilla lleva su conteo real.
/// Las pestañas conservan su estado (IndexedStack): cambiar es instantáneo.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell, required this.rol});

  final StatefulNavigationShell shell;
  final Rol rol;

  List<Paso> _pasos(WidgetRef ref) {
    if (rol == Rol.cliente) {
      final pendientes = ref.watch(pendingProvider).value?.length;
      return [
        Paso('Aprobar', LucideIcons.stamp, conteo: pendientes, descripcionConteo: pendientes == null ? null : '$pendientes por revisar'),
        const Paso('Publicar', LucideIcons.send),
        const Paso('Medir', LucideIcons.chartColumn),
      ];
    }
    final stats = ref.watch(campaignStatsProvider).value;
    int? conteo(TramoCampanas t) => stats == null ? null : conteoTramo(stats, t);
    final generar = conteo(TramoCampanas.generar);
    final aprobar = conteo(TramoCampanas.aprobar);
    final publicar = conteo(TramoCampanas.publicar);
    return [
      const Paso('Dictar', LucideIcons.mic),
      Paso('Generar', LucideIcons.wandSparkles, conteo: generar, descripcionConteo: generar == null ? null : '$generar campañas'),
      Paso('Aprobar', LucideIcons.stamp, conteo: aprobar, descripcionConteo: aprobar == null ? null : '$aprobar esperan al cliente'),
      Paso('Publicar', LucideIcons.send, conteo: publicar, descripcionConteo: publicar == null ? null : '$publicar aprobadas'),
      const Paso('Medir', LucideIcons.chartColumn),
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: context.nexo.cama,
      body: Column(
        children: [
          MesaBar(acciones: accionesMesa(context, ref)),
          Expanded(child: Pliego(child: shell)),
        ],
      ),
      bottomNavigationBar: OrdenBar(
        pasos: _pasos(ref),
        actual: shell.currentIndex,
        // Tocar el paso activo vuelve a su raíz.
        onSelect: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
      ),
    );
  }
}
