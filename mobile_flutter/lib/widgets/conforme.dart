import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';
import 'nexo_mark_logo.dart';

// La dirección "Conforme" en piezas: la mesa, el pliego con sus marcas de
// corte, la orden de trabajo (casillas), el recorrido de una campaña y el
// sello del cliente. direcciones.md → «Dirección elegida: C · Conforme».

// ── Mesa y pliego ──────────────────────────────────────────

/// Marcas de corte: un ángulo de 1.5 × 16 px en cada esquina, sobre la mesa,
/// separado 4 px del pliego (como en una prueba de imprenta).
class _MarcasCorte extends CustomPainter {
  _MarcasCorte(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = Nexo.corteGrosor
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;
    const d = 4.0;
    const l = Nexo.corteLargo;
    final w = size.width, h = size.height;
    final esquinas = [
      (Offset(-d, -d), 1.0, 1.0),
      (Offset(w + d, -d), -1.0, 1.0),
      (Offset(-d, h + d), 1.0, -1.0),
      (Offset(w + d, h + d), -1.0, -1.0),
    ];
    for (final (o, sx, sy) in esquinas) {
      canvas.drawLine(o, o + Offset(l * sx, 0), p);
      canvas.drawLine(o, o + Offset(0, l * sy), p);
    }
  }

  @override
  bool shouldRepaint(_MarcasCorte old) => old.color != color;
}

/// El pliego: la hoja clara sobre la mesa, con marcas de corte en las cuatro
/// esquinas. Su contenido no ve el área segura del sistema (la mesa la cubre).
class Pliego extends StatelessWidget {
  const Pliego({super.key, required this.child, this.margen = const EdgeInsets.fromLTRB(Nexo.margenMesa, 2, Nexo.margenMesa, Nexo.margenMesa)});

  final Widget child;
  final EdgeInsets margen;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margen,
      child: CustomPaint(
        foregroundPainter: _MarcasCorte(context.nexo.registro),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(Nexo.radiusSurface),
          child: ColoredBox(
            color: context.colors.surface,
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              removeBottom: true,
              removeLeft: true,
              removeRight: true,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Estilo de la barra de estado sobre la mesa: siempre íconos claros.
const estiloMesa = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemNavigationBarColor: Colors.transparent,
  systemNavigationBarIconBrightness: Brightness.light,
);

/// Pantalla de segundo nivel: la barra (volver y título) va sobre la mesa y
/// el contenido en el pliego. La acción del pie, si hay, queda fija al pie
/// del pliego, en la zona del pulgar. Misma forma que un `Scaffold`.
class MesaScaffold extends StatelessWidget {
  const MesaScaffold({super.key, this.appBar, required this.body, this.bottomNavigationBar});

  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? bottomNavigationBar;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: estiloMesa,
      child: Scaffold(
        backgroundColor: context.nexo.cama,
        appBar: appBar,
        body: SafeArea(
          top: false,
          child: Pliego(
            child: Scaffold(
              backgroundColor: context.colors.surface,
              body: body,
              bottomNavigationBar: bottomNavigationBar,
            ),
          ),
        ),
      ),
    );
  }
}

/// Acción al pie del pliego: separada por un hilo, siempre a mano.
class PieAccion extends StatelessWidget {
  const PieAccion({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.nexo.hairline)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Nexo.gutter, 12, Nexo.gutter, 14),
        child: child,
      ),
    );
  }
}

/// Encabezado dentro del pliego: un dato de contexto (paso de la orden,
/// cuándo se actualizó), el título en Bricolage y la regla de 1 px.
class PliegoTitulo extends StatelessWidget {
  const PliegoTitulo({super.key, required this.titulo, this.contexto, this.subtitulo, this.accion});

