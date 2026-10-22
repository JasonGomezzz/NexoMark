import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/preferences.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../auth/google_auth.dart';
import 'avatar_provider.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const SizedBox.shrink();
    final base = user.rol == Rol.cliente ? '/c/cuenta' : '/m/cuenta';
    final esMarketero = user.rol == Rol.marketero;

    return Scaffold(
      appBar: AppBar(title: const Text('Cuenta')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(sessionProvider.notifier).refreshUser(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              Entrance(child: _Perfil(user: user, onFoto: () => context.push('$base/foto'))),
              const SizedBox(height: 20),
              if (!esMarketero) ...[
                Entrance(
                  index: 1,
                  child: _Opcion(
                    icon: Icons.hub_outlined,
                    titulo: 'Redes conectadas',
                    detalle: 'Autoriza tus cuentas de Instagram y Facebook para que se publique lo que apruebes.',
                    destacado: true,
                    onTap: () => context.push('$base/redes'),
                  ),
                ),
                const SizedBox(height: 20),
              ],
              _Grupo(titulo: 'Seguridad', children: [
                _Opcion(
                  icon: Icons.alternate_email_rounded,
                  titulo: 'Cambiar correo',
                  detalle: user.email,
                  onTap: () => context.push('$base/correo'),
                ),
                _Opcion(
                  icon: Icons.password_rounded,
                  titulo: user.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña',
                  detalle: user.hasPassword ? 'Te pedimos la actual' : 'Tu cuenta entra con Google y aún no tiene contraseña',
                  onTap: () => context.push('$base/contrasena'),
                ),
                if (user.googleConnected || GoogleAuth.disponibleEnEsteTelefono) _GoogleOpcion(user: user),
              ]),
              const SizedBox(height: 20),
              if (esMarketero) ...[
                _Grupo(titulo: 'Trabajo', children: [
                  _Opcion(
                    icon: Icons.bolt_rounded,
                    titulo: 'Créditos',
                    detalle: user.tokensDisponibles == null ? 'sin dato' : '${user.tokensDisponibles} disponibles',
                    onTap: () => context.push('$base/creditos'),
                  ),
                  _Opcion(
                    icon: Icons.hub_outlined,
                    titulo: 'Redes conectadas',
                    detalle: 'Cuentas que administras para tus clientes',
                    onTap: () => context.push('$base/redes'),
                  ),
                ]),
                const SizedBox(height: 20),
              ],
              _Grupo(titulo: 'Apariencia', children: [const _Tema()]),
              const SizedBox(height: 20),
              _Grupo(titulo: 'Ayuda', children: [
                _Opcion(
                  icon: Icons.tips_and_updates_outlined,
                  titulo: esMarketero ? 'Guía para dictar buenos briefs' : 'Cómo revisar una campaña',
                  detalle: esMarketero ? 'Qué decir para que la IA acierte' : 'Qué pasa al aprobar o pedir cambios',
                  onTap: () => showModalBottomSheet<void>(
                    context: context,
                    useRootNavigator: true,
                    isScrollControlled: true,
                    builder: (_) => _Ayuda(marketero: esMarketero),
                  ),
                ),
              ]),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => ref.read(sessionProvider.notifier).logout(),
                icon: Icon(Icons.logout_rounded, color: context.colors.error),
                label: Text('Cerrar sesión', style: TextStyle(color: context.colors.error)),
                style: OutlinedButton.styleFrom(side: BorderSide(color: context.colors.error.withValues(alpha: 0.5))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Perfil extends ConsumerWidget {
  const _Perfil({required this.user, required this.onFoto});
  final AppUser user;
  final VoidCallback onFoto;

  Future<void> _editarNombre(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: user.nombre);
    final nombre = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tu nombre'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Nombre completo'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Guardar')),
        ],
      ),
    );
    controller.dispose();
    if (nombre == null || nombre.length < 2 || nombre == user.nombre) return;
    try {
      final actualizado = await ref.read(authRepositoryProvider).updateName(nombre);
      ref.read(sessionProvider.notifier).updateUser(actualizado);
    } on ApiException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NavyPanel(
      child: Row(
        children: [
          Pressable(
            onTap: onFoto,
            child: Stack(
              children: [
                const MyAvatar(size: 72),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: const BoxDecoration(color: Nexo.turquoise, shape: BoxShape.circle),
                    child: const Icon(Icons.photo_camera_rounded, size: 14, color: Nexo.navyDeep),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => _editarNombre(context, ref),
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.nombre,
                          style: context.text.titleLarge?.copyWith(color: Nexo.onNavy),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.edit_rounded, size: 16, color: Nexo.onNavyMuted),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(user.email, style: context.text.bodySmall?.copyWith(color: Nexo.onNavyMuted), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: Nexo.navyRaised, borderRadius: BorderRadius.circular(999)),
                  child: Text(
                    user.rol == Rol.cliente ? 'Cliente' : 'Marketero',
                    style: context.text.labelMedium?.copyWith(color: Nexo.turquoiseSoft),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Grupo extends StatelessWidget {
  const _Grupo({required this.titulo, required this.children});
  final String titulo;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(titulo, style: context.text.labelLarge?.copyWith(color: context.colors.onSurfaceVariant)),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: context.colors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(Nexo.radiusCard),
            border: Border.all(color: context.colors.outlineVariant),
          ),
          child: Column(
            children: [
              for (final (i, child) in children.indexed) ...[
                if (i > 0) const Divider(height: 1, indent: 56),
                child,
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Opcion extends StatelessWidget {
  const _Opcion({required this.icon, required this.titulo, required this.detalle, this.onTap, this.trailing, this.destacado = false});

  final IconData icon;
  final String titulo;
  final String detalle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool destacado;

  @override
  Widget build(BuildContext context) {
    final tile = ListTile(
      onTap: onTap,
      minTileHeight: 64,
      leading: Icon(icon, color: context.colors.primary),
      title: Text(titulo, style: context.text.titleSmall),
      subtitle: Text(detalle, style: context.text.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: trailing ?? (onTap != null ? Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant) : null),
    );
    if (!destacado) return tile;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.colors.primaryFixed,
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
        border: Border.all(color: context.colors.primary.withValues(alpha: 0.4)),
      ),
      child: tile,
    );
  }
}

class _GoogleOpcion extends ConsumerWidget {
  const _GoogleOpcion({required this.user});
  final AppUser user;

  Future<void> _desvincular(BuildContext context, WidgetRef ref) async {
    if (!user.hasPassword) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Primero crea una contraseña: sin ella no podrías volver a entrar.'),
      ));
      return;
    }
    final controller = TextEditingController();
    final password = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Desvincular Google'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Volverás a entrar con tu correo y contraseña. Se cerrarán tus sesiones.'),
            const SizedBox(height: 12),
            TextField(controller: controller, obscureText: true, autofocus: true, decoration: const InputDecoration(labelText: 'Contraseña de NexoMark')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Desvincular')),
        ],
      ),
    );
    controller.dispose();
    if (password == null || password.isEmpty) return;
    try {
      final mensaje = await ref.read(authRepositoryProvider).googleDisconnect(password);
      await ref.read(sessionProvider.notifier).logout(mensaje);
    } on ApiException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!user.googleConnected && !GoogleAuth.disponibleEnEsteTelefono) return const SizedBox.shrink();
    return _Opcion(
      icon: Icons.account_circle_outlined,
      titulo: 'Google',
      detalle: user.googleConnected
          ? 'Vinculado: puedes entrar con «Continuar con Google»'
          : 'No vinculado. Se vincula al entrar con Google con este mismo correo.',
      onTap: user.googleConnected ? () => _desvincular(context, ref) : null,
      trailing: user.googleConnected ? Text('Desvincular', style: context.text.labelMedium?.copyWith(color: context.colors.error)) : null,
    );
  }
}

/// Claro, oscuro o el del sistema. El indicador se desliza entre opciones.
class _Tema extends ConsumerWidget {
  const _Tema();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final modo = ref.watch(themeModeProvider);
    const opciones = [
      (ThemeMode.light, Icons.light_mode_outlined, 'Claro'),
      (ThemeMode.dark, Icons.dark_mode_outlined, 'Oscuro'),
      (ThemeMode.system, Icons.phone_iphone_rounded, 'Sistema'),
    ];
    final indice = opciones.indexWhere((o) => o.$1 == modo);
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Container(
        height: 48,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: context.colors.surfaceContainer, borderRadius: BorderRadius.circular(Nexo.radiusButton + 2)),
        child: LayoutBuilder(
          builder: (context, c) => Stack(
            children: [
              AnimatedPositioned(
                duration: Motion.of(context, Motion.base),
                curve: Motion.easeInOut,
                left: c.maxWidth / 3 * indice,
                width: c.maxWidth / 3,
                top: 0,
                bottom: 0,
                child: Container(
                  decoration: BoxDecoration(
                    color: context.colors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(Nexo.radiusButton),
                    border: Border.all(color: context.colors.outlineVariant),
                  ),
                ),
              ),
              Positioned.fill(
                child: Row(
                children: [
                  for (final (m, icon, label) in opciones)
                    Expanded(
                      child: Semantics(
                        selected: modo == m,
                        button: true,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(Nexo.radiusButton),
                          onTap: () => ref.read(themeModeProvider.notifier).set(m),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(icon, size: 18, color: modo == m ? context.colors.primary : context.colors.onSurfaceVariant),
                              const SizedBox(width: 6),
                              Text(label, style: context.text.labelMedium),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Ayuda extends StatelessWidget {
  const _Ayuda({required this.marketero});
  final bool marketero;

  @override
  Widget build(BuildContext context) {
    final puntos = marketero
        ? [
            ('Di qué vendes y la promoción', '«Capuchino 2×1 los martes» funciona mejor que «una promo de café».'),
            ('Nombra al cliente y su correo', 'Así la campaña le llega a su cuenta para aprobar.'),
            ('Elige el tono', 'Profesional, casual, urgente, inspiracional, humorístico o persuasivo.'),
            ('Di la red', 'Instagram, Facebook o TikTok: orienta el largo y el estilo del texto.'),
            ('Revisa antes de generar', 'Interpretar es gratis; generar usa 1 crédito.'),
          ]
        : [
            ('Mira la imagen y el texto completos', 'Se publicará exactamente lo que apruebes.'),
            ('Revisa «Se publicará en»', 'Son tus cuentas conectadas que eligió la agencia.'),
            ('Valora de 1 a 5', 'Es obligatorio para aprobar o pedir cambios.'),
            ('Pedir cambios', 'Explica qué cambiar (mínimo 10 caracteres). Un segundo rechazo cierra la campaña.'),
          ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(marketero ? 'Cómo dictar un buen brief' : 'Cómo revisar una campaña', style: context.text.titleLarge),
            const SizedBox(height: 14),
            for (final (i, (titulo, detalle)) in puntos.indexed)
              Entrance(
                index: i,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(color: Nexo.turquoise, shape: BoxShape.circle),
                        child: Text('${i + 1}', style: const TextStyle(color: Nexo.navyDeep, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(titulo, style: context.text.titleSmall),
                            Text(detalle, style: context.text.bodySmall),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
