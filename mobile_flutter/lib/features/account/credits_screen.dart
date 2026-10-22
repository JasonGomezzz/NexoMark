import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../../core/theme/tokens.dart';

final _solicitudesProvider = FutureProvider.autoDispose((ref) => ref.watch(authRepositoryProvider).creditRequests());

/// Créditos del marketero y solicitudes al superadmin (no es un pago).
class CreditsScreen extends ConsumerStatefulWidget {
  const CreditsScreen({super.key});

  @override
  ConsumerState<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends ConsumerState<CreditsScreen> {
  final _motivo = TextEditingController();
  bool _ocupado = false;

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  Future<void> _solicitar() async {
    setState(() => _ocupado = true);
    try {
      final mensaje = await ref.read(authRepositoryProvider).requestCredits(_motivo.text);
      _motivo.clear();
      ref.invalidate(_solicitudesProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final solicitudes = ref.watch(_solicitudesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Créditos')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(_solicitudesProvider);
            await ref.read(sessionProvider.notifier).refreshUser();
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              CreditsMeter(disponibles: user?.tokensDisponibles),
              const SizedBox(height: 20),
              ...solicitudes.when(
                loading: () => [const Skeleton(height: 120)],
                error: (e, _) => [ErrorBanner(message: toApiException(e).message)],
                data: (d) => [
                  if (d.pendiente != null)
                    InfoBanner(
                      icon: Icons.hourglass_top_rounded,
                      message: 'Tienes una solicitud pendiente del ${fechaCorta(d.pendiente!.fecha)}. El administrador la revisará.',
                    )
                  else ...[
                    Text('Solicitar créditos', style: context.text.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      'El administrador decide cuántos sumar. Los planes y precios reales aún no están definidos.',
                      style: context.text.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _motivo,
                      maxLength: 300,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'Para qué los necesitas (opcional)'),
                    ),
                    FilledButton(
                      onPressed: _ocupado ? null : _solicitar,
                      child: Text(_ocupado ? 'Enviando…' : 'Enviar solicitud'),
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (d.solicitudes.isNotEmpty) ...[
                    const SectionTitle('Historial'),
                    for (final (i, s) in d.solicitudes.indexed)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Entrance(
                          index: i,
                          child: NexoCard(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Icon(
                                  switch (s.estado) {
                                    'aprobada' => Icons.check_circle_rounded,
                                    'rechazada' => Icons.cancel_rounded,
                                    _ => Icons.hourglass_top_rounded,
                                  },
                                  color: switch (s.estado) {
                                    'aprobada' => context.nexo.success,
                                    'rechazada' => context.colors.error,
                                    _ => context.nexo.warning,
                                  },
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        switch (s.estado) {
                                          'aprobada' => '+${s.creditosOtorgados} créditos',
                                          'rechazada' => 'Rechazada',
                                          _ => 'Pendiente',
                                        },
                                        style: context.text.titleSmall,
                                      ),
                                      Text(
                                        [fechaCorta(s.fecha), if (s.notaResolucion.isNotEmpty) s.notaResolucion].join(' · '),
                                        style: context.text.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
