import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../../widgets/publication_widgets.dart';
import '../marketero/providers.dart' show xConfigProvider;

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Estadísticas'),
        actions: [
          if (user?.rol == Rol.marketero)
            IconButton(
              tooltip: 'Actualizar métricas',
              icon: const Icon(Icons.sync_rounded),
              onPressed: () async {
                try {
                  final m = await ref.read(socialRepositoryProvider).refreshMetrics();
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
                  await refrescar();
                } on ApiException catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                }
              },
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: refrescar,
          child: summary.when(
            loading: () => ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                Skeleton(height: 40, radius: 99),
                SizedBox(height: 16),
                Skeleton(height: 260, radius: Nexo.radiusPanel),
                SizedBox(height: 12),
                Skeleton(height: 260, radius: Nexo.radiusPanel),
              ],
            ),
            error: (e, _) => ListView(
              padding: const EdgeInsets.all(16),
              children: [ErrorBanner(message: toApiException(e).message, onRetry: refrescar)],
            ),
            data: (s) {
              final anios = {...s.anios, DateTime.now().year, anio}.toList()..sort((a, b) => b.compareTo(a));
              final redes = ['instagram', 'facebook', 'x', 'tiktok'].where((red) {
                final datos = s.redes[red];
                if (datos == null) return false;
                if (red == 'instagram' || red == 'facebook') return true;
                return (red == 'x' && xActivo) || datos.publicaciones > 0;
              }).toList();
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                children: [
                  _SelectorAnio(anios: anios, valor: anio, onChanged: (v) => ref.read(_anioProvider.notifier).set(v)),
                  const SizedBox(height: 14),
                  Entrance(
                    child: IntrinsicHeight(
                      child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(child: MetricCard(label: 'Publicadas en $anio', value: s.totalPublicaciones, icon: Icons.public_rounded)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: MetricCard(
                            label: 'Esperando aprobación',
                            value: s.pendientes,
                            icon: Icons.hourglass_top_rounded,
                            accent: context.nexo.warning,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: MetricCard(label: 'Fallidas', value: s.fallidas, icon: Icons.error_outline_rounded, accent: context.colors.error),
                        ),
                      ],
                    ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  for (final (i, red) in redes.indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Entrance(index: 1 + i, child: _PanelRed(resumen: s.redes[red]!, summary: s)),
                    ),
                  const SizedBox(height: 12),
                  const SectionTitle('Por publicación', subtitle: 'Toca una para ver todas sus métricas.'),
                  ...pubs.when(
                    data: (lista) {
                      final visibles = lista.where((p) => p.estado == 'publicado' || p.estado == 'en_buzon').toList();
                      if (visibles.isEmpty) {
                        return [
                          EmptyState(
                            icon: Icons.insights_rounded,
                            title: 'Sin publicaciones en $anio',
                            message: user?.rol == Rol.cliente
                                ? 'Cuando apruebes una campaña con destinos, verás aquí cómo le va.'
                                : 'Cuando un cliente apruebe una campaña con destinos, verás aquí cómo le va.',
                          ),
                        ];
                      }
                      return [
                        for (final (i, p) in visibles.indexed)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Entrance(
                              index: i,
                              child: PublicationTile(
                                publicacion: p,
                                onTap: () => showModalBottomSheet<void>(
                                  context: context,
                                  useRootNavigator: true,
                                  isScrollControlled: true,
                                  builder: (_) => _DetallePublicacion(publicacion: p),
                                ),
                              ),
                            ),
                          ),
                      ];
                    },
                    loading: () => [const Skeleton(height: 120, radius: Nexo.radiusCard)],
                    error: (e, _) => [ErrorBanner(message: toApiException(e).message)],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _SelectorAnio extends StatelessWidget {
  const _SelectorAnio({required this.anios, required this.valor, required this.onChanged});

  final List<int> anios;
  final int valor;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: anios.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final activo = anios[i] == valor;
          return Pressable(
            onTap: () => onChanged(anios[i]),
            child: AnimatedContainer(
              duration: Motion.of(context, Motion.fast),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: activo ? context.colors.primary : context.colors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: activo ? context.colors.primary : context.colors.outlineVariant),
              ),
              child: Text(
                '${anios[i]}',
                style: context.text.labelLarge?.copyWith(color: activo ? context.colors.onPrimary : context.colors.onSurface),
              ),
            ),
          );
        },
      ),
    );
  }
}

