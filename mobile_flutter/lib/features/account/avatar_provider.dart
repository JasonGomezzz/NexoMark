import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../widgets/nexo_widgets.dart';

/// Foto del usuario: se vuelve a pedir solo cuando cambia `avatar_version`.
final avatarProvider = FutureProvider.family<Uint8List?, int?>((
  ref,
  version,
) async {
  if (version == null) return null;
  return ref.watch(authRepositoryProvider).avatar();
});

/// Avatar del usuario en sesión (foto o iniciales).
class MyAvatar extends ConsumerWidget {
  const MyAvatar({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return SizedBox.square(dimension: size);
    final bytes = ref
        .watch(avatarProvider(user.hasAvatar ? user.avatarVersion : null))
        .value;
    return Avatar(initials: user.iniciales, bytes: bytes, size: size);
  }
}
