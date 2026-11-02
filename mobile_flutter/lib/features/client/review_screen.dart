import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
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
import '../../widgets/conforme.dart';
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
        await mostrarAprobada(context, c);
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
    final ok = await confirmarAccion(
      context,
      titulo: c.destinos.isEmpty ? '¿Aprobar la campaña?' : '¿Aprobar y publicar?',
      mensaje: c.destinos.isEmpty
          ? 'Se aprueba la campaña. No tiene destinos de publicación automática.'
          : 'Se publicará exactamente este texto y esta imagen en: $redes.',
      accion: 'Aprobar',
      cancelar: 'Seguir revisando',
    );
    if (ok) await _decidir(c, aprobar: true);
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
    return MesaScaffold(
      appBar: AppBar(title: const Text('Revisar campaña')),
      body: campana.when(
        loading: () => const Center(child: CircularProgressIndicator.adaptive()),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorBanner(message: toApiException(e).message, onRetry: () => ref.invalidate(_reviewProvider(widget.id))),
        ),
        data: (c) => _contenido(context, c),
      ),
      // Decidir queda fijo en la zona del pulgar mientras se lee la campaña.
      bottomNavigationBar: switch (campana.value) {
        final c? when c.estado == EstadoCampana.pendienteAprobacion => _BarraDecision(
            valoracion: _valoracion,
            ocupado: _ocupado,
            onValorar: (v) => setState(() => _valoracion = v),
            onPedirCambios: () => _rechazar(c),
            onAprobar: () => _aprobar(c),
          ),
        _ => null,
      },
    );
  }

  Widget _contenido(BuildContext context, Campaign c) {
    final pendiente = c.estado == EstadoCampana.pendienteAprobacion;
    return ListView(
      padding: const EdgeInsets.fromLTRB(Nexo.gutter, 4, Nexo.gutter, 32),
      children: [
        AspectRatio(aspectRatio: 1, child: CampaignImage(campaign: c, radius: Nexo.radiusSurface)),
        const SizedBox(height: 16),
        Align(alignment: Alignment.centerLeft, child: StatePill(c.estado)),
        const SizedBox(height: 10),
        Text(c.titulo, style: context.text.headlineSmall),
        const SizedBox(height: 4),
        Text('Preparada por ${c.marketeroNombre ?? 'tu agencia'}', style: context.text.bodySmall),
        const SizedBox(height: 16),
        if (c.destinos.isNotEmpty) ...[
          Text(pendiente ? 'Se publicará en' : 'Destinos', style: context.text.titleSmall),
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
          const SizedBox(height: 8),
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
      mainAxisSize: MainAxisSize.min,
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
                padding: const EdgeInsets.all(5),
                child: TweenAnimationBuilder<double>(
                  key: ValueKey('$i-${i <= valor}'),
                  tween: Tween(begin: i <= valor && !Motion.reduced(context) ? 0.8 : 1, end: 1),
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOutBack,
                  builder: (context, s, child) => Transform.scale(scale: s, child: child),
                  child: Icon(
                    i <= valor ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 34,
                    color: i <= valor ? context.nexo.warning : context.colors.outline,
                  ),
                ),
              ),
            ),
          ),
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

/// Barra de decisión: valoración y las dos salidas, siempre a mano.
class _BarraDecision extends StatelessWidget {
  const _BarraDecision({
    required this.valoracion,
    required this.ocupado,
    required this.onValorar,
    required this.onPedirCambios,
    required this.onAprobar,
  });

  final int valoracion;
  final bool ocupado;
  final ValueChanged<int> onValorar;
  final VoidCallback onPedirCambios;
  final VoidCallback onAprobar;

  @override
  Widget build(BuildContext context) {
    final listo = valoracion > 0 && !ocupado;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.nexo.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 8, Nexo.gutter, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      valoracion == 0 ? 'Valórala para decidir' : 'Tu valoración: $valoracion de 5',
                      style: context.text.titleSmall,
                    ),
                  ),
                  _EstrellasInput(valor: valoracion, onChanged: onValorar),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(onPressed: listo ? onPedirCambios : null, child: const Text('Pedir cambios')),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: listo ? onAprobar : null,
                      icon: const Icon(LucideIcons.check, size: 18),
                      label: const Text('Aprobar'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Momento firma del cliente: el sello «conforme» cae sobre la mesa (de 0.96
/// a 1, con opacidad) y dentro las dos piezas de la N encajan: la clara (quien
/// creó la campaña) ya está; la turquesa (quien aprueba) entra por la
/// diagonal. Todo en 420 ms, una vez. El háptico suena al encajar, en el mismo
/// cuadro. Con "reducir movimiento" el sello ya está puesto y solo se funde.
Future<void> mostrarAprobada(BuildContext context, Campaign c) {
  final destino = c.destinos.isEmpty
      ? 'Sin publicación automática.'
      : 'Se publica en ${c.destinos.map((d) => d.cuentaNombre).join(', ')}.';
  return showGeneralDialog<void>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: false,
    barrierColor: Colors.transparent,
    transitionDuration: Motion.of(context, Motion.base),
    pageBuilder: (_, _, _) => _Aprobada(destino: destino),
    transitionBuilder: (_, a, _, child) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Motion.easeOut), child: child),
  );
}

class _Aprobada extends StatefulWidget {
  const _Aprobada({required this.destino});
  final String destino;

  @override
  State<_Aprobada> createState() => _AprobadaState();
}

class _AprobadaState extends State<_Aprobada> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.signature);
  late final Animation<double> _teal = Tween(begin: 1.0, end: 0.0).animate(CurvedAnimation(parent: _c, curve: Motion.easeOut));
  late final Animation<double> _texto = CurvedAnimation(parent: _c, curve: const Interval(0.5, 1, curve: Motion.easeOut));
  late final Animation<double> _cae = CurvedAnimation(parent: _c, curve: const Interval(0, 0.55, curve: Motion.easeOut));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final reducido = Motion.reduced(context);
      // Empieza tras el fundido de entrada, para que el encaje se vea entero.
      await Future<void>.delayed(reducido ? Duration.zero : Motion.base);
      if (!mounted) return;
      if (reducido) {
        _c.value = 1;
      } else {
        await _c.forward();
      }
      HapticFeedback.heavyImpact();
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Material(
        color: context.nexo.cama,
        child: Semantics(
          liveRegion: true,
          label: 'Campaña aprobada. ${widget.destino}',
          excludeSemantics: true,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FadeTransition(
                  opacity: _cae,
                  child: ScaleTransition(
                    scale: Tween(begin: 0.96, end: 1.0).animate(_cae),
                    child: Sello(size: 176, encaje: _teal, sobreMesa: true),
                  ),
                ),
                const SizedBox(height: 22),
                FadeTransition(
                  opacity: _texto,
                  child: SlideTransition(
                    position: Tween(begin: const Offset(0, 0.15), end: Offset.zero).animate(_texto),
                    child: Column(
                      children: [
                        Text('Conforme', style: context.text.displaySmall?.copyWith(color: Nexo.onNavy)),
                        const SizedBox(height: 4),
                        Text('Aprobaste esta versión.', style: context.text.titleMedium?.copyWith(color: Nexo.onNavy)),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            widget.destino,
                            textAlign: TextAlign.center,
                            style: context.text.bodyLarge?.copyWith(color: Nexo.onNavyMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
