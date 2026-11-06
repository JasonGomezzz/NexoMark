import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/conforme.dart';
import '../../widgets/nexo_widgets.dart';
import '../marketero/providers.dart' show thumbnailProvider, xConfigProvider;

final _anioProvider = NotifierProvider<_AnioController, int>(_AnioController.new);

class _AnioController extends Notifier<int> {
  @override
  int build() => DateTime.now().year;
  void set(int v) => state = v;
}

final _summaryProvider = FutureProvider.autoDispose.family<StatsSummary, int>(
  (ref, anio) => ref.watch(socialRepositoryProvider).summary(anio: anio),
);

final _publicacionesProvider = FutureProvider.autoDispose.family<List<Publication>, int>(
  (ref, anio) => ref.watch(socialRepositoryProvider).publications(anio: anio),
);

/// Estadísticas de los tres roles (Django recorta lo que ve cada uno):
/// nivel 1 por red y nivel 2 por publicación. Lo que una red no informa se
/// escribe "sin dato", nunca 0.
class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anio = ref.watch(_anioProvider);
    final summary = ref.watch(_summaryProvider(anio));
    final pubs = ref.watch(_publicacionesProvider(anio));
    final user = ref.watch(currentUserProvider);
    final xActivo = ref.watch(xConfigProvider).value?.habilitado ?? false;

    Future<void> refrescar() async {
      ref.invalidate(_summaryProvider(anio));
      ref.invalidate(_publicacionesProvider(anio));
      try {
        await ref.read(_summaryProvider(anio).future);
      } catch (_) {
        // Se muestra en pantalla.
      }
    }

    Future<void> actualizarMetricas() async {
      try {
        final m = await ref.read(socialRepositoryProvider).refreshMetrics();
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
        await refrescar();
      } on ApiException catch (e) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }

    return Scaffold(
      backgroundColor: context.colors.surface,
      body: RefreshIndicator.adaptive(
        onRefresh: refrescar,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            PliegoTitulo(
              contexto: 'Informe del año',
              titulo: 'Métricas de $anio',
              accion: user?.rol == Rol.marketero
                  ? IconButton(
                      tooltip: 'Actualizar métricas',
                      icon: const Icon(LucideIcons.refreshCw, size: 20),
                      onPressed: actualizarMetricas,
                    )
                  : null,
            ),
            ...summary.when(
              loading: () => [
                const Padding(
                  padding: EdgeInsets.all(Nexo.gutter),
                  child: Column(
                    children: [
                      Skeleton(height: 18, width: 260),
                      SizedBox(height: 24),
                      Skeleton(height: 280, radius: Nexo.radiusSurface),
                    ],
                  ),
                ),
              ],
              error: (e, _) => [
                Padding(
                  padding: const EdgeInsets.all(Nexo.gutter),
                  child: ErrorBanner(message: toApiException(e).message, onRetry: refrescar),
                ),
              ],
              data: (s) {
                final anios = {...s.anios, DateTime.now().year, anio}.toList()..sort((a, b) => b.compareTo(a));
                final redes = ['instagram', 'x', 'facebook', 'tiktok'].where((red) {
                  final datos = s.redes[red];
                  if (datos == null) return false;
                  if (red == 'instagram' || red == 'facebook') return true;
                  return (red == 'x' && xActivo) || datos.publicaciones > 0;
                }).toList();
                return [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(Nexo.gutter, 14, Nexo.gutter, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Resumen(publicadas: s.totalPublicaciones, pendientes: s.pendientes, fallidas: s.fallidas),
                        const SizedBox(height: 12),
                        _SelectorAnio(anios: anios, valor: anio, onChanged: (v) => ref.read(_anioProvider.notifier).set(v)),
                      ],
                    ),
                  ),
                  for (final red in redes)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(Nexo.gutter, 20, Nexo.gutter, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Regla(),
                          const SizedBox(height: 18),
                          _Plancha(resumen: s.redes[red]!, summary: s),
                        ],
                      ),
                    ),
                ];
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(Nexo.gutter, 28, Nexo.gutter, 0),
              child: SectionTitle(
                'Lo publicado, con su sello',
                subtitle: 'Cada pieza salió tal como la aprobó el cliente. El sello dice qué versión. Tócala para ver todo.',
              ),
            ),
            ...pubs.when(
              data: (lista) {
                final visibles = lista.where((p) => p.estado == 'publicado' || p.estado == 'en_buzon').toList();
                if (visibles.isEmpty) {
                  return [
                    EmptyState(
                      icon: LucideIcons.stamp,
                      title: 'Nada publicado en $anio',
                      message: user?.rol == Rol.cliente
                          ? 'Cuando apruebes una campaña con destinos, verás aquí cómo le va.'
                          : 'Cuando un cliente apruebe una campaña con destinos, verás aquí cómo le va.',
                    ),
                  ];
                }
                return [
                  for (final (i, p) in visibles.indexed) ...[
                    if (i > 0)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
                        child: Divider(color: context.nexo.hairline),
                      ),
                    _PiezaSellada(
                      publicacion: p,
                      onTap: () => showModalBottomSheet<void>(
                        context: context,
                        useRootNavigator: true,
                        isScrollControlled: true,
                        builder: (_) => _DetallePublicacion(publicacion: p),
                      ),
                    ),
                  ],
                ];
              },
              loading: () => [
                const Padding(padding: EdgeInsets.all(Nexo.gutter), child: Skeleton(height: 96, radius: Nexo.radiusSurface)),
              ],
              error: (e, _) => [
                Padding(padding: const EdgeInsets.all(Nexo.gutter), child: ErrorBanner(message: toApiException(e).message)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// "14 publicadas · 1 esperando aprobación · 0 fallidas": cifras reales en una línea.
class _Resumen extends StatelessWidget {
  const _Resumen({required this.publicadas, required this.pendientes, required this.fallidas});

  final int publicadas;
  final int pendientes;
  final int fallidas;

  @override
  Widget build(BuildContext context) {
    TextSpan dato(int n, String texto, {Color? color}) => TextSpan(
          children: [
            TextSpan(text: formatoNumero(n), style: TextStyle(fontWeight: FontWeight.w700, color: color ?? context.colors.onSurface)),
            TextSpan(text: ' $texto'),
          ],
        );
    return Text.rich(
      TextSpan(
        style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
        children: [
          dato(publicadas, publicadas == 1 ? 'publicada' : 'publicadas'),
          const TextSpan(text: '   '),
          dato(pendientes, 'esperando\u00A0aprobación'),
          const TextSpan(text: '   '),
          dato(fallidas, fallidas == 1 ? 'fallida' : 'fallidas', color: fallidas > 0 ? context.colors.error : null),
        ],
      ),
    );
  }
}

/// El año del informe: un control con borde y chevron (como en la web) que
/// abre una hoja con los años que tienen datos. Se toca pocas veces.
class _SelectorAnio extends StatelessWidget {
  const _SelectorAnio({required this.anios, required this.valor, required this.onChanged});

  final List<int> anios;
  final int valor;
  final ValueChanged<int> onChanged;

  Future<void> _elegir(BuildContext context) async {
    final elegido = await showModalBottomSheet<int>(
      context: context,
      useRootNavigator: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('Año del informe', style: context.text.titleLarge),
            ),
            for (final a in anios)
              ListTile(
                title: Text('$a', style: context.text.titleMedium),
                trailing: a == valor ? Icon(LucideIcons.check, color: context.colors.primary) : null,
                selected: a == valor,
                onTap: () => Navigator.pop(context, a),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (elegido != null && elegido != valor) onChanged(elegido);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Año del informe: $valor. Cambiar',
      excludeSemantics: true,
      child: OutlinedButton(
        onPressed: anios.length > 1 ? () => _elegir(context) : null,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          side: BorderSide(color: context.colors.outline),
          foregroundColor: context.colors.onSurface,
          disabledForegroundColor: context.colors.onSurface,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$valor', style: context.text.titleMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            if (anios.length > 1) ...[const SizedBox(width: 6), const Icon(LucideIcons.chevronDown, size: 18)],
          ],
        ),
      ),
    );
  }
}

