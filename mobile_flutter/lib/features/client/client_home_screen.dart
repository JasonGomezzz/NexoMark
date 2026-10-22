import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../account/avatar_provider.dart';
import '../../core/theme/tokens.dart';

final pendingProvider = FutureProvider.autoDispose<List<Campaign>>((ref) => ref.watch(clientRepositoryProvider).pending());
final decididasProvider = FutureProvider.autoDispose<List<Campaign>>((ref) async {
  final todas = await ref.watch(clientRepositoryProvider).mine();
  // Spring /mine trae todas las del cliente; las pendientes ya están arriba.
  return todas.where((c) => c.estado != EstadoCampana.pendienteAprobacion).toList();
});

String extracto(String? texto, [int max = 110]) {
  final t = (texto ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return t.length <= max ? t : '${t.substring(0, max).trimRight()}…';
}

class ClientHomeScreen extends ConsumerStatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  ConsumerState<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends ConsumerState<ClientHomeScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Al volver a la app se revisa si llegó algo nuevo.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.invalidate(pendingProvider);
  }

  Future<void> _refrescar() async {
    ref.invalidate(pendingProvider);
    ref.invalidate(decididasProvider);
    try {
      await ref.read(pendingProvider.future);
    } catch (_) {
      // Se muestra en la lista.
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final pendientes = ref.watch(pendingProvider);
    final decididas = ref.watch(decididasProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refrescar,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Entrance(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Hola, ${user?.primerNombre ?? ''}', style: context.text.headlineMedium),
                          const SizedBox(height: 2),
                          Text(
                            'Revisa lo que tu agencia preparó antes de que se publique.',
                            style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    Pressable(onTap: () => context.go('/c/cuenta'), child: const MyAvatar(size: 46)),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              SectionTitle(
                'Campañas para revisar',
                trailing: pendientes.value == null || pendientes.value!.isEmpty
                    ? null
                    : _Contador(pendientes.value!.length),
              ),
              ...pendientes.when(
                data: (lista) => lista.isEmpty
                    ? [
                        const EmptyState(
                          icon: Icons.inbox_rounded,
                          title: 'Nada por revisar',
                          message: 'Cuando tu agencia te envíe una campaña, aparecerá aquí.',
                        ),
                      ]
                    : [
                        for (final (i, c) in lista.indexed)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Entrance(
                              index: 1 + i,
                              child: CampaignCard(
                                campaign: c,
                                subtitle: '${c.marketeroNombre ?? 'Tu agencia'} · ${fechaCorta(c.enviadoClienteAt ?? c.fechaCreacion)}\n${extracto(c.textoGenerado, 70)}',
                                onTap: () => context.go('/c/inicio/revision/${c.id}'),
                              ),
                            ),
                          ),
                      ],
                loading: () => [
                  for (var i = 0; i < 2; i++)
                    const Padding(padding: EdgeInsets.only(bottom: 10), child: CampaignCardSkeleton()),
                ],
                error: (e, _) => [ErrorBanner(message: toApiException(e).message, onRetry: _refrescar)],
              ),
              const SizedBox(height: 20),
              if ((decididas.value ?? const []).isNotEmpty) ...[
                const SectionTitle('Ya decididas'),
                for (final c in decididas.value!.take(10))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: CampaignCard(
                      campaign: c,
                      subtitle: c.destinos.isEmpty
                          ? (c.marketeroNombre ?? 'Tu agencia')
                          : 'En ${c.destinos.map((d) => d.cuentaNombre).join(', ')}',
                      onTap: () => context.go('/c/inicio/revision/${c.id}'),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Contador extends StatelessWidget {
  const _Contador(this.n);
  final int n;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: context.nexo.warningContainer, borderRadius: BorderRadius.circular(999)),
      child: Text('$n', style: context.text.labelMedium?.copyWith(color: context.nexo.warning)),
    );
  }
}
