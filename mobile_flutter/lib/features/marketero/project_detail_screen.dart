import 'dart:async';

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
import '../../widgets/publication_widgets.dart';
import 'lab_screen.dart' show industrias, tonos;
import 'providers.dart';
import 'tiktok_block.dart';
import 'x_variant_block.dart';

class ProjectDetailScreen extends ConsumerStatefulWidget {
  const ProjectDetailScreen({super.key, required this.id, this.inicial});

  final int id;

  /// La campaña de la lista (sin base64): se muestra mientras llega la completa.
  final Campaign? inicial;

  @override
  ConsumerState<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen> {
  Timer? _sondeo;
  bool _ocupado = false;

  /// El copy tiene cambios sin guardar: no se envía hasta guardarlos o cancelarlos.
  bool _editandoCopy = false;

  /// Tope de la espera (60 consultas cada 3 s = 3 min); después se deja de preguntar.
  static const _maxConsultas = 60;
  bool _esperaAgotada = false;

  /// Cuándo se pidió la generación desde esta pantalla (para el reloj de espera).
  DateTime? _generandoDesde;

  @override
  void dispose() {
    _sondeo?.cancel();
    super.dispose();
  }

  /// Mientras la IA genera (o se publica) se vuelve a pedir cada 3 s.
  void _vigilar(Campaign c, List<Publication> pubs) {
    final esperando = c.estado == EstadoCampana.pendienteIa || pubs.any((p) => p.estado == 'publicando');
    if (esperando && _sondeo == null && !_esperaAgotada) {
      var consultas = 0;
      _sondeo = Timer.periodic(const Duration(seconds: 3), (timer) {
        if (++consultas > _maxConsultas) {
          timer.cancel();
          if (mounted) setState(() => _esperaAgotada = true);
          return;
        }
        ref.invalidate(campaignProvider(widget.id));
        ref.invalidate(campaignPublicationsProvider(widget.id));
      });
    } else if (!esperando && _esperaAgotada) {
      _esperaAgotada = false;
      _sondeo = null;
    } else if (!esperando && _sondeo != null) {
      _sondeo!.cancel();
      _sondeo = null;
      HapticFeedback.mediumImpact();
      ref.invalidate(campaignListProvider);
    }
  }

  void _reconsultar() {
    _sondeo?.cancel();
    setState(() {
      _sondeo = null;
      _esperaAgotada = false;
    });
    ref.invalidate(campaignProvider(widget.id));
    ref.invalidate(campaignPublicationsProvider(widget.id));
  }

  void _aviso(String mensaje) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(mensaje)));
  }

  /// Corre una acción del detalle; devuelve si salió bien.
  Future<bool> _accion(Future<String?> Function() body) async {
    if (_ocupado) return false;
    setState(() => _ocupado = true);
    try {
      final mensaje = await body();
      ref.invalidate(campaignProvider(widget.id));
      ref.invalidate(campaignPublicationsProvider(widget.id));
      ref.invalidate(campaignListProvider);
      ref.invalidate(campaignStatsProvider);
      if (mensaje != null) _aviso(mensaje);
      return true;
    } on ApiException catch (e) {
      _aviso(e.status == 402 ? 'No te quedan créditos. Solicita más desde Cuenta.' : e.message);
      return false;
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final campana = ref.watch(campaignProvider(widget.id));
    final pubs = ref.watch(campaignPublicationsProvider(widget.id));
    final c = campana.value ?? widget.inicial;
    if (campana.value != null) _vigilar(campana.value!, pubs.value ?? const []);
    return MesaScaffold(
      appBar: AppBar(
        title: Text(c?.titulo ?? 'Proyecto', overflow: TextOverflow.ellipsis),
        actions: [
          if (c != null && c.estado == EstadoCampana.borrador)
            IconButton(
              tooltip: 'Eliminar borrador',
              icon: const Icon(LucideIcons.trash2),
              onPressed: () => _eliminar(c),
            ),
        ],
      ),
      body: Llegada(
        child: campana.when(
          loading: () => widget.inicial == null ? const _DetalleSkeleton() : _cuerpo(context, widget.inicial!, pubs),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: ErrorBanner(
              message: toApiException(e).message,
              onRetry: () => ref.invalidate(campaignProvider(widget.id)),
            ),
          ),
          data: (c) => _cuerpo(context, c, pubs),
        ),
      ),
      // La acción principal va fija abajo, en la zona del pulgar.
      bottomNavigationBar: c != null && c.estado == EstadoCampana.generado
          ? DecoratedBox(
              decoration: BoxDecoration(
                color: context.colors.surface,
                border: Border(top: BorderSide(color: context.nexo.hairline)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(Nexo.gutter, 12, Nexo.gutter, 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_editandoCopy)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Guarda o cancela el texto antes de enviar: el cliente aprueba lo que está guardado.',
                            style: context.text.bodySmall,
                          ),
                        ),
                      FilledButton.icon(
                        onPressed: _ocupado || _editandoCopy ? null : () => _enviar(c),
                        icon: const Icon(LucideIcons.send, size: 18),
                        label: const Text('Enviar al cliente'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _cuerpo(BuildContext context, Campaign c, AsyncValue<List<Publication>> pubs) {
    return RefreshIndicator.adaptive(
          onRefresh: () async {
            ref.invalidate(campaignPublicationsProvider(widget.id));
            ref.invalidate(campaignProvider(widget.id));
            await ref.read(campaignProvider(widget.id).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: PiezaConSello(
                  sellada: c.estado == EstadoCampana.aprobado,
                  version: (pubs.value ?? const []).map((p) => p.versionAprobada).whereType<int>().firstOrNull,
                  child: CampaignImage(campaign: c, radius: Nexo.radiusSurface),
                ),
              ),
              const SizedBox(height: 16),
              Align(alignment: Alignment.centerLeft, child: StatePill(c.estado)),
              const SizedBox(height: 10),
              Text(c.titulo, style: context.text.headlineSmall),
              const SizedBox(height: 2),
              Text('${c.clienteNombre} · ${c.clienteEmail}', style: context.text.bodySmall),
              const SizedBox(height: 16),
              FlowStepper(current: pasoDeEstado(c.estado, publicada: (pubs.value ?? const []).any((p) => p.estado == 'publicado'))),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (c.plataforma.isNotEmpty) NetworkChip(red: c.plataforma),
                  if (c.tono.isNotEmpty) _Dato(LucideIcons.audioLines, tonos[c.tono] ?? c.tono),
                  if (c.industria.isNotEmpty) _Dato(LucideIcons.store, industrias[c.industria] ?? c.industria),
                ],
              ),
              if (c.estado == EstadoCampana.rechazado && (c.feedbackRechazo?.isNotEmpty ?? false)) ...[
                const SizedBox(height: 16),
                _Rechazo(campana: c, ocupado: _ocupado, onRegenerar: () => _ajustarYRegenerar(c)),
              ],
              if (c.estado == EstadoCampana.borrador && c.iaErrorMessage != null) ...[
                const SizedBox(height: 16),
                InfoBanner(tone: InfoTone.warning, message: '${c.iaErrorMessage} Se devolvió el crédito.'),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: _ocupado ? null : () => _regenerar(c),
                  icon: const Icon(LucideIcons.refreshCw),
                  label: const Text('Regenerar · 1 crédito'),
                ),
              ],
              if (_esperaAgotada) ...[
                const SizedBox(height: 16),
                InfoBanner(
                  tone: InfoTone.warning,
                  message: c.estado == EstadoCampana.pendienteIa
                      ? 'La IA está tardando más de lo normal. Dejamos de consultar para no gastar batería.'
                      : 'La publicación está tardando más de lo normal. Dejamos de consultar para no gastar batería.',
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _reconsultar,
                  icon: const Icon(LucideIcons.refreshCw, size: 18),
                  label: const Text('Volver a consultar'),
                ),
              ],
              const SizedBox(height: 20),
              _Copy(
                campana: c,
                generandoDesde: _generandoDesde,
                ocupado: _ocupado,
                onAccion: _accion,
                onEditando: (v) => setState(() => _editandoCopy = v),
              ),
              if (c.estado == EstadoCampana.pendienteAprobacion) ...[
                const SizedBox(height: 16),
                InfoBanner(
                  icon: LucideIcons.hourglass,
                  message: avisoEnvio(c.clienteNombre, pubs),
                ),
              ],
              const SizedBox(height: 24),
              _Versiones(campana: c, onAccion: _accion),
              if (c.estado == EstadoCampana.aprobado) ...[
                const SizedBox(height: 24),
                XVariantBlock(campana: c),
                TikTokBlock(campana: c),
              ],
              const SizedBox(height: 24),
              SectionTitle('Publicaciones', subtitle: 'Aprobada → publicada → medida'),
              pubs.when(
                data: (lista) => lista.isEmpty
                    ? Text(
                        c.estado == EstadoCampana.aprobado
                            ? 'No hubo destinos automáticos para esta campaña.'
                            : 'Se crean al enviar la campaña con destinos.',
                        style: context.text.bodySmall,
                      )
                    : Column(
                        children: [
                          for (final (i, p) in lista.indexed)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Entrance(
                                index: i,
                                child: PublicationTile(
                                  publicacion: p,
                                  onConsultar: p.red == 'tiktok' && (p.estado == 'publicando' || p.estado == 'en_buzon')
                                      ? () => _accion(() async {
                                            final r = await ref.read(socialRepositoryProvider).tiktokEstado(p.id);
                                            return r.mensaje;
                                          })
                                      : null,
                                  onReintentar: p.estado == 'fallido' && p.red != 'tiktok' && p.red != 'x'
                                      ? () => _accion(() async {
                                            await ref.read(socialRepositoryProvider).publish(p.id);
                                            return 'Publicando de nuevo…';
                                          })
                                      : null,
                                ),
                              ),
                            ),
                        ],
                      ),
                loading: () => const Skeleton(height: 72, radius: Nexo.radiusSurface),
                error: (e, _) => ErrorBanner(message: toApiException(e).message),
              ),
            ],
          ),
        );
  }

  Future<void> _regenerar(Campaign c) async {
    final ok = await confirmar(
      context,
      titulo: '¿Regenerar la campaña?',
      mensaje: 'La IA escribirá un texto y una imagen nuevos. Usa 1 crédito; si falla, se devuelve.',
      accion: 'Regenerar',
    );
    if (ok) {
      await _accion(() async {
        await ref.read(campaignRepositoryProvider).regenerate(c.id);
        _generandoDesde = DateTime.now();
        unawaited(ref.read(sessionProvider.notifier).refreshUser());
        return 'Generando una versión nueva…';
      });
    }
  }

  /// El comentario del cliente no llega solo a la IA: se suma a las
  /// instrucciones, la persona las revisa y recién entonces se regenera.
  Future<void> _ajustarYRegenerar(Campaign c) async {
    final prompt = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (_) => _AjustarSheet(campana: c),
    );
    if (prompt == null) return;
    await _accion(() async {
      final repo = ref.read(campaignRepositoryProvider);
      final actualizada = await repo.editPrompt(c.id, prompt, c.version);
      await repo.regenerate(actualizada.id);
      _generandoDesde = DateTime.now();
      unawaited(ref.read(sessionProvider.notifier).refreshUser());
      return 'Generando una versión nueva con el ajuste…';
    });
  }

  Future<void> _eliminar(Campaign c) async {
    final ok = await confirmar(
      context,
      titulo: '¿Eliminar este borrador?',
      mensaje: 'Se borra la campaña y sus versiones. No se puede deshacer.',
      accion: 'Eliminar',
      destructivo: true,
    );
    if (!ok) return;
    try {
      await ref.read(campaignRepositoryProvider).delete(c.id);
      ref.invalidate(campaignListProvider);
      ref.invalidate(campaignStatsProvider);
      if (mounted) context.pop();
    } on ApiException catch (e) {
      _aviso(e.message);
    }
  }

  Future<void> _enviar(Campaign c) async {
    final destinos = await showModalBottomSheet<List<int>>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (_) => _DestinosSheet(campana: c),
    );
    if (destinos == null) return;
    await _accion(() async {
      await ref.read(campaignRepositoryProvider).submit(c.id, destinos);
      HapticFeedback.mediumImpact();
      return destinos.isEmpty
          ? 'Enviada a ${c.clienteNombre}. Sin publicación automática.'
          : 'Enviada a ${c.clienteNombre}. Se publicará al aprobar.';
    });
  }
}

