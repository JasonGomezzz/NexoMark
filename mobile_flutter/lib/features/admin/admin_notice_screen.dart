import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../widgets/nexo_widgets.dart';

/// El SuperAdmin administra desde la web; la app es para marketeros y clientes.
class AdminNoticeScreen extends ConsumerWidget {
  const AdminNoticeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: EmptyState(
            icon: Icons.desktop_windows_outlined,
            title: 'El panel de administración está en la web',
            message: 'La app es para marketeros y clientes. Entra a NexoMark desde el navegador para administrar usuarios y créditos.',
            action: OutlinedButton(
              onPressed: () => ref.read(sessionProvider.notifier).logout(),
              child: const Text('Cerrar sesión'),
            ),
          ),
        ),
      ),
    );
  }
}
