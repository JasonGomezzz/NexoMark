import 'dart:async';

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
import '../../widgets/publication_widgets.dart';
import 'lab_screen.dart' show tonos;
import 'providers.dart';
import 'tiktok_block.dart';
import 'x_variant_block.dart';

class ProjectDetailScreen extends ConsumerStatefulWidget {
  const ProjectDetailScreen({super.key, required this.id, this.inicial});

  final int id;

  /// La campaña de la lista (sin base64): se muestra mientras llega la completa.
  final Campaign? inicial;

  @override
  ConsumerState<ProjectDetailScreen> createState() =>
      _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen> {
  Timer? _sondeo;
  bool _ocupado = false;

  @override
  void dispose() {
    _sondeo?.cancel();
    super.dispose();
  }

  /// Mientras la IA genera (o se publica) se vuelve a pedir cada 3 s.
  void _vigilar(Campaign c, List<Publication> pubs) {
    final esperando =
        c.estado == EstadoCampana.pendienteIa ||
        pubs.any((p) => p.estado == 'publicando');
    if (esperando && _sondeo == null) {
      _sondeo = Timer.periodic(const Duration(seconds: 3), (_) {
        ref.invalidate(campaignProvider(widget.id));
        ref.invalidate(campaignPublicationsProvider(widget.id));
      });
    } else if (!esperando && _sondeo != null) {
      _sondeo!.cancel();
      _sondeo = null;
      HapticFeedback.mediumImpact();
      ref.invalidate(campaignListProvider);
    }
  }

  void _aviso(String mensaje) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(mensaje)));
  }

  Future<void> _accion(Future<String?> Function() body) async {
    if (_ocupado) return;
    setState(() => _ocupado = true);
    try {
      final mensaje = await body();
      ref.invalidate(campaignProvider(widget.id));
      ref.invalidate(campaignPublicationsProvider(widget.id));
      ref.invalidate(campaignListProvider);
      ref.invalidate(campaignStatsProvider);
      if (mensaje != null) _aviso(mensaje);
    } on ApiException catch (e) {
      _aviso(
        e.status == 402
            ? 'No te quedan créditos. Solicita más desde Cuenta.'
            : e.message,
      );
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
    return Scaffold(
      appBar: AppBar(
        title: Text(c?.titulo ?? 'Proyecto', overflow: TextOverflow.ellipsis),
        actions: [
          if (c != null && c.estado == EstadoCampana.borrador)
            IconButton(
              tooltip: 'Eliminar borrador',
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: () => _eliminar(c),
            ),
        ],
      ),
      body: campana.when(
        loading: () => widget.inicial == null
            ? const _DetalleSkeleton()
            : _cuerpo(context, widget.inicial!, pubs),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorBanner(
            message: toApiException(e).message,
            onRetry: () => ref.invalidate(campaignProvider(widget.id)),
          ),
        ),
        data: (c) => _cuerpo(context, c, pubs),
      ),
    );
  }

  Widget _cuerpo(
    BuildContext context,
    Campaign c,
    AsyncValue<List<Publication>> pubs,
  ) {
    return RefreshIndicator(
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
            child: CampaignImage(campaign: c, radius: Nexo.radiusPanel),
          ),
          const SizedBox(height: 16),
          Align(alignment: Alignment.centerLeft, child: StatePill(c.estado)),
          const SizedBox(height: 10),
          Text(c.titulo, style: context.text.headlineSmall),
          const SizedBox(height: 2),
          Text(
            '${c.clienteNombre} · ${c.clienteEmail}',
            style: context.text.bodySmall,
          ),
          const SizedBox(height: 16),
          FlowStepper(
            current: pasoDeEstado(
              c.estado,
              publicada: (pubs.value ?? const []).any(
                (p) => p.estado == 'publicado',
              ),
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (c.plataforma.isNotEmpty) NetworkChip(red: c.plataforma),
              if (c.tono.isNotEmpty)
                _Dato(
                  Icons.record_voice_over_outlined,
                  tonos[c.tono] ?? c.tono,
                ),
              if (c.industria.isNotEmpty)
                _Dato(Icons.storefront_outlined, c.industria),
            ],
          ),
          if (c.estado == EstadoCampana.rechazado &&
              (c.feedbackRechazo?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 16),
            _Rechazo(
              campana: c,
              ocupado: _ocupado,
              onRegenerar: () => _ajustarYRegenerar(c),
            ),
          ],
          if (c.estado == EstadoCampana.borrador &&
              c.iaErrorMessage != null) ...[
            const SizedBox(height: 16),
            InfoBanner(
              tone: InfoTone.warning,
              message: '${c.iaErrorMessage} Se devolvió el crédito.',
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _ocupado ? null : () => _regenerar(c),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Regenerar · 1 crédito'),
            ),
          ],
          const SizedBox(height: 20),
          _Copy(campana: c, ocupado: _ocupado, onAccion: _accion),
          if (c.estado == EstadoCampana.generado) ...[
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _ocupado ? null : () => _enviar(c),
              icon: const Icon(Icons.send_rounded),
              label: const Text('Enviar al cliente'),
            ),
          ],
          if (c.estado == EstadoCampana.pendienteAprobacion) ...[
            const SizedBox(height: 16),
            InfoBanner(
              icon: Icons.hourglass_top_rounded,
              message: (pubs.value ?? const []).isEmpty
                  ? 'Enviada a ${c.clienteNombre}. No tiene publicación automática: aprobarla no la publica.'
                  : 'Enviada a ${c.clienteNombre}. Cuando la apruebe se publicará en '
                        '${(pubs.value ?? const []).map((p) => p.cuentaNombre).join(', ')}.',
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
          SectionTitle(
            'Publicaciones',
            subtitle: 'Aprobada → publicada → medida',
          ),
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
                              onConsultar:
                                  p.red == 'tiktok' &&
                                      (p.estado == 'publicando' ||
                                          p.estado == 'en_buzon')
                                  ? () => _accion(() async {
                                      final r = await ref
                                          .read(socialRepositoryProvider)
                                          .tiktokEstado(p.id);
                                      return r.mensaje;
                                    })
                                  : null,
                              onReintentar:
                                  p.estado == 'fallido' &&
                                      p.red != 'tiktok' &&
                                      p.red != 'x'
                                  ? () => _accion(() async {
                                      await ref
                                          .read(socialRepositoryProvider)
                                          .publish(p.id);
                                      return 'Publicando de nuevo…';
                                    })
                                  : null,
                            ),
                          ),
                        ),
                    ],
                  ),
            loading: () => const Skeleton(height: 72, radius: Nexo.radiusCard),
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
}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(titulo),
      content: Text(mensaje),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: destructivo
              ? FilledButton.styleFrom(
                  backgroundColor: context.colors.error,
                  foregroundColor: context.colors.onError,
                )
              : null,
          onPressed: () => Navigator.pop(context, true),
          child: Text(accion),
        ),
      ],
    ),
  );
  return r ?? false;
}

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
  const _Rechazo({
    required this.campana,
    required this.ocupado,
    required this.onRegenerar,
  });

  final Campaign campana;
  final bool ocupado;
  final VoidCallback onRegenerar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.colors.errorContainer,
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.feedback_outlined,
                color: context.colors.onErrorContainer,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'Lo que pidió el cliente',
                style: context.text.titleSmall?.copyWith(
                  color: context.colors.onErrorContainer,
                ),
              ),
              const Spacer(),
              if (campana.clienteValoracion != null)
                _Estrellas(
                  campana.clienteValoracion!,
                  color: context.colors.onErrorContainer,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '«${campana.feedbackRechazo}»',
            style: context.text.bodyMedium?.copyWith(
              color: context.colors.onErrorContainer,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Es el ${campana.rechazosClienteCount}.º rechazo. Un segundo rechazo cierra la campaña.',
            style: context.text.bodySmall?.copyWith(
              color: context.colors.onErrorContainer,
            ),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: ocupado ? null : onRegenerar,
            icon: const Icon(Icons.refresh_rounded),
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
            Icon(
              i <= valor ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 16,
              color: color ?? context.nexo.warning,
            ),
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
  });

  final Campaign campana;
  final bool ocupado;
  final Future<void> Function(Future<String?> Function()) onAccion;

  @override
  ConsumerState<_Copy> createState() => _CopyState();
}