Future<bool> confirmar(
  BuildContext context, {
  required String titulo,
  required String mensaje,
  required String accion,
  bool destructivo = false,
}) =>
    confirmarAccion(context, titulo: titulo, mensaje: mensaje, accion: accion, destructivo: destructivo);

class _Dato extends StatelessWidget {
  const _Dato(this.icon, this.texto);
  final IconData icon;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.colors.outlineVariant),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: context.colors.onSurfaceVariant),
          const SizedBox(width: 6),
          Text(texto, style: context.text.labelMedium),
        ],
      ),
    );
  }
}

class _Rechazo extends StatelessWidget {
  const _Rechazo({required this.campana, required this.ocupado, required this.onRegenerar});

  final Campaign campana;
  final bool ocupado;
  final VoidCallback onRegenerar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: context.colors.errorContainer, borderRadius: BorderRadius.circular(Nexo.radiusSurface)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.messageSquare, color: context.colors.onErrorContainer, size: 20),
              const SizedBox(width: 8),
              Text('Lo que pidió el cliente', style: context.text.titleSmall?.copyWith(color: context.colors.onErrorContainer)),
              const Spacer(),
              if (campana.clienteValoracion != null) _Estrellas(campana.clienteValoracion!, color: context.colors.onErrorContainer),
            ],
          ),
          const SizedBox(height: 8),
          Text('«${campana.feedbackRechazo}»', style: context.text.bodyMedium?.copyWith(color: context.colors.onErrorContainer)),
          const SizedBox(height: 12),
          Text(
            'Es el ${campana.rechazosClienteCount}.º rechazo. Un segundo rechazo cierra la campaña.',
            style: context.text.bodySmall?.copyWith(color: context.colors.onErrorContainer),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: ocupado ? null : onRegenerar,
            icon: const Icon(LucideIcons.refreshCw),
            label: const Text('Ajustar instrucciones y regenerar'),
          ),
        ],
      ),
    );
  }
}

