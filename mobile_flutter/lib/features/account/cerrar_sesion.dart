import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../widgets/nexo_widgets.dart';

/// Cerrar sesión pregunta antes: un toque suelto no debe sacar a nadie de la app.
/// Es la alerta nativa de cada plataforma (iOS o Material).
Future<void> cerrarSesionConAviso(BuildContext context, WidgetRef ref) async {
  final ok = await confirmarAccion(
    context,
    titulo: '¿Cerrar sesión?',
    mensaje: 'Tendrás que volver a entrar con tu correo o con Google. Tus campañas no se pierden.',
    accion: 'Cerrar sesión',
    destructivo: true,
  );
  if (ok) await ref.read(sessionProvider.notifier).logout();
}