Color colorRed(BuildContext context, String red) => switch (red) {
      'instagram' => Nexo.instagram,
      'facebook' => Nexo.facebook,
      _ => context.colors.onSurface,
    };

/// Nivel 1: una red, con su logo grande, totales y 12 meses de barras.
class _PanelRed extends StatefulWidget {
  const _PanelRed({required this.resumen, required this.summary});

  final NetworkSummary resumen;
  final StatsSummary summary;

  @override
  State<_PanelRed> createState() => _PanelRedState();
}

class _PanelRedState extends State<_PanelRed> {
  bool _meGusta = false;

  @override
  Widget build(BuildContext context) {
    final r = widget.resumen;
    final m = r.metricas;
    final sinMetricas = r.red == 'tiktok' || r.red == 'x';
    final etiquetaLikes = r.red == 'facebook' ? 'Reacciones' : 'Me gusta';
    return NexoCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              NetworkIcon(r.red, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(etiquetaRed[r.red] ?? r.red, style: context.text.titleLarge),
                    Text(
                      '${formatoNumero(r.publicaciones)} publicadas · ${formatoNumero(r.publicacionesMes)} este mes',
                      style: context.text.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (sinMetricas)
            Text(
              'Sin dato: ${etiquetaRed[r.red]} no entrega métricas con los permisos actuales.',
              style: context.text.bodySmall,
            )
          else
            Row(
              children: [
                _Total(etiquetaLikes, m.meGusta),
                _Total('Comentarios', m.comentarios),
                _Total('Compartidos', m.compartidos),
                _Total('Alcance', m.alcance),
              ],
            ),
          if (!sinMetricas && r.publicaciones > 0 && r.conMetricas < r.publicaciones) ...[
            const SizedBox(height: 8),
            Text(
              '${r.conMetricas} de ${r.publicaciones} publicaciones ya tienen métricas; Meta puede tardar hasta 48 h.',
              style: context.text.bodySmall,
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  _meGusta ? '$etiquetaLikes por mes' : 'Publicaciones por mes',
                  style: context.text.labelLarge,
                ),
              ),
              if (!sinMetricas)
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(visualDensity: VisualDensity.compact),
                  segments: [
                    const ButtonSegment(value: false, label: Text('Posts')),
                    ButtonSegment(value: true, label: Text(etiquetaLikes)),
                  ],
                  selected: {_meGusta},
                  onSelectionChanged: (v) => setState(() => _meGusta = v.first),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 150,
            child: _BarrasMes(
              red: r.red,
              serie: _meGusta ? widget.summary.meGustaPorMes : widget.summary.publicacionesPorMes,
              unidad: _meGusta ? etiquetaLikes.toLowerCase() : 'publicaciones',
            ),
          ),
        ],
      ),
    );
  }
}

class _Total extends StatelessWidget {
  const _Total(this.label, this.valor);
  final String label;
  final int? valor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          valor == null
              ? Text('sin dato', style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant))
              : CountUp(value: valor!, style: context.text.titleLarge, format: formatoNumero),
          Text(label, style: context.text.bodySmall),
        ],
      ),
    );
  }
}

/// 12 meses de una sola serie (un gráfico por red, sin leyenda: el título lo
/// nombra). Barras finas con la punta redondeada y ancladas a la base; un mes
/// sin dato no dibuja barra y el toque lo dice. Las barras crecen desde la
/// base una vez al aparecer.
class _BarrasMes extends StatefulWidget {
  const _BarrasMes({required this.red, required this.serie, required this.unidad});