class _Estrellas extends StatelessWidget {
  const _Estrellas(this.valor, {this.color});
  final int valor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$valor de 5 estrellas',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(i <= valor ? Icons.star_rounded : Icons.star_outline_rounded, size: 16, color: color ?? context.nexo.warning),
        ],
      ),
    );
  }
}

/// Texto de la campaña: leer, editar (con bloqueo optimista) o mejorar con IA (gratis).
class _Copy extends ConsumerStatefulWidget {
  const _Copy({
    required this.campana,
    required this.ocupado,
    required this.onAccion,
    required this.onEditando,
    this.generandoDesde,
  });

  final Campaign campana;
  final DateTime? generandoDesde;
  final bool ocupado;
  final Future<bool> Function(Future<String?> Function()) onAccion;

  /// Avisa al detalle si hay cambios sin guardar (bloquea «Enviar al cliente»).
  final ValueChanged<bool> onEditando;

  @override
  ConsumerState<_Copy> createState() => _CopyState();
}

class _CopyState extends ConsumerState<_Copy> {
  bool _editando = false;
  late final _texto = TextEditingController(text: widget.campana.textoGenerado ?? '');

  @override
  void didUpdateWidget(covariant _Copy old) {
    super.didUpdateWidget(old);
    if (!_editando && old.campana.textoGenerado != widget.campana.textoGenerado) {
      _texto.text = widget.campana.textoGenerado ?? '';
    }
  }

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  void _editar(bool valor) {
    setState(() => _editando = valor);
    widget.onEditando(valor);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.campana;
    final editable = c.estado.editable;
    final texto = c.textoGenerado;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          'Texto',
          trailing: editable && texto != null && !_editando
              ? TextButton.icon(
                  onPressed: () => _editar(true),
                  icon: const Icon(LucideIcons.pencilLine, size: 18),
                  label: const Text('Editar'),
                )
              : null,
        ),
        AnimatedSize(
          duration: Motion.of(context, Motion.base),
          curve: Motion.easeOut,
          alignment: Alignment.topCenter,
          child: _editando
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(controller: _texto, minLines: 5, maxLines: 14, autofocus: true),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              _texto.text = texto ?? '';
                              _editar(false);
                            },
                            child: const Text('Cancelar'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: widget.ocupado
                                ? null
                                : () async {
                                    final guardado = await widget.onAccion(() async {
                                      await ref.read(campaignRepositoryProvider).editText(c.id, _texto.text, c.version);
                                      return 'Texto guardado.';
                                    });
                                    // Si falla (409, red), el texto escrito se queda en el campo.
                                    if (guardado && mounted) _editar(false);
                                  },
                            child: const Text('Guardar'),
                          ),
                        ),
                      ],
                    ),
                  ],
                )
              : NexoCard(
                  child: SwapIn(
                    child: texto == null && c.estado == EstadoCampana.pendienteIa
                        ? Column(
                            key: const ValueKey('en-camino'),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const LineasCopy(),
                              const SizedBox(height: 16),
                              EsperaGeneracion(desde: widget.generandoDesde),
                            ],
                          )
                        : texto == null
                            ? Text(
                                'Todavía no hay texto.',
                                key: const ValueKey('vacio'),
                                style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
                              )
                        : SelectableText(texto, key: ValueKey(texto.hashCode), style: context.text.bodyLarge),
                  ),
                ),
        ),
        if (editable && texto != null && !_editando) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: widget.ocupado
                ? null
                : () => widget.onAccion(() async {
                      await ref.read(campaignRepositoryProvider).improveText(c.id);
                      return 'Texto mejorado. La versión anterior quedó en el historial.';
                    }),
            icon: const Icon(LucideIcons.wandSparkles),
            label: const Text('Mejorar texto con IA · gratis'),
          ),
        ],
      ],
    );
  }
}

