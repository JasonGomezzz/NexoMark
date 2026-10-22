import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../account/avatar_provider.dart';
import 'providers.dart';

class MarketeroHomeScreen extends ConsumerWidget {
  const MarketeroHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final stats = ref.watch(campaignStatsProvider);
    final recientes = ref.watch(campaignListProvider);

    Future<void> refrescar() async {
      ref.invalidate(campaignStatsProvider);
      ref.invalidate(campaignListProvider);
      await ref.read(sessionProvider.notifier).refreshUser();
      try {
        await ref.read(campaignStatsProvider.future);
      } catch (_) {
        // El error ya se muestra en la tarjeta de métricas.
      }
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: refrescar,
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
                          Text('Esto es lo que pasa con tus campañas.', style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    Pressable(onTap: () => context.go('/m/cuenta'), child: const MyAvatar(size: 46)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Entrance(index: 1, child: _DictarAhora(onTap: () => context.go('/m/laboratorio'))),
              const SizedBox(height: 16),
              Entrance(
                index: 2,
                child: CreditsMeter(
                  disponibles: stats.value?.tokensDisponibles ?? user?.tokensDisponibles,
                  onRequest: () => context.push('/m/cuenta/creditos'),
                ),
              ),
              const SizedBox(height: 20),
              Entrance(
                index: 3,
                child: stats.when(
                  data: (s) => _Metricas(
                    total: s.total,
                    pendientes: s.pendienteAprobacion,
                    aprobadas: s.aprobado,
                    rechazadas: s.rechazado,
                  ),
                  loading: () => const _MetricasSkeleton(),
                  error: (e, _) => ErrorBanner(
                    message: toApiException(e).message,
                    onRetry: () => ref.invalidate(campaignStatsProvider),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SectionTitle(
                'Recientes',
                trailing: TextButton(onPressed: () => context.go('/m/proyectos'), child: const Text('Ver todas')),
              ),
              ...recientes.when(
                data: (lista) => lista.isEmpty
                    ? [
                        EmptyState(
                          icon: Icons.mic_none_rounded,
                          title: 'Aún no tienes campañas',
                          message: 'Dicta tu primera idea y la IA preparará el texto y la imagen.',
                          action: FilledButton(onPressed: () => context.go('/m/laboratorio'), child: const Text('Dictar una campaña')),
                        ),
                      ]
                    : [
                        for (final (i, c) in lista.take(4).indexed)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Entrance(
                              index: 4 + i,
                              child: CampaignCard(campaign: c, onTap: () => context.go('/m/proyectos/${c.id}', extra: c)),
                            ),
                          ),
                      ],
                loading: () => [
                  for (var i = 0; i < 3; i++)
                    const Padding(padding: EdgeInsets.only(bottom: 10), child: CampaignCardSkeleton()),
                ],
                error: (e, _) => [
                  ErrorBanner(message: toApiException(e).message, onRetry: () => ref.invalidate(campaignListProvider)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DictarAhora extends StatelessWidget {
  const _DictarAhora({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      haptic: true,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: context.colors.primaryFixed,
          borderRadius: BorderRadius.circular(Nexo.radiusPanel),
          border: Border.all(color: context.colors.primary.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: context.colors.primary, shape: BoxShape.circle),
              child: Icon(Icons.mic_rounded, color: context.colors.onPrimary, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dictar una campaña', style: context.text.titleMedium?.copyWith(color: context.colors.onPrimaryFixed)),
                  const SizedBox(height: 2),
                  Text(
                    'Cuéntale la idea; la IA propone los campos y tú confirmas.',
                    style: context.text.bodySmall?.copyWith(color: context.colors.onPrimaryFixed),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_rounded, color: context.colors.onPrimaryFixed),
          ],
        ),
      ),
    );
  }
}

class _Metricas extends StatelessWidget {
  const _Metricas({required this.total, required this.pendientes, required this.aprobadas, required this.rechazadas});

  final int total;
  final int pendientes;
  final int aprobadas;
  final int rechazadas;

  @override
  Widget build(BuildContext context) {
    // Filas de alto intrínseco (no una grilla de proporción fija): con letra
    // grande del sistema la tarjeta crece en vez de cortar el texto.
    Widget fila(List<Widget> tarjetas) => IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: tarjetas[0]), const SizedBox(width: 10), Expanded(child: tarjetas[1])],
          ),
        );
    return Column(
      children: [
        fila([
          MetricCard(label: 'Campañas', value: total, icon: Icons.folder_rounded, accent: context.colors.primary),
          MetricCard(label: 'Por aprobar', value: pendientes, icon: Icons.hourglass_top_rounded, accent: context.nexo.warning),
        ]),
        const SizedBox(height: 10),
        fila([
          MetricCard(label: 'Aprobadas', value: aprobadas, icon: Icons.check_circle_rounded, accent: context.nexo.success),
          MetricCard(label: 'Rechazadas', value: rechazadas, icon: Icons.cancel_rounded, accent: context.colors.error),
        ]),
      ],
    );
  }
}

class _MetricasSkeleton extends StatelessWidget {
  const _MetricasSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        Row(children: [
          Expanded(child: Skeleton(height: 104, radius: Nexo.radiusCard)),
          SizedBox(width: 10),
          Expanded(child: Skeleton(height: 104, radius: Nexo.radiusCard)),
        ]),
        SizedBox(height: 10),
        Row(children: [
          Expanded(child: Skeleton(height: 104, radius: Nexo.radiusCard)),
          SizedBox(width: 10),
          Expanded(child: Skeleton(height: 104, radius: Nexo.radiusCard)),
        ]),
      ],
    );
  }
}
