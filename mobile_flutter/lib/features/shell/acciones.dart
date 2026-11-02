import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../data/models.dart';
import '../../widgets/conforme.dart';
import '../account/avatar_provider.dart';
import '../marketero/providers.dart';

/// Rutas de segundo nivel según el rol.
String rutaCuenta(Rol? rol) => rol == Rol.cliente ? '/c/cuenta' : '/m/cuenta';

/// Lo de segundo nivel sobre la mesa: créditos (marketero) y cuenta.
List<Widget> accionesMesa(BuildContext context, WidgetRef ref) {
  final user = ref.watch(currentUserProvider);
  return [
    if (user?.rol == Rol.marketero)
      CreditosChip(
        disponibles: ref.watch(campaignStatsProvider).value?.tokensDisponibles ?? user?.tokensDisponibles,
        onTap: () => context.push('/m/cuenta/creditos'),
      ),
    const SizedBox(width: 2),
    Semantics(
      button: true,
      label: 'Cuenta',
      excludeSemantics: true,
      child: InkResponse(
        onTap: () => context.push(rutaCuenta(user?.rol)),
        radius: 26,
        child: const SizedBox.square(dimension: 48, child: Center(child: MyAvatar(size: 34))),
      ),
    ),
  ];
}