class _Versiones extends ConsumerWidget {
  const _Versiones({required this.campana, required this.onAccion});

  final Campaign campana;
  final Future<bool> Function(Future<String?> Function()) onAccion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final editable = campana.estado == EstadoCampana.generado || campana.estado == EstadoCampana.borrador;
    return NexoCard(
      onTap: () => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        builder: (_) => _VersionesSheet(campana: campana, editable: editable, onAccion: onAccion),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.history, color: context.colors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Versiones anteriores', style: context.text.titleSmall),
                Text('Se guardan las últimas 5. Restaurar no gasta créditos.', style: context.text.bodySmall),
              ],
            ),
          ),
          Icon(LucideIcons.chevronRight, color: context.colors.onSurfaceVariant),
        ],
      ),
    );
  }
}

class _VersionesSheet extends ConsumerWidget {
  const _VersionesSheet({required this.campana, required this.editable, required this.onAccion});

  final Campaign campana;
  final bool editable;
  final Future<bool> Function(Future<String?> Function()) onAccion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versiones = ref.watch(_versionesProvider(campana.id));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.92,
      builder: (context, scroll) => versiones.when(
        loading: () => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text('Versiones', style: context.text.titleLarge),
            const SizedBox(height: 12),
            for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: Skeleton(height: 88, radius: Nexo.radiusSurface)),
          ],
        ),
        error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: toApiException(e).message)),
        data: (lista) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text('Versiones', style: context.text.titleLarge),
            const SizedBox(height: 12),
            if (lista.isEmpty)
              Text('Todavía no hay versiones anteriores.', style: context.text.bodyMedium)
            else
              for (final (i, v) in lista.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Entrance(
                    index: i,
                    child: NexoCard(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (decodeImagen(v.imagenB64) case final bytes?)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(bytes, width: 64, height: 64, fit: BoxFit.cover, cacheWidth: 192),
                            )
                          else
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(color: context.colors.surfaceContainerHigh, borderRadius: BorderRadius.circular(8)),
                              child: const Icon(LucideIcons.fileText),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Versión ${v.numero} · ${fechaHora(v.creada)}', style: context.text.labelMedium),
                                const SizedBox(height: 4),
                                Text(v.textoPreview, style: context.text.bodySmall, maxLines: 4, overflow: TextOverflow.ellipsis),
                                if (editable)
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: TextButton(
                                      onPressed: () async {
                                        Navigator.pop(context);
                                        await onAccion(() => ref.read(campaignRepositoryProvider).restoreVersion(campana.id, v.id));
                                      },
                                      child: const Text('Restaurar'),
                                    ),
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
        ),
      ),
    );
  }
}