  final String red;
  final List<MonthPoint> serie;
  final String unidad;

  @override
  State<_BarrasMes> createState() => _BarrasMesState();
}

class _BarrasMesState extends State<_BarrasMes> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final color = colorRed(context, widget.red);
    final meses = DateFormat.MMM('es');
    final valores = [for (final p in widget.serie) p.valores[widget.red]];
    final maximo = valores.whereType<int>().fold<int>(0, (a, b) => a > b ? a : b);
    final techo = maximo == 0 ? 4.0 : (maximo * 1.2).ceilToDouble();
    final animar = _visible || Motion.reduced(context);
    return Semantics(
      label: '${widget.unidad} por mes en ${etiquetaRed[widget.red]}: '
          '${[for (final (i, v) in valores.indexed) '${meses.format(DateTime(2000, i + 1))} ${valorODato(v)}'].join(', ')}',
      child: BarChart(
        duration: Motion.of(context, const Duration(milliseconds: 600)),
        curve: Motion.easeOut,
        BarChartData(
          maxY: techo,
          minY: 0,
          alignment: BarChartAlignment.spaceBetween,
          gridData: FlGridData(
            drawVerticalLine: false,
            horizontalInterval: techo / 2,
            getDrawingHorizontalLine: (_) => FlLine(color: context.colors.outlineVariant.withValues(alpha: 0.6), strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                interval: techo / 2,
                getTitlesWidget: (v, meta) => Text(
                  v == 0 ? '0' : NumberFormat.compact(locale: 'es').format(v),
                  style: context.text.bodySmall,
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 22,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  // Un rótulo cada tres meses: a 360 dp los doce no caben sin pisarse.
                  if (i % 3 != 0) return const SizedBox.shrink();
                  return Text(meses.format(DateTime(2000, i + 1)).replaceAll('.', ''), style: context.text.bodySmall);
                },
              ),
            ),
          ),
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => context.colors.inverseSurface,
              tooltipBorderRadius: BorderRadius.circular(8),
              getTooltipItem: (group, _, rod, _) => BarTooltipItem(
                '${meses.format(DateTime(2000, group.x + 1))}: ${valorODato(valores[group.x])} ${widget.unidad}',
                context.text.bodySmall!.copyWith(color: context.colors.onInverseSurface),
              ),
            ),
          ),
          barGroups: [
            for (final (i, v) in valores.indexed)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: animar ? (v ?? 0).toDouble() : 0,
                    width: 10,
                    color: color,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    backDrawRodData: BackgroundBarChartRodData(
                      show: true,
                      toY: techo,
                      color: Colors.transparent,
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
            loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
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
                  if (d.aviso != null) ...[InfoBanner(message: d.aviso!), const SizedBox(height: 12)],
                  LayoutBuilder(
                    builder: (context, c) => Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        for (final (label, v) in items)
                          SizedBox(width: (c.maxWidth - 10) / 2, child: MetricCard(label: label, value: v)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    m.obtenida == null
                        ? 'Meta todavía no entregó métricas.'
                        : 'Datos de ${etiquetaRed[publicacion.red]} al ${fechaHora(m.obtenida)} · ${d.historial.length} lecturas guardadas.',
                    style: context.text.bodySmall,
                  ),
                  if (d.publicacion.copyAprobado?.isNotEmpty ?? false) ...[
                    const SizedBox(height: 16),
                    Text('Lo que se publicó', style: context.text.labelLarge),
                    const SizedBox(height: 6),
                    NexoCard(child: Text(d.publicacion.copyAprobado!, style: context.text.bodyMedium)),
                  ],
                  if (publicacion.permalink?.isNotEmpty ?? false) ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => launchUrl(Uri.parse(publicacion.permalink!), mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.open_in_new_rounded),
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