  final String titulo;
  final String? contexto;
  final String? subtitulo;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Nexo.gutter, 18, Nexo.gutter, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (contexto != null) ...[
                      Text(contexto!, style: context.text.bodySmall),
                      const SizedBox(height: 4),
                    ],
                    Semantics(header: true, child: Text(titulo, style: context.text.displaySmall)),
                  ],
                ),
              ),
              ?accion,
            ],
          ),
          if (subtitulo != null) ...[
            const SizedBox(height: 8),
            Text(subtitulo!, style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)),
          ],
          const SizedBox(height: 16),
          Divider(height: 1, color: context.colors.outlineVariant),
        ],
      ),
    );
  }
}

/// Regla de sección: 1 px `outline-variant`.
class Regla extends StatelessWidget {
  const Regla({super.key});

  @override
  Widget build(BuildContext context) => Divider(height: 1, thickness: 1, color: context.colors.outlineVariant);
}

// ── Casillas ───────────────────────────────────────────────

enum EstadoCasilla { porSellar, actual, sellada }

/// Borde punteado de una casilla por sellar.
class _Punteado extends CustomPainter {
  _Punteado(this.color, this.radio);
  final Color color;
  final double radio;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = Nexo.punteado
      ..style = PaintingStyle.stroke;
    final r = RRect.fromRectAndRadius((Offset.zero & size).deflate(Nexo.punteado / 2), Radius.circular(radio));
    final path = Path()..addRRect(r);
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + 3.5, m.length)), p);
        d += 6;
      }
    }
  }

  @override
  bool shouldRepaint(_Punteado old) => old.color != color || old.radio != radio;
}

/// Una casilla de la orden de trabajo. Por sellar: borde punteado. Actual:
/// rellena de turquesa con el ícono del paso. Sellada: rellena con ✓.
class Casilla extends StatelessWidget {
  const Casilla({super.key, required this.estado, required this.icono, this.size = 40, this.sobreMesa = false});

  final EstadoCasilla estado;
  final IconData icono;
  final double size;
  final bool sobreMesa;

  @override
  Widget build(BuildContext context) {
    final borde = sobreMesa ? Nexo.onNavyMuted.withValues(alpha: 0.7) : context.colors.outlineVariant;
    final tenue = sobreMesa ? Nexo.onNavyMuted : context.colors.onSurfaceVariant;
    final sellada = sobreMesa ? Nexo.turquoiseSoft : context.colors.primary;
    final (fondo, tinta, glifo) = switch (estado) {
      EstadoCasilla.actual => (Nexo.turquoise, Nexo.navyDeep, icono),
      EstadoCasilla.sellada => (sellada, sobreMesa ? Nexo.navyDeep : context.colors.onPrimary, LucideIcons.check),
      EstadoCasilla.porSellar => (Colors.transparent, tenue, icono),
    };
    return AnimatedContainer(
      duration: Motion.of(context, Motion.fast),
      curve: Motion.easeOut,
      width: size,
      height: size,
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(Nexo.radiusCasilla)),
      child: CustomPaint(
        painter: estado == EstadoCasilla.porSellar ? _Punteado(borde, Nexo.radiusCasilla) : null,
        child: Center(child: Icon(glifo, size: size * 0.48, color: tinta)),
      ),
    );
  }
}

/// Un paso de la orden de trabajo con su conteo real.
class Paso {
  const Paso(this.nombre, this.icono, {this.conteo, this.descripcionConteo});

  final String nombre;
  final IconData icono;

  /// null = sin conteo (Dictar, Medir) o todavía sin dato.
  final int? conteo;

  /// Para lectores de pantalla: "9 campañas".
  final String? descripcionConteo;
}

/// La orden de trabajo como navegación principal, sobre la mesa: cinco
/// casillas (el cliente ve tres). La actual va sellada en turquesa; las
/// demás, punteadas. Cambiar no se anima más que el sellado (160 ms): se
/// toca decenas de veces al día.
class OrdenBar extends StatelessWidget {
  const OrdenBar({super.key, required this.pasos, required this.actual, required this.onSelect});

