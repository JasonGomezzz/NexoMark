import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/conforme.dart';
import '../../widgets/nexo_widgets.dart';

final pendingProvider = FutureProvider.autoDispose<List<Campaign>>((ref) => ref.watch(clientRepositoryProvider).pending());
final decididasProvider = FutureProvider.autoDispose<List<Campaign>>((ref) async {
  final todas = await ref.watch(clientRepositoryProvider).mine();
  // Spring /mine trae todas las del cliente; las pendientes van en Aprobar.
  return todas.where((c) => c.estado != EstadoCampana.pendienteAprobacion).toList();
});

String extracto(String? texto, [int max = 110]) {
  final t = (texto ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return t.length <= max ? t : '${t.substring(0, max).trimRight()}…';
}

/// El cliente ve su tramo de la línea: Aprobar → Publicar → Medir.
enum TramoCliente { aprobar, publicar }

class ClientHomeScreen extends ConsumerStatefulWidget {
  const ClientHomeScreen({super.key, this.tramo = TramoCliente.aprobar});

  final TramoCliente tramo;

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
      await ref.read((widget.tramo == TramoCliente.aprobar ? pendingProvider : decididasProvider).future);
    } catch (_) {
      // Se muestra en la lista.
    }
  }

  @override
  Widget build(BuildContext context) {
    final aprobar = widget.tramo == TramoCliente.aprobar;
    final lista = ref.watch(aprobar ? pendingProvider : decididasProvider);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refrescar,
        
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: PliegoTitulo(titulo: aprobar ? 'Aprobar' : 'Publicar', subtitulo: aprobar
                  ? 'Revisa lo que tu agencia preparó. Nada se publica sin tu aprobación.'
                  : 'Lo que ya decidiste y dónde se publicó.')),
            ...lista.when(
              data: (items) => items.isEmpty
                  ? [
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Padding(
                          padding: const EdgeInsets.all(Nexo.gutter),
                          child: aprobar
                              ? const EmptyState(
                                  icon: LucideIcons.inbox,
                                  title: 'Nada por revisar',
                                  message: 'Cuando tu agencia te envíe una campaña, aparecerá aquí.',
                                )
                              : const EmptyState(
                                  icon: LucideIcons.send,
                                  title: 'Todavía no decides ninguna',
                                  message: 'Las campañas que apruebes o devuelvas quedarán aquí.',
                                ),
                        ),
                      ),
                    ]
                  : [
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
                        sliver: SliverList.separated(
                          itemCount: items.length,
                          separatorBuilder: (_, _) => const Divider(),
                          itemBuilder: (context, i) {
                            final c = items[i];
                            return CampaignCard(
                              key: ValueKey(c.id),
                              campaign: c,
                              subtitle: aprobar
                                  ? '${c.marketeroNombre ?? 'Tu agencia'} · ${fechaCorta(c.enviadoClienteAt ?? c.fechaCreacion)}'
                                  : c.destinos.isEmpty
                                      ? 'Sin publicación automática'
                                      : 'En ${c.destinos.map((d) => d.cuentaNombre).join(', ')}',
                              onTap: () => context.push('/c/revision/${c.id}'),
                            );
                          },
                        ),
                      ),
                    ],
              loading: () => [
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
                  sliver: SliverList.separated(
                    itemCount: 3,
                    separatorBuilder: (_, _) => const Divider(),
                    itemBuilder: (_, _) => const CampaignCardSkeleton(),
                  ),
                ),
              ],
              error: (e, _) => [
                SliverPadding(
                  padding: const EdgeInsets.all(Nexo.gutter),
                  sliver: SliverToBoxAdapter(child: ErrorBanner(message: toApiException(e).message, onRetry: _refrescar)),
                ),
              ],
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}
