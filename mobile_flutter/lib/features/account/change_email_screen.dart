import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../data/models.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../../core/theme/tokens.dart';

/// Cambio de correo con doble confirmación: un enlace al correo actual y otro
/// al nuevo (se abren en la web). Mientras está pendiente se ve qué falta y
/// cuánto queda de los 30 minutos.
class ChangeEmailScreen extends ConsumerStatefulWidget {
  const ChangeEmailScreen({super.key});

  @override
  ConsumerState<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends ConsumerState<ChangeEmailScreen> {
  final _correo = TextEditingController();
  final _password = TextEditingController();
  EmailChangePending? _pendiente;
  bool _cargando = true;
  bool _ocupado = false;
  String? _error;
  Timer? _reloj;
  Timer? _sondeo;

  @override
  void initState() {
    super.initState();
    _leer();
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _pendiente != null) setState(() {});
    });
    // Mientras está pendiente, se revisa cada 10 s si ya se confirmó algún enlace.
    _sondeo = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_pendiente != null) _leer();
    });
  }

  @override
  void dispose() {
    _reloj?.cancel();
    _sondeo?.cancel();
    _correo.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _leer() async {
    try {
      final p = await ref.read(authRepositoryProvider).emailChangeStatus();
      if (mounted) setState(() => _pendiente = p);
    } on ApiException catch (e) {
      // 401: el cambio se completó en otro lado y cerró la sesión; el cliente HTTP ya avisa.
      if (mounted && e.status != 401) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _solicitar() async {
    if (!_correo.text.contains('@')) return setState(() => _error = 'Escribe el correo nuevo.');
    if (_password.text.isEmpty) return setState(() => _error = 'Escribe tu contraseña actual.');
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      final p = await ref.read(authRepositoryProvider).requestEmailChange(_correo.text, _password.text);
      _password.clear();
      setState(() => _pendiente = p);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _cancelar() async {
    setState(() => _ocupado = true);
    try {
      await ref.read(authRepositoryProvider).cancelEmailChange();
      setState(() => _pendiente = null);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Cambiar correo')),
      body: SafeArea(
        child: _cargando
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  NexoCard(
                    child: Row(
                      children: [
                        Icon(Icons.alternate_email_rounded, color: context.colors.primary),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Correo actual', style: context.text.bodySmall),
                              Text(user?.email ?? '', style: context.text.titleSmall),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  AnimatedSwitcher(
                    duration: Motion.of(context, Motion.base),
                    child: _pendiente != null
                        ? _Pendiente(key: const ValueKey('p'), pendiente: _pendiente!, onCancelar: _ocupado ? null : _cancelar)
                        : user?.hasPassword == false
                            ? Column(
                                key: const ValueKey('sin'),
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const InfoBanner(
                                    tone: InfoTone.warning,
                                    message: 'Tu cuenta entra con Google y aún no tiene contraseña. Créala primero: el cambio de correo la pide.',
                                  ),
                                  const SizedBox(height: 12),
                                  FilledButton(
                                    onPressed: () => context.push(
                                      user?.rol == Rol.cliente ? '/c/cuenta/contrasena' : '/m/cuenta/contrasena',
                                    ),
                                    child: const Text('Crear contraseña'),
                                  ),
                                ],
                              )
                            : Column(
                                key: const ValueKey('f'),
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  TextField(
                                    controller: _correo,
                                    keyboardType: TextInputType.emailAddress,
                                    autocorrect: false,
                                    decoration: const InputDecoration(labelText: 'Correo nuevo'),
                                  ),
                                  const SizedBox(height: 12),
                                  TextField(
                                    controller: _password,
                                    obscureText: true,
                                    decoration: const InputDecoration(labelText: 'Contraseña actual'),
                                    onSubmitted: (_) => _solicitar(),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    'Te enviaremos un enlace a cada correo. El cambio ocurre cuando confirmes los dos, y se cerrarán tus sesiones.',
                                    style: context.text.bodySmall,
                                  ),
                                  if (_error != null) ...[const SizedBox(height: 12), ErrorBanner(message: _error!)],
                                  const SizedBox(height: 16),
                                  FilledButton(
                                    onPressed: _ocupado ? null : _solicitar,
                                    child: _ocupado
                                        ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                                        : const Text('Enviar enlaces'),
                                  ),
                                ],
                              ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _Pendiente extends StatelessWidget {
  const _Pendiente({super.key, required this.pendiente, required this.onCancelar});

  final EmailChangePending pendiente;
  final VoidCallback? onCancelar;

  @override
  Widget build(BuildContext context) {
    final resta = pendiente.expiresAt.difference(DateTime.now());
    final vencido = resta.isNegative;
    final mm = resta.inMinutes.remainder(60).toString().padLeft(2, '0');
    final ss = resta.inSeconds.remainder(60).toString().padLeft(2, '0');
    Widget paso(String titulo, String detalle, bool hecho) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              AnimatedContainer(
                duration: Motion.of(context, Motion.base),
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hecho ? context.nexo.success : context.colors.surfaceContainerHigh,
                ),
                child: Icon(hecho ? Icons.check_rounded : Icons.schedule_rounded, size: 16, color: hecho ? context.nexo.onSuccess : context.colors.onSurfaceVariant),
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
              SwapIn(child: Text(hecho ? 'Confirmado' : 'Falta', key: ValueKey(hecho), style: context.text.labelMedium)),
            ],
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Entrance(
          child: NexoCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Cambio a ${pendiente.newEmail}', style: context.text.titleMedium),
                const SizedBox(height: 4),
                Text(
                  vencido ? 'Los enlaces vencieron. Cancela y vuelve a pedirlo.' : 'Los enlaces vencen en $mm:$ss',
                  style: context.text.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                const SizedBox(height: 14),
                paso('Correo actual', 'Abre el enlace que te enviamos', pendiente.oldConfirmed),
                paso('Correo nuevo', 'Abre el enlace en ${pendiente.newEmail}', pendiente.newConfirmed),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Los enlaces se abren en la web de NexoMark. Al confirmar los dos se cerrarán tus sesiones: entra con el correo nuevo.',
          style: context.text.bodySmall,
        ),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: onCancelar, child: const Text('Cancelar solicitud')),
      ],
    );
  }
}
