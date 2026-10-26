import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/nexo_widgets.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/publication_widgets.dart';

final connectionsProvider = FutureProvider.autoDispose<List<SocialConnection>>(
  (ref) => ref.watch(socialRepositoryProvider).connections(),
);

/// El servidor actual no ofrece retorno OAuth nativo. Mostrar las conexiones
/// sin botones que parezcan autorizar o borrar credenciales desde la app.
class NetworksScreen extends ConsumerWidget {
  const NetworksScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connections = ref.watch(connectionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Redes conectadas')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(connectionsProvider);
          await ref.read(connectionsProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            const InfoBanner(
              message: 'Aquí puedes consultar tus cuentas conectadas. Para conectar, desconectar o publicar utiliza Configuración y Campañas en la web. Aprobar una campaña no la publica.',
            ),
            const SizedBox(height: 20),
            ...connections.when(
              loading: () => [const Skeleton(height: 80)],
              error: (error, _) => [
                ErrorBanner(
                  message: toApiException(error).message,
                  onRetry: () => ref.invalidate(connectionsProvider),
                ),
              ],
              data: (rows) => rows.isEmpty
                  ? [
                      const EmptyState(
                        icon: Icons.hub_outlined,
                        title: 'Aún no hay cuentas conectadas',
                        message:
                            'Puedes autorizarlas desde la web de NexoMark.',
                      ),
                    ]
                  : rows
                        .map(
                          (row) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: NetworkConnectionRow(
                              red: row.red,
                              titulo: row.cuentaNombre,
                              detalle:
                                  '${etiquetaRed[row.red] ?? row.red} · ${row.estado == 'vencida' ? 'sesión vencida; reconecta en la web' : 'conectada'}',
                              trailing: Text(
                                'Solo lectura',
                                style: context.text.bodySmall,
                              ),
                            ),
                          ),
                        )
                        .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
