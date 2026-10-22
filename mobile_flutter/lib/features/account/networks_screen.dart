import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../../widgets/publication_widgets.dart';
import '../marketero/providers.dart' show tiktokConfigProvider, xConfigProvider;
import '../../core/theme/tokens.dart';

final connectionsProvider = FutureProvider.autoDispose<List<SocialConnection>>(
  (ref) => ref.watch(socialRepositoryProvider).connections(),
);

const _errores = {
  'cancelado': 'Cancelaste la autorización. No se conectó nada.',
  'sesion': 'La conexión venció (dura 10 minutos). Vuelve a intentarlo.',
  'sin_codigo': 'La red no devolvió la autorización. Vuelve a intentarlo.',
  'desactivado': 'Esta red está desactivada en el servidor.',
};

/// Redes conectadas. La conexión se abre en el navegador del sistema
/// (ASWebAuthenticationSession en iOS, Custom Tabs en Android): NexoMark nunca
/// ve tu contraseña de la red. Django devuelve el control por nexomark:// y la
/// app termina el canje con su sesión.
class NetworksScreen extends ConsumerStatefulWidget {
  const NetworksScreen({super.key});

  @override
  ConsumerState<NetworksScreen> createState() => _NetworksScreenState();
}

class _NetworksScreenState extends ConsumerState<NetworksScreen> {
  String? _conectando;

  void _aviso(String m) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(m)));

  Future<void> _conectar(String proveedor) async {
    setState(() => _conectando = proveedor);
    final repo = ref.read(socialRepositoryProvider);
    try {
      final url = await repo.connectUrl(proveedor);
      final retorno = await FlutterWebAuth2.authenticate(url: url, callbackUrlScheme: AppConfig.oauthScheme);
      final datos = Uri.splitQueryString(Uri.parse(retorno).fragment);
      final error = datos['error'];
      if (error != null) {
        _aviso(_errores[error] ?? 'No se pudo conectar la cuenta.');
        return;
      }
      final mensaje = await repo.complete(proveedor, datos['code'] ?? '', datos['state'] ?? '');
      HapticFeedback.mediumImpact();
      ref.invalidate(connectionsProvider);
      _aviso(mensaje);
    } on PlatformException catch (e) {
      // CANCELED: la persona cerró la ventana del navegador.
      if (e.code != 'CANCELED') _aviso('No se pudo abrir el navegador para conectar.');
    } on ApiException catch (e) {
      _aviso(e.message);
    } finally {
      if (mounted) setState(() => _conectando = null);
    }
  }

  Future<void> _desconectar(SocialConnection c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿Desconectar ${c.cuentaNombre}?'),
        content: Text(
          'NexoMark dejará de publicar ahí y borra su token. Esto no revoca el permiso en ${etiquetaRed[c.red]}: si quieres, quítalo también en la configuración de esa red.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: context.colors.error, foregroundColor: context.colors.onError),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Desconectar'),
          ),
        ],
      ),
    );
    if (!(ok ?? false)) return;
    try {
      await ref.read(socialRepositoryProvider).disconnect(c.id);
      ref.invalidate(connectionsProvider);
      _aviso('${c.cuentaNombre} desconectada.');
    } on ApiException catch (e) {
      _aviso(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conexiones = ref.watch(connectionsProvider);
    final xActivo = ref.watch(xConfigProvider).value?.habilitado ?? false;
    final tiktok = ref.watch(tiktokConfigProvider).value?.configurado ?? false;
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Redes conectadas')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(connectionsProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                user?.rol == Rol.cliente
                    ? 'Autoriza tus cuentas para que la agencia pueda publicar lo que apruebes. Solo se publica lo que tú apruebas.'
                    : 'Conecta las cuentas que administras. Las de tus clientes conviene que las conecte su dueño desde su propia cuenta.',
                style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              _Conectar(
                redes: const ['instagram', 'facebook'],
                titulo: 'Instagram y Facebook',
                detalle: 'Un solo inicio de sesión de Meta. Instagram debe ser profesional y estar vinculada a una página.',
                cargando: _conectando == 'meta',
                onTap: _conectando == null ? () => _conectar('meta') : null,
              ),
              if (tiktok) ...[
                const SizedBox(height: 10),
                _Conectar(
                  redes: const ['tiktok'],
                  titulo: 'TikTok',
                  detalle: 'Recibes las campañas aprobadas en tu buzón de TikTok y terminas de publicarlas allí.',
                  cargando: _conectando == 'tiktok',
                  onTap: _conectando == null ? () => _conectar('tiktok') : null,
                ),
              ],
              if (xActivo) ...[
                const SizedBox(height: 10),
                _Conectar(
                  redes: const ['x'],
                  titulo: 'X',
                  detalle: 'Opcional. Publicar en X tiene costo por post.',
                  cargando: _conectando == 'x',
                  onTap: _conectando == null ? () => _conectar('x') : null,
                ),
              ],
              const SizedBox(height: 24),
              const SectionTitle('Tus cuentas'),
              ...conexiones.when(
                loading: () => [const Skeleton(height: 64), const SizedBox(height: 8), const Skeleton(height: 64)],
                error: (e, _) => [ErrorBanner(message: toApiException(e).message, onRetry: () => ref.invalidate(connectionsProvider))],
                data: (lista) {
                  final visibles = lista.where((c) => c.estado == 'activa' && (xActivo || c.red != 'x')).toList();
                  if (visibles.isEmpty) {
                    return [
                      const EmptyState(
                        icon: Icons.hub_outlined,
                        title: 'Aún no hay cuentas conectadas',
                        message: 'Conecta Instagram y Facebook con el botón de arriba.',
                      ),
                    ];
                  }
                  return [
                    for (final (i, c) in visibles.indexed)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Entrance(
                          index: i,
                          child: NetworkConnectionRow(
                            red: c.red,
                            titulo: c.cuentaNombre,
                            detalle: c.red == 'tiktok' ? 'TikTok · nombre visible (TikTok no comparte el @usuario)' : '${etiquetaRed[c.red]} · conectada',
                            trailing: TextButton(onPressed: () => _desconectar(c), child: const Text('Desconectar')),
                          ),
                        ),
                      ),
                  ];
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Conectar extends StatelessWidget {
  const _Conectar({required this.redes, required this.titulo, required this.detalle, required this.cargando, this.onTap});

  final List<String> redes;
  final String titulo;
  final String detalle;
  final bool cargando;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return NexoCard(
      onTap: onTap,
      child: Row(
        children: [
          SizedBox(
            width: 52,
            height: 34,
            child: Stack(
              children: [
                for (final (i, red) in redes.indexed)
                  Positioned(left: i * 20.0, child: NetworkIcon(red, size: 32)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Conectar $titulo', style: context.text.titleSmall),
                Text(detalle, style: context.text.bodySmall),
              ],
            ),
          ),
          cargando
              ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
              : Icon(Icons.open_in_new_rounded, color: context.colors.primary),
        ],
      ),
    );
  }
}
