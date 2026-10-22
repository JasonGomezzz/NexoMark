import 'package:flutter/material.dart';
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
import 'providers.dart';

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key});

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
    return Scaffold(
      appBar: AppBar(title: const Text('Proyectos')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: _refrescar,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: TextField(
                    controller: _buscar,
                    onChanged: (_) => setState(() {}),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Buscar por título o cliente',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: _buscar.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Borrar búsqueda',
                              onPressed: () => setState(_buscar.clear),
                              icon: const Icon(Icons.close_rounded),
                            ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(child: _Filtros(valor: _filtro, onChanged: (v) => setState(() => _filtro = v))),
              ...lista.when(
                data: (items) => _contenido(context, [...items, ..._extra]),
                loading: () => [
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList.separated(
                      itemCount: 5,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, _) => const CampaignCardSkeleton(),
                    ),
                  ),
                ],
                error: (e, _) => [
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverToBoxAdapter(
                      child: ErrorBanner(message: toApiException(e).message, onRetry: _refrescar),
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

  List<Widget> _contenido(BuildContext context, List<Campaign> items) {
    final q = _buscar.text.trim().toLowerCase();
    final visibles = items.where((c) {
      if (_filtro != null && c.estado != _filtro) return false;
      if (q.isEmpty) return true;
      return c.titulo.toLowerCase().contains(q) || c.clienteNombre.toLowerCase().contains(q);
    }).toList();
    if (visibles.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: EmptyState(
            icon: items.isEmpty ? Icons.mic_none_rounded : Icons.search_off_rounded,
            title: items.isEmpty ? 'Aún no tienes campañas' : 'Nada coincide',
            message: items.isEmpty
                ? 'Dicta tu primera idea en el Laboratorio.'
                : 'Prueba con otra palabra o quita el filtro de estado.',
            action: items.isEmpty
                ? FilledButton(onPressed: () => context.go('/m/laboratorio'), child: const Text('Ir al Laboratorio'))
                : null,
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        sliver: SliverList.separated(
          itemCount: visibles.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) => Entrance(
            key: ValueKey(visibles[i].id),
            index: i,
            child: CampaignCard(
              campaign: visibles[i],
              subtitle: '${visibles[i].clienteNombre.isEmpty ? 'Sin cliente' : visibles[i].clienteNombre} · ${fechaCorta(visibles[i].fechaCreacion)}',
              onTap: () => context.go('/m/proyectos/${visibles[i].id}', extra: visibles[i]),
            ),
          ),
        ),
      ),
      if (_hayMas && _filtro == null && q.isEmpty)
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverToBoxAdapter(
            child: OutlinedButton(
              onPressed: _cargandoMas ? null : _cargarMas,
              child: Text(_cargandoMas ? 'Cargando…' : 'Cargar más'),
            ),
          ),
        ),
    ];
  }
}

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
    ];
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: opciones.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (estado, label) = opciones[i];
          final activo = valor == estado;
          return Center(
            child: Pressable(
              onTap: () => onChanged(estado),
              child: AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                curve: Motion.easeOut,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: activo ? (context.isDark ? context.colors.primary : Nexo.navy) : context.colors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: activo ? Colors.transparent : context.colors.outlineVariant),
                ),
                child: Text(
                  label,
                  style: context.text.labelMedium?.copyWith(
                    color: activo ? (context.isDark ? context.colors.onPrimary : Nexo.onNavy) : context.colors.onSurface,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
