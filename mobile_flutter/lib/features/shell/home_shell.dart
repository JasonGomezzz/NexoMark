import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../data/models.dart';

/// Barra inferior por rol. Las pestañas conservan su estado (IndexedStack):
/// cambiar de pestaña es instantáneo, como debe ser algo que se toca decenas
/// de veces al día; solo el indicador de la barra se desliza.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.shell, required this.rol});

  final StatefulNavigationShell shell;
  final Rol rol;

  static const _marketero = [
    (Icons.home_outlined, Icons.home_rounded, 'Inicio'),
    (Icons.mic_none_rounded, Icons.mic_rounded, 'Laboratorio'),
    (Icons.folder_outlined, Icons.folder_rounded, 'Proyectos'),
    (Icons.insights_outlined, Icons.insights_rounded, 'Estadísticas'),
    (Icons.person_outline_rounded, Icons.person_rounded, 'Cuenta'),
  ];

  static const _cliente = [
    (Icons.inbox_outlined, Icons.inbox_rounded, 'Inicio'),
    (Icons.insights_outlined, Icons.insights_rounded, 'Estadísticas'),
    (Icons.person_outline_rounded, Icons.person_rounded, 'Cuenta'),
  ];

  @override
  Widget build(BuildContext context) {
    final items = rol == Rol.cliente ? _cliente : _marketero;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) {
          HapticFeedback.selectionClick();
          // Tocar la pestaña activa vuelve a su raíz.
          shell.goBranch(i, initialLocation: i == shell.currentIndex);
        },
        destinations: [
          for (final (icon, selected, label) in items)
            NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: label),
        ],
      ),
    );
  }
}
