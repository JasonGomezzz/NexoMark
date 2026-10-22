import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../marketero/providers.dart' show xConfigProvider;
import '../marketero/x_variant_block.dart' show xVariantsProvider;
import 'client_home_screen.dart';

final _reviewProvider = FutureProvider.autoDispose.family<Campaign, int>(
  (ref, id) => ref.watch(clientRepositoryProvider).get(id),
);

class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key, required this.id});
  final int id;

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  int _valoracion = 0;
  bool _ocupado = false;
  bool _aprobada = false;

  Future<void> _decidir(Campaign c, {required bool aprobar, String? feedback}) async {
    setState(() => _ocupado = true);
    try {
      await ref.read(clientRepositoryProvider).decide(
            c.id,
            aprobar: aprobar,
            version: c.version,
            valoracion: _valoracion,
            feedback: feedback,
          );
      ref.invalidate(pendingProvider);
      ref.invalidate(decididasProvider);
      if (!mounted) return;
      if (aprobar) {
        HapticFeedback.heavyImpact();
        final pausa = Motion.reduced(context) ? const Duration(milliseconds: 500) : const Duration(milliseconds: 1400);
        setState(() => _aprobada = true);
        await Future<void>.delayed(pausa);
      } else {
        HapticFeedback.mediumImpact();
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(aprobar
            ? (c.destinos.isEmpty ? 'Campaña aprobada.' : 'Campaña aprobada. Se está publicando.')
            : 'Enviamos tus comentarios a la agencia.'),
      ));
      context.pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.status == 409 ? 'La campaña cambió mientras la revisabas. Vuelve a abrirla.' : e.message),
        ));
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _aprobar(Campaign c) async {
    final redes = c.destinos.map((d) => '${etiquetaRed[d.red] ?? d.red} (${d.cuentaNombre})').join(', ');
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(c.destinos.isEmpty ? '¿Aprobar la campaña?' : '¿Aprobar y publicar?'),
        content: Text(c.destinos.isEmpty
            ? 'Se aprueba la campaña. No tiene destinos de publicación automática.'
            : 'Se publicará exactamente este texto y esta imagen en: $redes.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Seguir revisando')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Aprobar')),
        ],
      ),
    );
    if (ok ?? false) await _decidir(c, aprobar: true);
  }

  Future<void> _rechazar(Campaign c) async {
    final feedback = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (_) => const _RechazoSheet(),
    );
    if (feedback != null) await _decidir(c, aprobar: false, feedback: feedback);
  }

  @override
  Widget build(BuildContext context) {
    final campana = ref.watch(_reviewProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Revisar campaña')),
      body: Stack(
        children: [
          campana.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Padding(
              padding: const EdgeInsets.all(16),
              child: ErrorBanner(message: toApiException(e).message, onRetry: () => ref.invalidate(_reviewProvider(widget.id))),
            ),
            data: (c) => _contenido(context, c),
          ),
          _Aprobada(visible: _aprobada),
        ],
      ),
    );
  }

  Widget _contenido(BuildContext context, Campaign c) {
    final pendiente = c.estado == EstadoCampana.pendienteAprobacion;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        AspectRatio(aspectRatio: 1, child: CampaignImage(campaign: c, radius: Nexo.radiusPanel)),
        const SizedBox(height: 16),
        Align(alignment: Alignment.centerLeft, child: StatePill(c.estado)),
        const SizedBox(height: 10),
        Text(c.titulo, style: context.text.headlineSmall),
        const SizedBox(height: 4),
        Text('Preparada por ${c.marketeroNombre ?? 'tu agencia'}', style: context.text.bodySmall),
        const SizedBox(height: 16),
        if (c.destinos.isNotEmpty) ...[
          Text(pendiente ? 'Se publicará en' : 'Destinos', style: context.text.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final d in c.destinos) NetworkChip(red: d.red, label: d.cuentaNombre)],
          ),
          const SizedBox(height: 16),
        ] else if (pendiente) ...[
          const InfoBanner(message: 'Esta campaña no tiene publicación automática: aprobarla no la publica.'),
          const SizedBox(height: 16),
        ],
        NexoCard(child: SelectableText(c.textoGenerado ?? 'Sin texto.', style: context.text.bodyLarge)),
        _VarianteXCliente(campaignId: c.id),
        if (pendiente) ...[
          const SizedBox(height: 24),
          Text('¿Qué te parece?', style: context.text.titleMedium),
          const SizedBox(height: 4),
          Text('Valórala de 1 a 5 para poder aprobar o rechazar.', style: context.text.bodySmall),
          const SizedBox(height: 10),
          _EstrellasInput(valor: _valoracion, onChanged: (v) => setState(() => _valoracion = v)),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _ocupado || _valoracion == 0 ? null : () => _rechazar(c),
                  child: const Text('Pedir cambios'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _ocupado || _valoracion == 0 ? null : () => _aprobar(c),
                  icon: const Icon(Icons.check_rounded),
                  label: const Text('Aprobar'),
                ),
              ),
            ],
          ),
        ] else if (c.estado == EstadoCampana.rechazado && (c.feedbackRechazo?.isNotEmpty ?? false)) ...[
          const SizedBox(height: 16),
          InfoBanner(message: 'Pediste: «${c.feedbackRechazo}»', tone: InfoTone.warning),
        ],
      ],
    );
  }
}

/// Estrellas. Al elegir, las estrellas encendidas crecen de 0.8 a 1 con un
/// leve sobrepaso (easeOutBack, ~10 %): acción poco frecuente, se siente viva
/// sin rebotar de más.
class _EstrellasInput extends StatelessWidget {
  const _EstrellasInput({required this.valor, required this.onChanged});

