import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import 'providers.dart';

final _tiktokCuentasProvider = FutureProvider.autoDispose.family<List<SocialConnection>, int>(
  (ref, campaignId) => ref.watch(socialRepositoryProvider).tiktokDestinos(campaignId),
);

/// Envío de una campaña aprobada al buzón de TikTok. Va aparte de los
/// destinos automáticos: TikTok no publica solo; la persona dueña de la
/// cuenta termina de publicar en la app de TikTok. Si el servidor no tiene
/// TikTok configurado, no se muestra nada.
class TikTokBlock extends ConsumerStatefulWidget {
  const TikTokBlock({super.key, required this.campana});
  final Campaign campana;

  @override
  ConsumerState<TikTokBlock> createState() => _TikTokBlockState();
}

class _TikTokBlockState extends ConsumerState<TikTokBlock> {
  int? _elegida;
  bool _ocupado = false;

  void _aviso(String m) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(m)));

  Future<void> _enviar(SocialConnection cuenta) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (_) => _ConfirmarSheet(campana: widget.campana, cuenta: cuenta),
    );
    if (ok != true) return;
    setState(() => _ocupado = true);
    try {
      final r = await ref.read(socialRepositoryProvider).tiktokEnviar(widget.campana.id, cuenta.id);
      HapticFeedback.mediumImpact();
      ref.invalidate(campaignPublicationsProvider(widget.campana.id));
      _aviso(r.mensaje);
    } on ApiException catch (e) {
      _aviso(e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(tiktokConfigProvider).value;
    if (config == null || !config.configurado) return const SizedBox.shrink();
    final cuentas = ref.watch(_tiktokCuentasProvider(widget.campana.id));
    final enviadas = (ref.watch(campaignPublicationsProvider(widget.campana.id)).value ?? const [])
        .where((p) => p.red == 'tiktok')
        .map((p) => p.cuentaNombre)
        .toSet();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: NexoCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const NetworkIcon('tiktok', size: 22),
                const SizedBox(width: 10),
                Expanded(child: Text('Enviar a TikTok', style: context.text.titleSmall)),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'TikTok no publica solo: la foto y el texto llegan al buzón de la cuenta y su dueño termina de publicar en la app de TikTok.',
              style: context.text.bodySmall,
            ),
            if (!config.mediosVerificados) ...[
              const SizedBox(height: 10),
              const InfoBanner(
                tone: InfoTone.warning,
                message: 'Falta verificar en el portal de TikTok el dominio desde donde descarga la imagen. Hasta entonces no se puede enviar.',
              ),
            ],
            const SizedBox(height: 10),
            cuentas.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text(toApiException(e).message, style: context.text.bodySmall),
              data: (lista) => lista.isEmpty
                  ? Text(
                      'Ni tú ni el cliente conectaron una cuenta de TikTok (Cuenta → Redes conectadas).',
                      style: context.text.bodySmall,
                    )
                  : Column(
                      children: [
                        for (final c in lista)
                          AnimatedContainer(
                            duration: Motion.of(context, Motion.fast),
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: _elegida == c.id ? context.colors.primaryFixed : context.colors.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(Nexo.radiusButton),
                            ),
                            child: ListTile(
                              onTap: () => setState(() => _elegida = c.id),
                              leading: const NetworkIcon('tiktok', size: 26),
                              title: Text(c.cuentaNombre, style: context.text.titleSmall),
                              subtitle: Text(
                                enviadas.contains(c.cuentaNombre)
                                    ? 'Ya enviada a esta cuenta'
                                    : c.propietarioRol == 'cliente'
                                        ? 'Cuenta del cliente'
                                        : 'Tu cuenta',
                                style: context.text.bodySmall,
                              ),
                              trailing: FilledButton(
                                onPressed: _ocupado || !config.mediosVerificados || enviadas.contains(c.cuentaNombre)
                                    ? null
                                    : () => _enviar(c),
                                child: const Text('Enviar'),
                              ),
                            ),
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

class _ConfirmarSheet extends StatelessWidget {
  const _ConfirmarSheet({required this.campana, required this.cuenta});
  final Campaign campana;
  final SocialConnection cuenta;

  @override
  Widget build(BuildContext context) {
    final texto = campana.textoGenerado ?? '';
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Text('Enviar a ${cuenta.cuentaNombre}', style: context.text.titleLarge),
          const SizedBox(height: 6),
          Text(
            'Se envía exactamente esta imagen y este texto. No se recorta ni se reenvía.',
            style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          AspectRatio(aspectRatio: 1, child: CampaignImage(campaign: campana, hero: false)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: context.nexo.warningContainer, borderRadius: BorderRadius.circular(99)),
            child: Text('Contenido generado con IA', style: context.text.labelMedium?.copyWith(color: context.nexo.warning)),
          ),
          const SizedBox(height: 10),
          NexoCard(child: Text(texto, style: context.text.bodyMedium)),
          const SizedBox(height: 6),
          Text('${texto.length} de 4000 caracteres', style: context.text.bodySmall),
          const SizedBox(height: 16),
          const InfoBanner(
            message: 'Después: abre la app de TikTok con esa cuenta, revisa el borrador en la bandeja de entrada, '
                'agrega música si quieres y publícalo.',
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.send_rounded),
            label: const Text('Enviar al buzón de TikTok'),
          ),
        ],
      ),
    );
  }
}
