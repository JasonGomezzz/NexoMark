import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../widgets/nexo_widgets.dart';
import '../account/cerrar_sesion.dart';

/// El SuperAdmin administra desde la web; la app es para marketeros y clientes.
class AdminNoticeScreen extends ConsumerWidget {
  const AdminNoticeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: EmptyState(
            icon: LucideIcons.monitor,
            title: 'El panel de administración está en la web',
            message: 'La app es para marketeros y clientes. Entra a NexoMark desde el navegador para administrar usuarios y créditos.',
            action: OutlinedButton(
              onPressed: () => cerrarSesionConAviso(context, ref),
              child: const Text('Cerrar sesión'),
            ),
          ),
        ),
      ),
    );
  }
}
