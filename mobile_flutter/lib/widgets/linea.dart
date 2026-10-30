import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';

/// Una estación de la línea: nombre, ícono y, si aplica, su conteo real.
class Estacion {
  const Estacion(this.nombre, this.icono, {this.conteo, this.descripcionConteo});

  final String nombre;
  final IconData icono;

  /// null = la estación no lleva conteo (Dictar, Medir) o todavía no se sabe.
  final int? conteo;

  /// Para lectores de pantalla: "9 campañas", "1 por aprobar".
  final String? descripcionConteo;
}

/// La línea como navegación principal (direcciones.md → «Banda de navegación»).
///
/// Banda marina con las estaciones unidas por la vía. La actual es un círculo
/// turquesa con el ícono del paso y un anillo `turquoise-soft`; las demás son
/// aros. El anillo se desliza a la nueva estación (240 ms); tocar no anima nada
/// más, porque se usa decenas de veces al día.
class LineaBar extends StatelessWidget {
  const LineaBar({super.key, required this.estaciones, required this.actual, required this.onSelect});

  final List<Estacion> estaciones;
  final int actual;
  final ValueChanged<int> onSelect;

  static const _alto = 74.0;
  static const _centro = 26.0;
  static const _activa = 40.0;
  static const _inactiva = 22.0;