  final List<Paso> pasos;
  final int actual;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.nexo.cama,
      child: SafeArea(
        top: false,
        child: MediaQuery.withClampedTextScaling(
          maxScaleFactor: 1.15,
          child: SizedBox(
            height: 72,
            child: Row(
              children: [
                for (var i = 0; i < pasos.length; i++)
                  Expanded(
                    child: _BotonPaso(
                      paso: pasos[i],
                      activo: i == actual,
                      onTap: () {
                        if (i != actual) HapticFeedback.selectionClick();
                        onSelect(i);
                      },
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

class _BotonPaso extends StatelessWidget {
  const _BotonPaso({required this.paso, required this.activo, required this.onTap});

  final Paso paso;
  final bool activo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final conteo = paso.conteo;
    return Semantics(
      button: true,
      selected: activo,
      label: [paso.nombre, if (conteo != null) paso.descripcionConteo ?? '$conteo'].join(', '),
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 34,
        highlightShape: BoxShape.rectangle,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Casilla(
                  estado: activo ? EstadoCasilla.actual : EstadoCasilla.porSellar,
                  icono: paso.icono,
                  size: 34,
                  sobreMesa: true,
                ),
                if (conteo != null && conteo > 0)
                  Positioned(
                    right: -14,
                    top: -7,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: context.nexo.cama2,
                        borderRadius: BorderRadius.circular(Nexo.radiusCasilla),
                        border: Border.all(color: context.nexo.cama, width: 2),
                      ),
                      child: Text(
                        conteo > 99 ? '99+' : '$conteo',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          height: 1.2,
                          fontWeight: FontWeight.w700,
                          color: Nexo.onNavy,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              paso.nombre,
              maxLines: 1,
              overflow: TextOverflow.visible,
              softWrap: false,
              style: GoogleFonts.inter(
                fontSize: 13,
                height: 1,
                fontWeight: activo ? FontWeight.w700 : FontWeight.w500,
                color: activo ? Nexo.onNavy : Nexo.onNavyMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barra superior sobre la mesa: la marca a la izquierda y, a la derecha,
/// lo de segundo nivel (créditos y cuenta).
class MesaBar extends StatelessWidget {
  const MesaBar({super.key, this.acciones = const []});

  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: estiloMesa,
      child: ColoredBox(
        color: context.nexo.cama,
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 56,
            child: Row(
              children: [
                const SizedBox(width: Nexo.gutter),
                Semantics(
                  label: 'NexoMark IA',
                  excludeSemantics: true,
                  child: Row(
                    children: [
                      const NexoMarkLogo(size: 30),
                      const SizedBox(width: 6),
                      Text(
                        'NexoMark',
                        style: GoogleFonts.bricolageGrotesque(fontSize: 19, fontWeight: FontWeight.w800, color: Nexo.onNavy, letterSpacing: -0.3),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                ...acciones,
                const SizedBox(width: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Créditos como pastilla sobre la mesa (segundo nivel).
class CreditosChip extends StatelessWidget {
  const CreditosChip({super.key, required this.disponibles, required this.onTap});

  final int? disponibles;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final valor = disponibles;
    final agotado = valor != null && valor <= 0;
    return Semantics(
      button: true,
      label: valor == null ? 'Créditos: sin dato' : valor == 1 ? 'Créditos: 1 disponible' : 'Créditos: $valor disponibles',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Nexo.radiusField),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: context.nexo.cama2,
                borderRadius: BorderRadius.circular(Nexo.radiusField),
                border: agotado ? Border.all(color: Nexo.onNavyError) : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.zap, size: 16, color: agotado ? Nexo.onNavyError : Nexo.turquoiseSoft),
                  const SizedBox(width: 6),
                  Text(
                    valor == null ? 'sin dato' : '$valor',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: agotado ? Nexo.onNavyError : Nexo.onNavy,
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

// ── Sello ──────────────────────────────────────────────────

/// Sello «conforme»: círculo con la N y, si se sabe, la versión que aprobó
/// el cliente. [encaje] va de 1 (la pieza de quien aprueba fuera) a 0
/// (encajada); con eso se anima la aprobación.
class Sello extends StatelessWidget {
  const Sello({super.key, this.size = 48, this.version, this.encaje, this.sobreMesa = false});

  final double size;
  final int? version;
  final Animation<double>? encaje;
  final bool sobreMesa;

  @override
  Widget build(BuildContext context) {
    final tinta = sobreMesa ? Nexo.turquoiseSoft : context.colors.primary;
    final fondo = sobreMesa ? context.nexo.cama : context.colors.surfaceContainerLowest;
    final crea = sobreMesa ? Nexo.onNavy : context.colors.onSurface;
    return Semantics(
      label: version == null ? 'Sello conforme del cliente' : 'Sello conforme del cliente, versión $version',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: fondo,
          border: Border.all(color: tinta, width: math.max(2, size / 28)),
        ),
        padding: EdgeInsets.all(size * 0.07),
        child: Container(
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: tinta.withValues(alpha: 0.55), width: 1)),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Align(
                alignment: version == null ? Alignment.center : const Alignment(0, -0.32),
                child: NexoMarkLogo(
                  size: size * (version == null ? 0.78 : 0.56),
                  teal: encaje ?? kAlwaysDismissedAnimation,
                  colorCrea: crea,
                  colorAprueba: tinta,
                ),
              ),
              if (version != null)
                Align(
                  alignment: const Alignment(0, 0.72),
                  child: Text(
                    'v$version',
                    textScaler: TextScaler.noScaling,
                    style: GoogleFonts.inter(fontSize: math.max(10, size * 0.2), height: 1, fontWeight: FontWeight.w800, color: tinta),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Recorrido ──────────────────────────────────────────────

const pasosFlujo = ['Dictar', 'Generar', 'Aprobar', 'Publicar', 'Medir'];
const _iconosFlujo = [LucideIcons.mic, LucideIcons.wandSparkles, LucideIcons.stamp, LucideIcons.send, LucideIcons.chartColumn];

/// El recorrido de una campaña: cinco casillas en fila. Las hechas van
/// selladas con ✓; la actual, en turquesa con su ícono; las demás, punteadas.
class FlowStepper extends StatelessWidget {
  const FlowStepper({super.key, required this.current, this.onNavy = false});

  final int current;
  final bool onNavy;

  @override
  Widget build(BuildContext context) {
    final paso = current.clamp(0, pasosFlujo.length - 1);
    final tinta = onNavy ? Nexo.onNavy : context.colors.onSurface;
    final tenue = onNavy ? Nexo.onNavyMuted : context.colors.onSurfaceVariant;
    return Semantics(
      label: 'Paso ${paso + 1} de ${pasosFlujo.length}: ${pasosFlujo[paso]}',
      excludeSemantics: true,
      child: Row(
        children: [
          for (var i = 0; i < pasosFlujo.length; i++)
            Expanded(
              child: Column(
                children: [
                  Casilla(
                    estado: i < paso ? EstadoCasilla.sellada : (i == paso ? EstadoCasilla.actual : EstadoCasilla.porSellar),
                    icono: _iconosFlujo[i],
                    size: 30,
                    sobreMesa: onNavy,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    pasosFlujo[i],
                    maxLines: 1,
                    overflow: TextOverflow.visible,
                    softWrap: false,
                    style: context.text.labelMedium?.copyWith(
                      fontWeight: i == paso ? FontWeight.w700 : FontWeight.w500,
                      color: i <= paso ? tinta : tenue,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Estados vacíos ─────────────────────────────────────────

/// Casilla por sellar grande: para estados vacíos.
class CasillaVacia extends StatelessWidget {
  const CasillaVacia({super.key, required this.icono, this.size = 64});

  final IconData icono;
  final double size;

  @override
  Widget build(BuildContext context) => Casilla(estado: EstadoCasilla.porSellar, icono: icono, size: size);
}