/// Una plancha por red: logo y nombre, dos cifras grandes, filas finas con el
/// resto y 12 meses de barras. Lo que la red no informa dice "sin dato".
class _Plancha extends StatelessWidget {
  const _Plancha({required this.resumen, required this.summary});

  final NetworkSummary resumen;
  final StatsSummary summary;

  @override
  Widget build(BuildContext context) {
    final r = resumen;
    final m = r.metricas;
    final soloEnvios = r.red == 'tiktok' || r.red == 'x';
    final likes = r.red == 'facebook' ? 'Reacciones' : 'Me gusta';
    final nombre = etiquetaRed[r.red] ?? r.red;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            NetworkIcon(r.red, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(nombre, style: context.text.headlineSmall),
                  Text(
                    r.publicacionesMes == 0
                        ? 'Ninguna publicación este mes'
                        : r.publicacionesMes == 1
                            ? '1 publicación este mes'
                            : '${formatoNumero(r.publicacionesMes)} publicaciones este mes',
                    style: context.text.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _Cifra(etiqueta: soloEnvios ? 'Enviadas al buzón' : 'Publicaciones', valor: r.publicaciones)),
            if (!soloEnvios) Expanded(child: _Cifra(etiqueta: likes, valor: m.meGusta)),
          ],
        ),
        const SizedBox(height: 12),
        if (soloEnvios)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.inbox, size: 16, color: context.colors.onSurfaceVariant),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$nombre no entrega métricas. La persona publica desde su app.',
                  style: context.text.bodySmall,
                ),
              ),
            ],
          )
        else ...[
          for (final (etiqueta, valor) in [('Comentarios', m.comentarios), ('Compartidos', m.compartidos), ('Alcance', m.alcance)]) ...[
            Divider(color: context.nexo.hairline),
            Semantics(
              label: '$etiqueta: ${valorODato(valor)}',
              excludeSemantics: true,
              child: SizedBox(
                height: 40,
                child: Row(
                  children: [
                    Expanded(child: Text(etiqueta, style: context.text.bodyMedium)),
                    Text(
                      valorODato(valor),
                      style: valor == null
                          ? context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)
                          : context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                  ],
                ),
              ),
            ),
          ],
          Divider(color: context.nexo.hairline),
          if (r.publicaciones > 0 && r.conMetricas < r.publicaciones)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${r.conMetricas} de ${r.publicaciones} publicaciones ya tienen métricas: Meta puede tardar hasta 48 h.',
                style: context.text.bodySmall,
              ),
            ),
        ],
        const SizedBox(height: 18),
        Text(soloEnvios ? 'Enviadas por mes' : '$likes por mes', style: context.text.titleSmall),
        const SizedBox(height: 10),
        _BarrasMes(
          red: r.red,
          serie: soloEnvios ? summary.publicacionesPorMes : summary.meGustaPorMes,
          unidad: soloEnvios ? 'enviadas' : likes.toLowerCase(),
          anio: summary.anio ?? DateTime.now().year,
        ),
      ],
    );
  }
}