  @override
  Widget build(BuildContext context) {
    final mover = Motion.of(context, Motion.move);
    return Material(
      color: Nexo.banda,
      child: SafeArea(
        top: false,
        child: MediaQuery.withClampedTextScaling(
          // Las etiquetas crecen hasta 1.15×: más grandes se parten a 360 dp.
          maxScaleFactor: 1.15,
          child: SizedBox(
            height: _alto,
            child: LayoutBuilder(builder: (context, c) {
              final slot = c.maxWidth / estaciones.length;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  // Vía: tramo recorrido en turquesa suave, el resto en `via`.
                  Positioned(
                    left: slot / 2,
                    right: slot / 2,
                    top: _centro - Nexo.via4 / 2,
                    child: Container(
                      height: Nexo.via4,
                      decoration: BoxDecoration(color: Nexo.via, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  // Anillo de la estación actual: se desliza.
                  AnimatedPositioned(
                    duration: mover,
                    curve: Motion.easeInOut,
                    left: slot * actual + slot / 2 - (_activa + 14) / 2,
                    top: _centro - (_activa + 14) / 2,
                    child: IgnorePointer(
                      child: Container(
                        width: _activa + 14,
                        height: _activa + 14,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Nexo.banda,
                          border: Border.all(color: Nexo.turquoiseSoft, width: 2),
                        ),
                      ),
                    ),
                  ),
                  for (var i = 0; i < estaciones.length; i++)
                    Positioned(
                      left: slot * i,
                      width: slot,
                      top: 0,
                      bottom: 0,
                      child: _EstacionBoton(
                        estacion: estaciones[i],
                        activa: i == actual,
                        onTap: () {
                          if (i != actual) HapticFeedback.selectionClick();
                          onSelect(i);
                        },
                      ),
                    ),
                ],
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _EstacionBoton extends StatelessWidget {
  const _EstacionBoton({required this.estacion, required this.activa, required this.onTap});

  final Estacion estacion;
  final bool activa;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final conteo = estacion.conteo;
    final etiqueta = [
      estacion.nombre,
      if (conteo != null) estacion.descripcionConteo ?? '$conteo',
    ].join(', ');
    return Semantics(
      button: true,
      selected: activa,
      label: etiqueta,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          children: [
            SizedBox(
              height: LineaBar._centro * 2,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  AnimatedContainer(
                    duration: Motion.of(context, Motion.fast),
                    curve: Motion.easeOut,
                    width: activa ? LineaBar._activa : LineaBar._inactiva,
                    height: activa ? LineaBar._activa : LineaBar._inactiva,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: activa ? Nexo.turquoise : Nexo.banda,
                      border: activa ? null : Border.all(color: Nexo.viaClara, width: 4),
                    ),
                    child: activa ? Icon(estacion.icono, size: 20, color: Nexo.navyDeep) : null,
                  ),
                  // El conteo va al costado del círculo, sobre la vía; 0 no se dibuja (sí se anuncia).
                  if (conteo != null && conteo > 0)
                    Transform.translate(
                      offset: Offset(activa ? 26 : 16, -13),
                      child: _Conteo(conteo),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              estacion.nombre,
              maxLines: 1,
              overflow: TextOverflow.visible,
              softWrap: false,
              style: GoogleFonts.overpass(
                fontSize: 13,
                height: 1,
                fontWeight: activa ? FontWeight.w800 : FontWeight.w600,
                color: activa ? Nexo.onNavy : Nexo.onNavyMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Conteo extends StatelessWidget {
  const _Conteo(this.valor);
  final int valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 22),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Nexo.banda2,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Nexo.banda, width: 2),
      ),
      child: Text(
        valor > 99 ? '99+' : '$valor',
        textAlign: TextAlign.center,
        style: GoogleFonts.overpass(
          fontSize: 13,
          height: 1.1,
          fontWeight: FontWeight.w800,
          color: Nexo.onNavy,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

/// Filete de 6 px que abre una sección (la "regla").
class Regla extends StatelessWidget {
  const Regla({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: Nexo.regla,
      decoration: BoxDecoration(color: context.nexo.regla, borderRadius: BorderRadius.circular(3)),
    );
  }
}

/// Encabezado de una estación: título grande (Overpass 30/800) que se pliega
/// al desplazar, como el título grande de iOS. A la derecha van las acciones
/// de segundo nivel (créditos, cuenta).
class LineaHeader extends StatelessWidget {
  const LineaHeader({super.key, required this.titulo, this.subtitulo, this.acciones = const []});

  final String titulo;
  final String? subtitulo;
  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) {
    final subtituloAlto = subtitulo == null ? 0.0 : 46.0;
    return SliverAppBar(
      pinned: true,
      expandedHeight: 104 + subtituloAlto,
      collapsedHeight: kToolbarHeight,
      toolbarHeight: kToolbarHeight,
      backgroundColor: context.colors.surface,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      titleSpacing: Nexo.gutter,
      actions: [...acciones, const SizedBox(width: 8)],
      flexibleSpace: LayoutBuilder(builder: (context, c) {
        final top = MediaQuery.paddingOf(context).top;
        final abierto = ((c.maxHeight - top - kToolbarHeight) / (104 + subtituloAlto - kToolbarHeight)).clamp(0.0, 1.0);
        return Stack(
          children: [
            // Título pequeño cuando se pliega.
            Positioned(
              left: Nexo.gutter,
              right: 120,
              top: top,
              height: kToolbarHeight,
              child: Opacity(
                opacity: (1 - abierto * 2).clamp(0.0, 1.0),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(titulo, style: context.text.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ),
            ),
            // Título grande.
            Positioned(
              left: Nexo.gutter,
              right: Nexo.gutter,
              bottom: 10,
              child: Opacity(
                opacity: ((abierto - 0.35) / 0.65).clamp(0.0, 1.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(titulo, style: context.text.displaySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    if (subtitulo != null) ...[
                      const SizedBox(height: 6),
                      Text(subtitulo!, style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
            ),
          ],
        );
      }),
    );
  }
}

/// Créditos como pastilla de segundo nivel en el encabezado.
class CreditosChip extends StatelessWidget {
  const CreditosChip({super.key, required this.disponibles, required this.onTap});

  final int? disponibles;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final valor = disponibles;
    final agotado = valor != null && valor <= 0;
    final fg = agotado ? context.colors.error : context.colors.onSurface;
    return Semantics(
      button: true,
      label: valor == null ? 'Créditos: sin dato' : 'Créditos: $valor disponibles',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        customBorder: const StadiumBorder(),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: ShapeDecoration(
                shape: StadiumBorder(side: BorderSide(color: agotado ? context.colors.error : context.colors.outlineVariant)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.zap, size: 16, color: agotado ? fg : context.colors.primary),
                  const SizedBox(width: 6),
                  Text(
                    valor == null ? 'sin dato' : '$valor',
                    style: GoogleFonts.overpass(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: fg,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Estación hueca: el círculo vacío de la línea, para estados vacíos.
class EstacionHueca extends StatelessWidget {
  const EstacionHueca({super.key, required this.icono, this.size = 64});

  final IconData icono;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: context.colors.outlineVariant, width: 4),
      ),
      child: Icon(icono, size: size * 0.38, color: context.colors.onSurfaceVariant),
    );
  }
}
