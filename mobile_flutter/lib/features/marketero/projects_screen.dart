import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/conforme.dart';
import '../../widgets/nexo_widgets.dart';
import 'providers.dart';

/// Qué tramo de la línea muestra la lista.
enum TramoCampanas {
  generar(
    'Generar',
    'La IA escribe el texto y crea la imagen. Revisa y envía al cliente.',
    {EstadoCampana.borrador, EstadoCampana.pendienteIa, EstadoCampana.generado, EstadoCampana.rechazado},
  ),
  aprobar('Aprobar', 'Esperan la decisión del cliente.', {EstadoCampana.pendienteAprobacion}),
  publicar('Publicar', 'Aprobadas por el cliente: lo aprobado es lo que se publica.', {EstadoCampana.aprobado}),
  todas('Todas las campañas', null, {});

  const TramoCampanas(this.titulo, this.subtitulo, this.estados);
  final String titulo;
  final String? subtitulo;
  final Set<EstadoCampana> estados;

  bool incluye(EstadoCampana e) => estados.isEmpty || estados.contains(e);
}

/// Conteo real de cada tramo (lo que lleva la estación en la línea).
int conteoTramo(CampaignStats s, TramoCampanas t) => switch (t) {
      TramoCampanas.generar => s.borrador + s.pendienteIa + s.generado + s.rechazado,
      TramoCampanas.aprobar => s.pendienteAprobacion,
      TramoCampanas.publicar => s.aprobado,
      TramoCampanas.todas => s.total,
    };

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key, this.tramo = TramoCampanas.todas});

  final TramoCampanas tramo;

  @override
  ConsumerState<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends ConsumerState<ProjectsScreen> {
  final _buscar = TextEditingController();
  EstadoCampana? _filtro;
  final _extra = <Campaign>[];
  int _pagina = 1;
  bool _hayMas = false;
  bool _cargandoMas = false;

  bool get _esEstacion => widget.tramo != TramoCampanas.todas;

  @override
  void dispose() {
    _buscar.dispose();
    super.dispose();
  }

  Future<void> _refrescar() async {
    setState(() {
      _extra.clear();
      _pagina = 1;
    });
    ref.invalidate(campaignListProvider);
    ref.invalidate(campaignStatsProvider);
    try {
      await ref.read(campaignListProvider.future);
    } catch (_) {
      // El error se muestra en la lista.
    }
  }

  Future<void> _cargarMas() async {
    setState(() => _cargandoMas = true);
    try {
      final page = await ref.read(campaignRepositoryProvider).list(page: _pagina + 1);
      setState(() {
        _pagina++;
        _extra.addAll(page.items);
        _hayMas = page.hayMas;
      });
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _cargandoMas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lista = ref.watch(campaignListProvider);
    // La primera página dice si hay más (20 por página en Django).
    if (_pagina == 1) _hayMas = (lista.value?.length ?? 0) >= 20;
    final cuerpo = <Widget>[
      if (!_esEstacion) ...[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 4, Nexo.gutter, 8),
          sliver: SliverToBoxAdapter(child: _Buscador(controller: _buscar, onChanged: () => setState(() {}))),
        ),
        SliverToBoxAdapter(child: _Filtros(valor: _filtro, onChanged: (v) => setState(() => _filtro = v))),
      ],
      ...lista.when(
        data: (items) => _contenido(context, [...items, ..._extra]),
        loading: () => [
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
            sliver: SliverList.separated(
              itemCount: 5,
              separatorBuilder: (_, _) => const Divider(),
              itemBuilder: (_, _) => const CampaignCardSkeleton(),
            ),
          ),
        ],
        error: (e, _) => [
          SliverPadding(
            padding: const EdgeInsets.all(Nexo.gutter),
            sliver: SliverToBoxAdapter(child: ErrorBanner(message: toApiException(e).message, onRetry: _refrescar)),
          ),
        ],
      ),
    ];

    final contenido = Scaffold(
      backgroundColor: context.colors.surface,
      body: RefreshIndicator(
        onRefresh: _refrescar,
        
        child: CustomScrollView(
          slivers: [
            if (_esEstacion)
              SliverToBoxAdapter(child: PliegoTitulo(titulo: widget.tramo.titulo, subtitulo: widget.tramo.subtitulo)),
            ...cuerpo,
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
    return _esEstacion ? contenido : MesaScaffold(appBar: AppBar(title: Text(widget.tramo.titulo)), body: contenido);
  }

  List<Widget> _contenido(BuildContext context, List<Campaign> items) {
    final q = _buscar.text.trim().toLowerCase();
    final visibles = items.where((c) {
      if (!widget.tramo.incluye(c.estado)) return false;
      if (_filtro != null && c.estado != _filtro) return false;
      if (q.isEmpty) return true;
      return c.titulo.toLowerCase().contains(q) || c.clienteNombre.toLowerCase().contains(q);
    }).toList();
    if (visibles.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: _Vacio(tramo: widget.tramo, sinCampanas: items.isEmpty, buscando: q.isNotEmpty || _filtro != null),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
        sliver: SliverList.separated(
          itemCount: visibles.length,
          separatorBuilder: (_, _) => const Divider(),
          itemBuilder: (context, i) => CampaignCard(
            key: ValueKey(visibles[i].id),
            campaign: visibles[i],
            subtitle: '${visibles[i].clienteNombre.isEmpty ? 'Sin cliente' : visibles[i].clienteNombre} · ${fechaCorta(visibles[i].fechaCreacion)}',
            onTap: () => context.push('/m/campana/${visibles[i].id}', extra: visibles[i]),
          ),
        ),
      ),
      if (_hayMas && _filtro == null && q.isEmpty)
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 12, Nexo.gutter, 0),
          sliver: SliverToBoxAdapter(
            child: OutlinedButton(
              onPressed: _cargandoMas ? null : _cargarMas,
              child: Text(_cargandoMas ? 'Cargando…' : 'Cargar más'),
            ),
          ),
        ),
      if (_esEstacion)
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 8, Nexo.gutter, 0),
          sliver: SliverToBoxAdapter(
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => context.push('/m/campanas'),
                icon: const Icon(LucideIcons.listFilter, size: 18),
                label: const Text('Ver todas las campañas'),
              ),
            ),
          ),
        ),
    ];
  }
}