class _Cifra extends StatelessWidget {
  const _Cifra({required this.etiqueta, required this.valor});
  final String etiqueta;
  final int? valor;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$etiqueta: ${valorODato(valor)}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(etiqueta, style: context.text.bodySmall),
          const SizedBox(height: 2),
          valor == null
              ? Text('sin dato', style: context.text.headlineSmall?.copyWith(color: context.colors.onSurfaceVariant, fontWeight: FontWeight.w600))
              : CountUp(value: valor!, style: context.text.displayMedium, format: formatoNumero),
        ],
      ),
    );
  }
}

/// Meses como se escriben en Perú (y en la web): «set», no «sept».
const mesesCortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/// 12 meses de una sola serie, con el color de la red (sin leyenda: el título
/// la nombra). Sin eje Y: el número del mes se lee al tocar o en el lector de
/// pantalla. Mes sin dato: una raya en la base; mes que aún no llega: nada.
/// El mes actual va en negrita. Las barras crecen una vez al aparecer.
class _BarrasMes extends StatefulWidget {
  const _BarrasMes({required this.red, required this.serie, required this.unidad, required this.anio});

  final String red;
  final List<MonthPoint> serie;
  final String unidad;
  final int anio;

  @override
  State<_BarrasMes> createState() => _BarrasMesState();
}

