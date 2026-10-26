import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../data/models.dart';
import '../../widgets/nexo_widgets.dart';
import 'providers.dart';
import '../../core/theme/tokens.dart';

final xVariantsProvider = FutureProvider.autoDispose
    .family<List<XVariant>, int>(
      (ref, campaignId) =>
          ref.watch(socialRepositoryProvider).xVariants(campaignId: campaignId),
    );

String etiquetaVariante(String estado) => switch (estado) {
  'borrador' => 'Borrador',
  'pendiente_cliente' => 'Esperando al cliente',
  'aprobada' => 'Aprobada por el cliente',
  'rechazada' => 'El cliente pidió cambios',
  _ => estado,
};

/// "Versión para X" de una campaña aprobada: texto corto (≤ 280 y sin
/// enlaces) que el cliente aprueba aparte. Si X está apagada no aparece.
class XVariantBlock extends ConsumerStatefulWidget {
  const XVariantBlock({super.key, required this.campana});
  final Campaign campana;

  @override
  ConsumerState<XVariantBlock> createState() => _XVariantBlockState();
}

class _XVariantBlockState extends ConsumerState<XVariantBlock> {
  final _texto = TextEditingController();
  bool _editando = false;
  bool _ocupado = false;

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  Future<void> _hacer(Future<void> Function() body, String ok) async {
    setState(() => _ocupado = true);
    try {
      await body();
      ref.invalidate(xVariantsProvider(widget.campana.id));
      if (mounted) {
        setState(() => _editando = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(xConfigProvider).value;
    if (config == null || !config.habilitado) return const SizedBox.shrink();
    final variantes = ref.watch(xVariantsProvider(widget.campana.id));
    final repo = ref.read(socialRepositoryProvider);
    final v = variantes.value?.where((v) => v.vigente).firstOrNull;
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: NexoCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const NetworkIcon('x', size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text('Versión para X', style: context.text.titleSmall),
                ),
                if (v != null)
                  Text(
                    etiquetaVariante(v.estado),
                    style: context.text.labelMedium,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (variantes.isLoading && v == null)
              const LinearProgressIndicator()
            else if (v == null) ...[
              Text(
                'X usa un texto corto propio (hasta 280 caracteres y sin enlaces). El cliente lo aprueba aparte.',
                style: context.text.bodySmall,
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _ocupado
                    ? null
                    : () => _hacer(
                        () => repo.createXVariant(widget.campana.id),
                        'Versión para X preparada.',
                      ),
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text('Preparar con IA'),
              ),
            ] else ...[
              AnimatedSize(
                duration: Motion.of(context, Motion.base),
                curve: Motion.easeOut,
                child: _editando
                    ? TextField(
                        controller: _texto,
                        minLines: 3,
                        maxLines: 6,
                        maxLength: v.limite,
                        decoration: const InputDecoration(
                          helperText: 'Editarla la devuelve a borrador.',
                        ),
                      )
                    : Text(v.texto, style: context.text.bodyMedium),
              ),
              if (v.estado == 'rechazada' && v.feedbackCliente.isNotEmpty) ...[
                const SizedBox(height: 8),
                InfoBanner(
                  message: 'El cliente pidió: «${v.feedbackCliente}»',
                  tone: InfoTone.warning,
                ),
              ],
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (!v.bloqueada && !_editando)
                    OutlinedButton(
                      onPressed: () => setState(() {
                        _texto.text = v.texto;
                        _editando = true;
                      }),
                      child: const Text('Editar'),
                    ),
                  if (_editando)
                    FilledButton(
                      onPressed: _ocupado
                          ? null
                          : () => _hacer(
                              () => repo.editXVariant(v.id, _texto.text.trim()),
                              'Texto guardado.',
                            ),
                      child: const Text('Guardar'),
                    ),
                  if (!_editando &&
                      (v.estado == 'borrador' || v.estado == 'rechazada'))
                    FilledButton(
                      onPressed: _ocupado
                          ? null
                          : () => _hacer(
                              () => repo.sendXVariant(v.id),
                              'Enviada al cliente para aprobar.',
                            ),
                      child: const Text('Enviar al cliente'),
                    ),
                ],
              ),
              if (v.estado == 'aprobada')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Aprobada. Publicar en X cuesta ~US\$${config.costoPostUsd ?? '0.015'} por post; se publica desde la web, donde se confirma el costo.',
                    style: context.text.bodySmall,
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