class _CopyState extends ConsumerState<_Copy> {
  bool _editando = false;
  late final _texto = TextEditingController(
    text: widget.campana.textoGenerado ?? '',
  );

  @override
  void didUpdateWidget(covariant _Copy old) {
    super.didUpdateWidget(old);
    if (!_editando &&
        old.campana.textoGenerado != widget.campana.textoGenerado) {
      _texto.text = widget.campana.textoGenerado ?? '';
    }
  }

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
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
                  onPressed: () => setState(() => _editando = true),
                  icon: const Icon(Icons.edit_outlined, size: 18),
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
                    TextField(
                      controller: _texto,
                      minLines: 5,
                      maxLines: 14,
                      autofocus: true,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => setState(() {
                              _editando = false;
                              _texto.text = texto ?? '';
                            }),
                            child: const Text('Cancelar'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: widget.ocupado
                                ? null
                                : () async {
                                    await widget.onAccion(() async {
                                      await ref
                                          .read(campaignRepositoryProvider)
                                          .editText(
                                            c.id,
                                            _texto.text,
                                            c.version,
                                          );
                                      return 'Texto guardado.';
                                    });
                                    if (mounted) {
                                      setState(() => _editando = false);
                                    }
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
                    child: texto == null
                        ? Text(
                            c.estado == EstadoCampana.pendienteIa
                                ? 'La IA está escribiendo…'
                                : 'Todavía no hay texto.',
                            key: const ValueKey('vacio'),
                            style: context.text.bodyMedium?.copyWith(
                              color: context.colors.onSurfaceVariant,
                            ),
                          )
                        : SelectableText(
                            texto,
                            key: ValueKey(texto.hashCode),
                            style: context.text.bodyLarge,
                          ),
                  ),
                ),
        ),
        if (editable && texto != null && !_editando) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: widget.ocupado
                ? null
                : () => widget.onAccion(() async {
                    await ref
                        .read(campaignRepositoryProvider)
                        .improveText(c.id);
                    return 'Texto mejorado. La versión anterior quedó en el historial.';
                  }),
            icon: const Icon(Icons.auto_fix_high_rounded),
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
  final Future<void> Function(Future<String?> Function()) onAccion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final editable =
        campana.estado == EstadoCampana.generado ||
        campana.estado == EstadoCampana.borrador;
    return NexoCard(
      onTap: () => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        builder: (_) => _VersionesSheet(
          campana: campana,
          editable: editable,
          onAccion: onAccion,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.history_rounded, color: context.colors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Versiones anteriores', style: context.text.titleSmall),
                Text(
                  'Se guardan las últimas 5. Restaurar no gasta créditos.',
                  style: context.text.bodySmall,
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: context.colors.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

class _VersionesSheet extends ConsumerWidget {
  const _VersionesSheet({
    required this.campana,
    required this.editable,
    required this.onAccion,
  });

  final Campaign campana;
  final bool editable;
  final Future<void> Function(Future<String?> Function()) onAccion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versiones = ref.watch(_versionesProvider(campana.id));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.92,
      builder: (context, scroll) => versiones.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorBanner(message: toApiException(e).message),
        ),
        data: (lista) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text('Versiones', style: context.text.titleLarge),
            const SizedBox(height: 12),
            if (lista.isEmpty)
              Text(
                'Todavía no hay versiones anteriores.',
                style: context.text.bodyMedium,
              )
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
                              child: Image.memory(
                                bytes,
                                width: 64,
                                height: 64,
                                fit: BoxFit.cover,
                                cacheWidth: 192,
                              ),
                            )
                          else
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: context.colors.surfaceContainerHigh,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.notes_rounded),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Versión ${v.numero} · ${fechaHora(v.creada)}',
                                  style: context.text.labelMedium,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  v.textoPreview,
                                  style: context.text.bodySmall,
                                  maxLines: 4,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (editable)
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: TextButton(
                                      onPressed: () async {
                                        Navigator.pop(context);
                                        await onAccion(
                                          () => ref
                                              .read(campaignRepositoryProvider)
                                              .restoreVersion(campana.id, v.id),
                                        );
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

final _versionesProvider = FutureProvider.autoDispose
    .family<List<CampaignVersion>, int>(
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
    ref
        .read(socialRepositoryProvider)
        .destinos(widget.campana.clienteEmail)
        .then((d) {
          if (!mounted) return;
          // Nada marcado por defecto: publicar en una cuenta real es una decisión explícita.
          setState(() => _destinos = d);
        })
        .catchError((Object e) {
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
            Text(
              'Enviar a ${widget.campana.clienteNombre}',
              style: context.text.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              'Envía la campaña a revisión. Aprobar no publica: la publicación en redes se realiza después desde la web.',
              style: context.text.bodyMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              ErrorBanner(message: _error!)
            else if (destinos == null)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (destinos.isEmpty)
              const InfoBanner(
                message: 'El cliente todavía no conectó Instagram ni Facebook. Puedes enviarla igual; se aprobará sin publicar.',
                tone: InfoTone.warning,
              )
            else
              for (final d in destinos)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Pressable(
                    onTap: () => setState(
                      () => _elegidos.contains(d.id)
                          ? _elegidos.remove(d.id)
                          : _elegidos.add(d.id),
                    ),
                    haptic: true,
                    child: AnimatedContainer(
                      duration: Motion.of(context, Motion.fast),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _elegidos.contains(d.id)
                            ? context.colors.primaryFixed
                            : context.colors.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(Nexo.radiusCard),
                        border: Border.all(
                          color: _elegidos.contains(d.id)
                              ? context.colors.primary
                              : context.colors.outlineVariant,
                        ),
                      ),
                      child: Row(
                        children: [
                          NetworkIcon(d.red, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d.cuentaNombre,
                                  style: context.text.titleSmall,
                                ),
                                Text(
                                  etiquetaRed[d.red] ?? d.red,
                                  style: context.text.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          AnimatedSwitcher(
                            duration: Motion.of(context, Motion.fast),
                            child: Icon(
                              _elegidos.contains(d.id)
                                  ? Icons.check_circle_rounded
                                  : Icons.radio_button_unchecked,
                              key: ValueKey(_elegidos.contains(d.id)),
                              color: _elegidos.contains(d.id)
                                  ? context.colors.primary
                                  : context.colors.outline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: destinos == null && _error == null
                  ? null
                  : () => Navigator.pop(context, _elegidos.toList()),
              icon: const Icon(Icons.send_rounded),
              label: Text(
                _elegidos.isEmpty
                    ? 'Enviar sin publicación automática'
                    : 'Enviar · se publicará en ${_elegidos.length}',
              ),
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
        AspectRatio(
          aspectRatio: 1,
          child: Skeleton(height: double.infinity, radius: Nexo.radiusPanel),
        ),
        SizedBox(height: 16),
        Skeleton(width: 220, height: 22),
        SizedBox(height: 8),
        Skeleton(width: 160, height: 14),
        SizedBox(height: 24),
        Skeleton(height: 120, radius: Nexo.radiusCard),
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
    text:
        '${widget.campana.prompt.trim()}\n\nAjuste pedido por el cliente: ${widget.campana.feedbackRechazo ?? ''}'
            .trim(),
  );

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Ajustar instrucciones', style: context.text.titleLarge),
          const SizedBox(height: 6),
          Text(
            'La IA usará estas instrucciones para la nueva versión. Regenerar usa 1 crédito; si falla, se devuelve.',
            style: context.text.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          TextField(controller: _prompt, minLines: 5, maxLines: 10),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, _prompt.text.trim()),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Guardar y regenerar · 1 crédito'),
          ),
        ],
      ),
    );
  }
}