class _BarrasMesState extends State<_BarrasMes> {
  int? _tocado;

  @override
  Widget build(BuildContext context) {
    final color = context.nexo.chart(widget.red);
    final hoy = DateTime.now();
    final actual = widget.anio == hoy.year ? hoy.month - 1 : (widget.anio > hoy.year ? -1 : 12);
    final valores = List<int?>.generate(12, (i) => i < widget.serie.length ? widget.serie[i].valores[widget.red] : null);
    final maximo = valores.whereType<int>().fold<int>(0, math.max);
    String mes(int i) => mesesCortos[i];
    final reduced = Motion.reduced(context);
    const alto = 72.0;
    return Semantics(
      label: '${widget.unidad} por mes en ${etiquetaRed[widget.red]}: '
          '${[for (var i = 0; i < 12; i++) if (i <= actual) '${mes(i)} ${valorODato(valores[i])}'].join(', ')}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 20,
            child: _tocado == null
                ? null
                : Text(
                    '${mes(_tocado!)}: ${valorODato(valores[_tocado!])} ${widget.unidad}',
                    style: context.text.bodySmall?.copyWith(color: context.colors.onSurface, fontWeight: FontWeight.w600),
                  ),
          ),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: reduced ? 1 : 0, end: 1),
            duration: Motion.of(context, Motion.move),
            curve: Motion.easeOut,
            builder: (context, t, _) => SizedBox(
              height: alto,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < 12; i++)
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapDown: i > actual ? null : (_) => setState(() => _tocado = _tocado == i ? null : i),
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: switch (valores[i]) {
                            _ when i > actual => const SizedBox.shrink(),
                            final v? when v > 0 => Container(
                                width: 10,
                                height: math.max(3, (alto - 4) * (v / (maximo == 0 ? 1 : maximo)) * t),
                                decoration: BoxDecoration(
                                  color: _tocado == null || _tocado == i ? color : color.withValues(alpha: 0.45),
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                                ),
                              ),
                            _ => Container(width: 10, height: 2, color: context.colors.outlineVariant),
                          },
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Container(height: 1, color: context.colors.outlineVariant),
          const SizedBox(height: 4),
          Row(
            children: [
              for (var i = 0; i < 12; i++)
                Expanded(
                  child: Text(
                    mes(i),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    softWrap: false,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: i == actual ? FontWeight.w800 : FontWeight.w500,
                      color: i == actual ? context.colors.onSurface : context.colors.onSurfaceVariant,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Una pieza publicada con su sello: la imagen aprobada, el sello «conforme»
/// con la versión que aprobó el cliente y sus números.
class _PiezaSellada extends ConsumerWidget {
  const _PiezaSellada({required this.publicacion, required this.onTap});

  final Publication publicacion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = publicacion;
    final m = p.ultimaMetrica;
    final mini = ref.watch(thumbnailProvider((p.campaignId, p.versionAprobada ?? 0))).value;
    final likes = p.red == 'facebook' ? 'reacciones' : 'me gusta';
    final numeros = p.red == 'tiktok'
        ? 'En el buzón de TikTok'
        : m == null || m.vacia
            ? 'Métricas: sin dato todavía'
            : '${valorODato(m.meGusta)} $likes · ${valorODato(m.comentarios)} comentarios';
    return Semantics(
      button: true,
      label: '${p.campaignTitulo ?? 'Publicación'}. ${p.cuentaNombre}, ${etiquetaRed[p.red]}. $numeros',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 96,
                height: 104,
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(Nexo.radiusField),
                      child: SizedBox.square(
                        dimension: 88,
                        child: ColoredBox(
                          color: context.colors.surfaceContainerHigh,
                          child: mini == null
                              ? Icon(LucideIcons.image, color: context.colors.onSurfaceVariant)
                              : Image.memory(mini, fit: BoxFit.cover, gaplessPlayback: true),
                        ),
                      ),
                    ),
                    Positioned(right: 0, bottom: 0, child: Sello(size: 44, version: p.versionAprobada)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.campaignTitulo ?? 'Publicación', style: context.text.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      [p.clienteNombre, etiquetaRed[p.red], if (p.publicadoAt != null) fechaCorta(p.publicadoAt)].whereType<String>().join(' · '),
                      style: context.text.bodySmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(numeros, style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nivel 2: todas las métricas de una publicación y lo que se publicó.
class _DetallePublicacion extends ConsumerWidget {
  const _DetallePublicacion({required this.publicacion});
  final Publication publicacion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detalle = ref.watch(_statsProvider(publicacion.id));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Row(
            children: [
              NetworkIcon(publicacion.red, size: 32),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(publicacion.campaignTitulo ?? 'Publicación', style: context.text.titleLarge),
                    Text('${publicacion.cuentaNombre} · ${fechaCorta(publicacion.publicadoAt)}', style: context.text.bodySmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          detalle.when(
            // Las filas de métricas (44 de alto, como las reales) mientras llegan.
            loading: () => Column(
              children: [
                for (var i = 0; i < 6; i++) ...[
                  if (i > 0) Divider(color: context.nexo.hairline),
                  const SizedBox(
                    height: 44,
                    child: Row(children: [Skeleton(width: 110, height: 12), Spacer(), Skeleton(width: 48, height: 18)]),
                  ),
                ],
              ],
            ),
            error: (e, _) => ErrorBanner(message: toApiException(e).message),
            data: (d) {
              final m = d.publicacion.ultimaMetrica ?? const Metric();
              final items = [
                (publicacion.red == 'facebook' ? 'Reacciones' : 'Me gusta', m.meGusta),
                ('Comentarios', m.comentarios),
                ('Compartidos', m.compartidos),
                if (publicacion.red == 'instagram') ('Guardados', m.guardados),
                ('Alcance', m.alcance),
                ('Vistas', m.vistas),
                (publicacion.red == 'facebook' ? 'Clics' : 'Interacciones', m.interacciones),
              ];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (d.aviso?.trim().isNotEmpty ?? false) ...[InfoBanner(message: d.aviso!), const SizedBox(height: 12)],
                  for (final (i, (label, v)) in items.indexed) ...[
                    if (i > 0) Divider(color: context.nexo.hairline),
                    SizedBox(
                      height: 44,
                      child: Row(
                        children: [
                          Expanded(child: Text(label, style: context.text.bodyMedium)),
                          Text(
                            valorODato(v),
                            style: v == null
                                ? context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)
                                : context.text.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Text(
                    m.obtenida == null
                        ? 'Meta todavía no entregó métricas.'
                        : 'Datos de ${etiquetaRed[publicacion.red]} al ${fechaHora(m.obtenida)} · ${d.historial.length} lecturas guardadas.',
                    style: context.text.bodySmall,
                  ),
                  if (d.publicacion.copyAprobado?.isNotEmpty ?? false) ...[
                    const SizedBox(height: 16),
                    Text('Lo que se publicó', style: context.text.titleSmall),
                    const SizedBox(height: 6),
                    Text(d.publicacion.copyAprobado!, style: context.text.bodyMedium),
                  ],
                  if (publicacion.permalink?.isNotEmpty ?? false) ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => launchUrl(Uri.parse(publicacion.permalink!), mode: LaunchMode.externalApplication),
                      icon: const Icon(LucideIcons.externalLink),
                      label: Text('Ver en ${etiquetaRed[publicacion.red]}'),
                    ),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

final _statsProvider = FutureProvider.autoDispose.family(
  (ref, int id) => ref.watch(socialRepositoryProvider).stats(id),
);