class _Vacio extends StatelessWidget {
  const _Vacio({required this.tramo, required this.sinCampanas, required this.buscando});

  final TramoCampanas tramo;
  final bool sinCampanas;
  final bool buscando;

  @override
  Widget build(BuildContext context) {
    final (icono, titulo, mensaje) = switch (tramo) {
      _ when buscando => (LucideIcons.searchX, 'Nada coincide', 'Prueba con otra palabra o quita el filtro de estado.'),
      _ when sinCampanas => (LucideIcons.mic, 'Aún no tienes campañas', 'Dicta tu primera idea y la IA preparará el texto y la imagen.'),
      TramoCampanas.generar => (LucideIcons.wandSparkles, 'Nada en Generar', 'Las campañas que dictes aparecen aquí mientras la IA trabaja.'),
      TramoCampanas.aprobar => (LucideIcons.checkCheck, 'Nada esperando al cliente', 'Cuando envíes una campaña, esperará aquí su aprobación.'),
      TramoCampanas.publicar => (LucideIcons.send, 'Nada aprobado todavía', 'Lo que el cliente apruebe pasa aquí y se publica en sus destinos.'),
      TramoCampanas.todas => (LucideIcons.folder, 'Sin campañas', 'Dicta tu primera idea.'),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(Nexo.gutter, 24, Nexo.gutter, 24),
      child: EmptyState(
        icon: icono,
        title: titulo,
        message: mensaje,
        action: sinCampanas || tramo == TramoCampanas.generar
            ? FilledButton.icon(
                onPressed: () => context.go('/m/dictar'),
                icon: const Icon(LucideIcons.mic, size: 18),
                label: const Text('Dictar una campaña'),
              )
            : null,
      ),
    );
  }
}

class _Buscador extends StatelessWidget {
  const _Buscador({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: (_) => onChanged(),
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'Buscar por título o cliente',
        prefixIcon: const Icon(LucideIcons.search, size: 20),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Borrar búsqueda',
                onPressed: () {
                  controller.clear();
                  onChanged();
                },
                icon: const Icon(LucideIcons.x, size: 20),
              ),
      ),
    );
  }
}

/// Filtros de "Todas las campañas". Sin animación: se tocan muchas veces.
class _Filtros extends StatelessWidget {
  const _Filtros({required this.valor, required this.onChanged});

  final EstadoCampana? valor;
  final ValueChanged<EstadoCampana?> onChanged;

  @override
  Widget build(BuildContext context) {
    final opciones = <(EstadoCampana?, String)>[
      (null, 'Todas'),
      (EstadoCampana.generado, 'Generadas'),
      (EstadoCampana.pendienteAprobacion, 'Por aprobar'),
      (EstadoCampana.aprobado, 'Aprobadas'),
      (EstadoCampana.rechazado, 'Rechazadas'),
      (EstadoCampana.borrador, 'Borradores'),
      (EstadoCampana.fracaso, 'Cerradas'),
    ];
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Nexo.gutter),
        itemCount: opciones.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (estado, label) = opciones[i];
          final activo = valor == estado;
          return Center(
            child: ChoiceChip(
              label: Text(label),
              selected: activo,
              showCheckmark: false,
              onSelected: (_) => onChanged(estado),
              backgroundColor: context.colors.surfaceContainerLowest,
              selectedColor: context.colors.primary,
              side: BorderSide(color: activo ? context.colors.primary : context.colors.outlineVariant),
              labelStyle: context.text.labelMedium?.copyWith(color: activo ? context.colors.onPrimary : context.colors.onSurface),
              materialTapTargetSize: MaterialTapTargetSize.padded,
            ),
          );
        },
      ),
    );
  }
}