  final int valor;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 1; i <= 5; i++)
          Semantics(
            button: true,
            selected: i <= valor,
            label: '$i de 5 estrellas',
            child: Pressable(
              haptic: true,
              scale: 0.9,
              onTap: () => onChanged(i),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: TweenAnimationBuilder<double>(
                  key: ValueKey('$i-${i <= valor}'),
                  tween: Tween(begin: i <= valor && !Motion.reduced(context) ? 0.8 : 1, end: 1),
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOutBack,
                  builder: (context, s, child) => Transform.scale(scale: s, child: child),
                  child: Icon(
                    i <= valor ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 42,
                    color: i <= valor ? context.nexo.warning : context.colors.outline,
                  ),
                ),
              ),
            ),
          ),
        const SizedBox(width: 8),
        Text(valor == 0 ? '' : '$valor/5', style: context.text.titleMedium),
      ],
    );
  }
}

class _RechazoSheet extends StatefulWidget {
  const _RechazoSheet();

  @override
  State<_RechazoSheet> createState() => _RechazoSheetState();
}

class _RechazoSheetState extends State<_RechazoSheet> {
  final _motivo = TextEditingController();
  static const _minimo = 10;

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final largo = _motivo.text.trim().length;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('¿Qué hay que cambiar?', style: context.text.titleLarge),
          const SizedBox(height: 6),
          Text(
            'La agencia lo verá para preparar otra versión. Un segundo rechazo cierra la campaña.',
            style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _motivo,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            maxLength: 1000,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Por ejemplo: la imagen debe mostrar el local, no solo la taza.',
              counterText: largo < _minimo ? 'Faltan ${_minimo - largo} caracteres' : '$largo caracteres',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: largo < _minimo ? null : () => Navigator.pop(context, _motivo.text.trim()),
            child: const Text('Enviar comentarios'),
          ),
        ],
      ),
    );
  }
}

/// Celebración de aprobar: un check que se dibuja sobre marino. Es el momento
/// más importante para el cliente y ocurre pocas veces, así que se permite.
class _Aprobada extends StatelessWidget {
  const _Aprobada({required this.visible});
  final bool visible;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: Motion.of(context, Motion.base),
        child: Container(
          color: Nexo.navy.withValues(alpha: 0.94),
          alignment: Alignment.center,
          child: visible
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: Motion.reduced(context) ? 1 : 0, end: 1),
                      duration: const Duration(milliseconds: 600),
                      curve: Motion.easeOut,
                      builder: (context, t, _) => CustomPaint(size: const Size(96, 96), painter: _CheckPainter(t)),
                    ),
                    const SizedBox(height: 18),
                    Text('¡Aprobada!', style: context.text.headlineSmall?.copyWith(color: Nexo.onNavy)),
                  ],
                )
              : null,
        ),
      ),
    );
  }
}

class _CheckPainter extends CustomPainter {
  _CheckPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final circulo = Paint()
      ..color = Nexo.turquoise
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    final rect = Offset.zero & size;
    canvas.drawArc(rect.deflate(4), -1.5708, 6.2832 * (t * 1.4).clamp(0.0, 1.0), false, circulo);
    final path = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.44, size.height * 0.68)
      ..lineTo(size.width * 0.74, size.height * 0.36);
    final avance = ((t - 0.45) / 0.55).clamp(0.0, 1.0);
    for (final metric in path.computeMetrics()) {
      canvas.drawPath(metric.extractPath(0, metric.length * avance), circulo..color = Nexo.onNavy);
    }
  }

  @override
  bool shouldRepaint(covariant _CheckPainter old) => old.t != t;
}

/// Si la agencia preparó una versión corta para X, el cliente la aprueba aquí.
class _VarianteXCliente extends ConsumerStatefulWidget {
  const _VarianteXCliente({required this.campaignId});
  final int campaignId;

  @override
  ConsumerState<_VarianteXCliente> createState() => _VarianteXClienteState();
}

class _VarianteXClienteState extends ConsumerState<_VarianteXCliente> {
  bool _ocupado = false;

  Future<void> _hacer(Future<void> Function() body, String ok) async {
    setState(() => _ocupado = true);
    try {
      await body();
      ref.invalidate(xVariantsProvider(widget.campaignId));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!(ref.watch(xConfigProvider).value?.habilitado ?? false)) return const SizedBox.shrink();
    final v = ref
        .watch(xVariantsProvider(widget.campaignId))
        .value
        ?.where((v) => v.estado == 'pendiente_cliente' || v.estado == 'aprobada')
        .firstOrNull;
    if (v == null) return const SizedBox.shrink();
    final repo = ref.read(socialRepositoryProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: NexoCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const NetworkIcon('x', size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text('Versión corta para X', style: context.text.titleSmall)),
                Text('${v.longitud}/${v.limite}', style: context.text.labelMedium),
              ],
            ),
            const SizedBox(height: 8),
            Text(v.texto, style: context.text.bodyMedium),
            const SizedBox(height: 10),
            if (v.estado == 'aprobada')
              const InfoBanner(message: 'Ya la aprobaste.', tone: InfoTone.success)
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _ocupado
                          ? null
                          : () async {
                              final motivo = await showModalBottomSheet<String>(
                                context: context,
                                useRootNavigator: true,
                                isScrollControlled: true,
                                builder: (_) => const _RechazoSheet(),
                              );
                              if (motivo != null) await _hacer(() => repo.rejectXVariant(v.id, motivo), 'Comentarios enviados.');
                            },
                      child: const Text('Pedir cambios'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: _ocupado || v.hashTexto == null
                          ? null
                          : () => _hacer(() => repo.approveXVariant(v.id, v.hashTexto!), 'Versión para X aprobada.'),
                      child: const Text('Aprobar'),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
