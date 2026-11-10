import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../widgets/nexo_widgets.dart';

/// Cerrar sesión pregunta antes: un toque suelto no debe sacar a nadie de la app.
/// Es la alerta nativa de cada plataforma (iOS o Material), con el mismo texto que la web.
/// Al confirmar el diálogo sigue abierto, con «Cerrando sesión…», hasta que la sesión se cierra.
Future<void> cerrarSesionConAviso(BuildContext context, WidgetRef ref) async {
  // Se toma antes de abrir el diálogo: al cerrarse la sesión la pantalla desaparece y su `ref` deja de servir.
  final sesion = ref.read(sessionProvider.notifier);
  await confirmarAccion(
    context,
    titulo: '¿Cerrar sesión?',
    mensaje: 'Saldrás de NexoMark en este dispositivo. Para volver a entrar tendrás que iniciar sesión otra vez.',
    accion: 'Cerrar sesión',
    accionOcupada: 'Cerrando sesión…',
    alConfirmar: sesion.logout,
  );
}
