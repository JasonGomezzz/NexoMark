import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/models.dart';
import '../../widgets/linea.dart';
import '../client/client_home_screen.dart';
import '../marketero/projects_screen.dart';
import '../marketero/providers.dart';

/// La navegación es el recorrido. El marketero ve las cinco estaciones
/// (Dictar → Generar → Aprobar → Publicar → Medir); el cliente, su tramo
/// (Aprobar → Publicar → Medir). Cada estación lleva su conteo real.
/// Las pestañas conservan su estado (IndexedStack): cambiar es instantáneo.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell, required this.rol});

  final StatefulNavigationShell shell;
  final Rol rol;

  List<Estacion> _estaciones(WidgetRef ref) {
    if (rol == Rol.cliente) {
      final pendientes = ref.watch(pendingProvider).value?.length;
      return [
        Estacion('Aprobar', LucideIcons.checkCheck, conteo: pendientes, descripcionConteo: pendientes == null ? null : '$pendientes por revisar'),
        const Estacion('Publicar', LucideIcons.send),
        const Estacion('Medir', LucideIcons.chartColumn),
      ];
    }
    final stats = ref.watch(campaignStatsProvider).value;
    int? conteo(TramoCampanas t) => stats == null ? null : conteoTramo(stats, t);
    final generar = conteo(TramoCampanas.generar);
    final aprobar = conteo(TramoCampanas.aprobar);
    final publicar = conteo(TramoCampanas.publicar);
    return [
      const Estacion('Dictar', LucideIcons.mic),
      Estacion('Generar', LucideIcons.wandSparkles, conteo: generar, descripcionConteo: generar == null ? null : '$generar campañas'),
      Estacion('Aprobar', LucideIcons.checkCheck, conteo: aprobar, descripcionConteo: aprobar == null ? null : '$aprobar esperan al cliente'),
      Estacion('Publicar', LucideIcons.send, conteo: publicar, descripcionConteo: publicar == null ? null : '$publicar aprobadas'),
      const Estacion('Medir', LucideIcons.chartColumn),
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: LineaBar(
        estaciones: _estaciones(ref),
        actual: shell.currentIndex,
        // Tocar la estación activa vuelve a su raíz.
        onSelect: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
      ),
    );
  }
}