final _versionesProvider = FutureProvider.autoDispose.family<List<CampaignVersion>, int>(
  (ref, id) => ref.watch(campaignRepositoryProvider).versions(id),
);

/// Destinos de publicación automática: solo Instagram y Facebook del cliente,
/// una vez cada cuenta. X y TikTok van aparte, después de aprobar.
class _DestinosSheet extends ConsumerStatefulWidget {
  const _DestinosSheet({required this.campana});
  final Campaign campana;

  @override
  ConsumerState<_DestinosSheet> createState() => _DestinosSheetState();
}

class _DestinosSheetState extends ConsumerState<_DestinosSheet> {
  final _elegidos = <int>{};
  List<SocialConnection>? _destinos;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(socialRepositoryProvider).destinos(widget.campana.clienteEmail).then((d) {
      if (!mounted) return;
      // Nada marcado por defecto: publicar en una cuenta real es una decisión explícita.
      setState(() => _destinos = d);
    }).catchError((Object e) {
      if (mounted) setState(() => _error = toApiException(e).message);
    });
  }

  @override
  Widget build(BuildContext context) {
    final destinos = _destinos;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Enviar a ${widget.campana.clienteNombre}', style: context.text.titleLarge),
            const SizedBox(height: 6),
            Text(
              'Elige dónde se publicará cuando lo apruebe. Se publica exactamente lo que apruebe.',
              style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              ErrorBanner(message: _error!)
            else if (destinos == null)
              // Forma de dos cuentas (ícono y nombre) mientras llegan los destinos.
              const Column(
                children: [
                  Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Skeleton(height: 32)),
                  Divider(),
                  Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Skeleton(height: 32)),
                ],
              )
            else if (destinos.isEmpty)
              const InfoBanner(
                message: 'El cliente todavía no conectó Instagram ni Facebook. Puedes enviarla igual; se aprobará sin publicar.',
                tone: InfoTone.warning,
              )
            else
              for (final (i, d) in destinos.indexed) ...[
                if (i > 0) const Divider(),
                Semantics(
                  checked: _elegidos.contains(d.id),
                  label: '${d.cuentaNombre}, ${etiquetaRed[d.red] ?? d.red}',
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _elegidos.contains(d.id) ? _elegidos.remove(d.id) : _elegidos.add(d.id));
                    },
                    borderRadius: BorderRadius.circular(Nexo.radiusField),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          NetworkIcon(d.red, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(d.cuentaNombre, style: context.text.titleSmall),
                                Text(etiquetaRed[d.red] ?? d.red, style: context.text.bodySmall),
                              ],
                            ),
                          ),
                          Checkbox.adaptive(
                            value: _elegidos.contains(d.id),
                            onChanged: (v) => setState(() => v == true ? _elegidos.add(d.id) : _elegidos.remove(d.id)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: destinos == null && _error == null ? null : () => Navigator.pop(context, _elegidos.toList()),
              icon: const Icon(LucideIcons.send),
              label: Text(_elegidos.isEmpty
                  ? 'Enviar sin publicación automática'
                  : _elegidos.length == 1
                      ? 'Enviar · publicar en 1 cuenta al aprobar'
                      : 'Enviar · publicar en ${_elegidos.length} cuentas al aprobar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetalleSkeleton extends StatelessWidget {
  const _DetalleSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        AspectRatio(aspectRatio: 1, child: Skeleton(height: double.infinity, radius: Nexo.radiusSurface)),
        SizedBox(height: 16),
        Skeleton(width: 220, height: 22),
        SizedBox(height: 8),
        Skeleton(width: 160, height: 14),
        SizedBox(height: 24),
        Skeleton(height: 120, radius: Nexo.radiusSurface),
      ],
    );
  }
}


class _AjustarSheet extends StatefulWidget {
  const _AjustarSheet({required this.campana});
  final Campaign campana;

  @override
  State<_AjustarSheet> createState() => _AjustarSheetState();
}

class _AjustarSheetState extends State<_AjustarSheet> {
  late final _prompt = TextEditingController(
    text: '${widget.campana.prompt.trim()}\n\nAjuste pedido por el cliente: ${widget.campana.feedbackRechazo ?? ''}'.trim(),
  );

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Ajustar instrucciones', style: context.text.titleLarge),
          const SizedBox(height: 6),
          Text(
            'La IA usará estas instrucciones para la nueva versión. Regenerar usa 1 crédito; si falla, se devuelve.',
            style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          TextField(controller: _prompt, minLines: 5, maxLines: 10),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, _prompt.text.trim()),
            icon: const Icon(LucideIcons.refreshCw),
            label: const Text('Guardar y regenerar · 1 crédito'),
          ),
        ],
      ),
    );
  }
}

/// Qué pasa al aprobar una campaña enviada. Solo afirma «sin publicación
/// automática» cuando las publicaciones ya cargaron y no hay ninguna.
@visibleForTesting
String avisoEnvio(String cliente, AsyncValue<List<Publication>> pubs) => switch (pubs) {
      AsyncData(:final value) when value.isEmpty =>
        'Enviada a $cliente. No tiene publicación automática: aprobarla no la publica.',
      AsyncData(:final value) =>
        'Enviada a $cliente. Cuando la apruebe se publicará en ${value.map((p) => p.cuentaNombre).join(', ')}.',
      AsyncError() => 'Enviada a $cliente. No pudimos leer sus destinos; desliza hacia abajo para reintentar.',
      _ => 'Enviada a $cliente.',
    };
