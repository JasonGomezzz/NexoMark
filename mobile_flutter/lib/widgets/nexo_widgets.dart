import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/cupertino.dart' show CupertinoDialogAction;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat, NumberFormat;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';
import '../data/models.dart';
import 'linea.dart';
import 'motion_widgets.dart';

final _miles = NumberFormat.decimalPattern('es_PE');
String formatoNumero(int v) => _miles.format(v);

/// "sin dato" cuando el proveedor no lo informa; nunca 0 ni "—".
String valorODato(int? v) => v == null ? 'sin dato' : formatoNumero(v);

// ── Marca ──────────────────────────────────────────────────

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 28, this.onNavy = false});

  final double size;
  final bool onNavy;

  @override
  Widget build(BuildContext context) {
    final ink = onNavy ? Nexo.onNavy : context.colors.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.24),
          child: Image.asset('assets/brand/nexomark-icon.png', width: size, height: size),
        ),
        SizedBox(width: size * 0.32),
        Text(
          'NexoMark',
          style: TextStyle(fontSize: size * 0.68, fontWeight: FontWeight.w800, color: ink, letterSpacing: -0.4),
        ),
        SizedBox(width: size * 0.18),
        Container(
          padding: EdgeInsets.symmetric(horizontal: size * 0.2, vertical: size * 0.04),
          decoration: BoxDecoration(
            color: onNavy ? Nexo.turquoise : context.colors.primary,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            'IA',
            style: TextStyle(
              fontSize: math.max(size * 0.42, 11),
              fontWeight: FontWeight.w800,
              color: onNavy ? Nexo.navyDeep : context.colors.onPrimary,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Estado de campaña ──────────────────────────────────────

({Color bg, Color fg}) coloresEstado(BuildContext context, EstadoCampana estado) {
  final c = context.colors;
  final n = context.nexo;
  return switch (estado) {
    EstadoCampana.borrador => (bg: c.surfaceContainerHigh, fg: c.onSurfaceVariant),
    EstadoCampana.pendienteIa => (bg: c.primaryFixed, fg: c.onPrimaryFixed),
    EstadoCampana.generado => (bg: c.secondaryContainer, fg: c.onSecondaryContainer),
    EstadoCampana.pendienteAprobacion => (bg: n.warningContainer, fg: n.warning),
    EstadoCampana.aprobado => (bg: n.successContainer, fg: n.success),
    EstadoCampana.rechazado => (bg: c.errorContainer, fg: c.onErrorContainer),
    EstadoCampana.fracaso => (bg: c.errorContainer, fg: c.onErrorContainer),
  };
}

/// Píldora del estado FSM. Cuando el estado cambia solo (la IA termina), el
/// color se interpola y el texto entra con un fundido: se nota el cambio.
class StatePill extends StatelessWidget {
  const StatePill(this.estado, {super.key, this.dense = false});

  final EstadoCampana estado;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final colores = coloresEstado(context, estado);
    return AnimatedContainer(
      duration: Motion.of(context, Motion.base),
      curve: Motion.easeOut,
      padding: EdgeInsets.symmetric(horizontal: dense ? 10 : 12, vertical: dense ? 4 : 6),
      decoration: BoxDecoration(color: colores.bg, borderRadius: BorderRadius.circular(999)),
      child: SwapIn(
        child: Row(
          key: ValueKey(estado),
          mainAxisSize: MainAxisSize.min,
          children: [
            if (estado == EstadoCampana.pendienteIa) ...[
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2, color: colores.fg),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              estado.etiqueta,
              style: context.text.labelMedium?.copyWith(color: colores.fg),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Redes ──────────────────────────────────────────────────

const etiquetaRed = {
  'instagram': 'Instagram',
  'facebook': 'Facebook',
  'x': 'X',
  'tiktok': 'TikTok',
  'twitter': 'X',
  'linkedin': 'LinkedIn',
  'google_ads': 'Google Ads',
};

/// Logo simplificado de cada red. Instagram y Facebook con su color; X y
/// TikTok en la tinta del tema (DESIGN.md: monocromo, nunca de fondo grande).
class NetworkIcon extends StatelessWidget {
  const NetworkIcon(this.red, {super.key, this.size = 24});

  final String red;
  final double size;

  @override
  Widget build(BuildContext context) {
    final ink = context.colors.onSurface;
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: switch (red) {
          'instagram' => _InstagramPainter(Nexo.instagram),
          'facebook' => _FacebookPainter(Nexo.facebook),
          'x' || 'twitter' => _XPainter(ink),
          'tiktok' => _TikTokPainter(ink),
          _ => _GenericPainter(context.colors.onSurfaceVariant),
        },
      ),
    );
  }
}

class _InstagramPainter extends CustomPainter {
  _InstagramPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.09;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(s * 0.1, s * 0.1, s * 0.8, s * 0.8), Radius.circular(s * 0.24)),
      stroke,
    );
    canvas.drawCircle(Offset(s / 2, s / 2), s * 0.19, stroke);
    canvas.drawCircle(Offset(s * 0.71, s * 0.29), s * 0.055, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _InstagramPainter old) => old.color != color;
}

class _FacebookPainter extends CustomPainter {
  _FacebookPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    canvas.drawCircle(Offset(s / 2, s / 2), s / 2, Paint()..color = color);
    final tp = TextPainter(
      text: TextSpan(
        text: 'f',
        style: TextStyle(color: Colors.white, fontSize: s * 0.78, fontWeight: FontWeight.w800, height: 1),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset((s - tp.width) / 2 + s * 0.04, s * 0.2));
  }

  @override
  bool shouldRepaint(covariant _FacebookPainter old) => old.color != color;
}

class _XPainter extends CustomPainter {
  _XPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final thin = Paint()
      ..color = color
      ..strokeWidth = s * 0.08
      ..strokeCap = StrokeCap.round;
    final thick = Paint()
      ..color = color
      ..strokeWidth = s * 0.17
      ..strokeCap = StrokeCap.butt;
    canvas.drawLine(Offset(s * 0.18, s * 0.14), Offset(s * 0.82, s * 0.86), thick);
    canvas.drawLine(Offset(s * 0.82, s * 0.14), Offset(s * 0.2, s * 0.86), thin);
  }

  @override
  bool shouldRepaint(covariant _XPainter old) => old.color != color;
}

class _TikTokPainter extends CustomPainter {
  _TikTokPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.12
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(Offset(s * 0.38, s * 0.68), s * 0.17, paint);
    canvas.drawLine(Offset(s * 0.55, s * 0.68), Offset(s * 0.55, s * 0.12), paint);
    final path = Path()
      ..moveTo(s * 0.55, s * 0.12)
      ..quadraticBezierTo(s * 0.62, s * 0.34, s * 0.84, s * 0.36);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _TikTokPainter old) => old.color != color;
}

class _GenericPainter extends CustomPainter {
  _GenericPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      size.width * 0.38,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.08,
    );
  }

  @override
  bool shouldRepaint(covariant _GenericPainter old) => old.color != color;
}

class NetworkChip extends StatelessWidget {
  const NetworkChip({super.key, required this.red, this.label});

  final String red;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.colors.outlineVariant),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          NetworkIcon(red, size: 18),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label ?? etiquetaRed[red] ?? red,
              style: context.text.labelMedium,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Diálogos ───────────────────────────────────────────────

/// Confirmación nativa: alerta de iOS en iPhone y diálogo Material en Android.
/// Solo para decisiones que de verdad deben interrumpir.
Future<bool> confirmarAccion(
  BuildContext context, {
  required String titulo,
  required String mensaje,
  required String accion,
  String cancelar = 'Cancelar',
  bool destructivo = false,
}) async {
  final ios = Theme.of(context).platform == TargetPlatform.iOS;
  Widget boton(BuildContext ctx, String texto, bool valor, {bool principal = false}) {
    void cerrar() => Navigator.pop(ctx, valor);
    if (ios) {
      return CupertinoDialogAction(
        isDefaultAction: principal && !destructivo,
        isDestructiveAction: principal && destructivo,
        onPressed: cerrar,
        child: Text(texto),
      );
    }
    if (!principal) return TextButton(onPressed: cerrar, child: Text(texto));
    return FilledButton(
      onPressed: cerrar,
      style: destructivo ? FilledButton.styleFrom(backgroundColor: ctx.colors.error, foregroundColor: ctx.colors.onError) : null,
      child: Text(texto),
    );
  }

  final r = await showAdaptiveDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog.adaptive(
      title: Text(titulo),
      content: Text(mensaje),
      actions: [boton(ctx, cancelar, false), boton(ctx, accion, true, principal: true)],
    ),
  );
  return r ?? false;
}

// ── Superficies ────────────────────────────────────────────

/// Tarjeta NexoMark: tono + borde fino, sin sombra en reposo.
class NexoCard extends StatelessWidget {
  const NexoCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? context.colors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Nexo.radiusSurface),
        border: Border.all(color: context.colors.outlineVariant),
      ),
      child: child,
    );
    return onTap == null ? card : Pressable(onTap: onTap, child: card);
  }
}

/// Panel marino: el "contenedor" de la idea gráfica de la N.
class NavyPanel extends StatelessWidget {
  const NavyPanel({super.key, required this.child, this.padding = const EdgeInsets.all(20)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(color: Nexo.navy, borderRadius: BorderRadius.circular(Nexo.radiusSurface)),
      child: DefaultTextStyle.merge(style: const TextStyle(color: Nexo.onNavy), child: child),
    );
  }
}

/// Una cifra con su rótulo. Sin tarjeta: las cifras se separan con hilos.
/// Un dato que no existe se escribe "sin dato", nunca 0.
class MetricCard extends StatelessWidget {
  const MetricCard({super.key, required this.label, required this.value, this.icon, this.accent});

  final String label;
  final int? value;
  final IconData? icon;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label: ${valorODato(value)}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            value == null
                ? Text('sin dato', style: context.text.titleLarge?.copyWith(color: context.colors.onSurfaceVariant))
                : CountUp(value: value!, style: context.text.displayMedium?.copyWith(color: accent), format: formatoNumero),
            const SizedBox(height: 4),
            Row(
              children: [
                if (icon != null) ...[Icon(icon, size: 14, color: accent ?? context.colors.onSurfaceVariant), const SizedBox(width: 5)],
                Flexible(child: Text(label, style: context.text.bodySmall)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Título de sección. Abre con la regla de 6 px (la línea marca el inicio).
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.trailing, this.subtitle, this.regla = true});

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool regla;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (regla) ...[const Regla(), const SizedBox(height: 12)],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(title, style: context.text.headlineSmall)),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(subtitle!, style: context.text.bodySmall),
                    ],
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          EstacionHueca(icono: icon),
          const SizedBox(height: 16),
          Text(title, style: context.text.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(message, style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant), textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: context.colors.errorContainer,
        borderRadius: BorderRadius.circular(Nexo.radiusSurface),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.circleAlert, size: 20, color: context.colors.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: context.text.bodyMedium?.copyWith(color: context.colors.onErrorContainer)),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(foregroundColor: context.colors.onErrorContainer),
              child: const Text('Reintentar'),
            ),
        ],
      ),
    );
  }
}

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.message, this.icon = LucideIcons.info, this.tone = InfoTone.info});

  final String message;
  final IconData icon;
  final InfoTone tone;

  @override
  Widget build(BuildContext context) {
    // Un aviso sin texto no se dibuja (antes quedaba solo el ícono).
    if (message.trim().isEmpty) return const SizedBox.shrink();
    final (bg, fg) = switch (tone) {
      InfoTone.info => (context.colors.primaryFixed, context.colors.onPrimaryFixed),
      InfoTone.warning => (context.nexo.warningContainer, context.nexo.warning),
      InfoTone.success => (context.nexo.successContainer, context.nexo.success),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Nexo.radiusSurface)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 18, color: fg)),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: context.text.bodyMedium?.copyWith(color: fg))),
        ],
      ),
    );
  }
}

enum InfoTone { info, warning, success }

// ── Persona ────────────────────────────────────────────────

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.initials, this.bytes, this.size = 44});

  final String initials;
  final Uint8List? bytes;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.base),
      child: Container(
        key: ValueKey(bytes?.length ?? 0),
        width: size,
        height: size,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Nexo.navy, border: Border.all(color: Nexo.turquoise, width: 2)),
        alignment: Alignment.center,
        child: bytes != null
            ? Image.memory(bytes!, width: size, height: size, fit: BoxFit.cover, gaplessPlayback: true)
            : Text(
                initials,
                style: TextStyle(color: Nexo.onNavy, fontWeight: FontWeight.w700, fontSize: size * 0.36),
              ),
      ),
    );
  }
}

// ── Créditos ───────────────────────────────────────────────

class CreditsMeter extends StatelessWidget {
  const CreditsMeter({super.key, required this.disponibles, this.onRequest});

  final int? disponibles;
  final VoidCallback? onRequest;

  @override
  Widget build(BuildContext context) {
    final valor = disponibles;
    final agotado = valor != null && valor <= 0;
    // Referencia visual: el saldo inicial de una cuenta (100). No es un tope.
    final progreso = valor == null ? 0.0 : (valor / 100).clamp(0.0, 1.0);
    return NavyPanel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.zap, color: Nexo.turquoiseSoft, size: 20),
              const SizedBox(width: 6),
              Text('Créditos', style: context.text.titleSmall?.copyWith(color: Nexo.onNavyMuted)),
              const Spacer(),
              if (valor == null)
                Text('sin dato', style: context.text.titleMedium?.copyWith(color: Nexo.onNavyMuted))
              else
                CountUp(
                  value: valor,
                  style: context.text.headlineSmall?.copyWith(color: Nexo.onNavy, fontWeight: FontWeight.w800),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progreso),
              duration: Motion.of(context, const Duration(milliseconds: 700)),
              curve: Motion.easeOut,
              builder: (context, v, _) => LinearProgressIndicator(
                value: v,
                minHeight: 8,
                backgroundColor: Nexo.via,
                color: agotado ? Nexo.onNavyError : Nexo.turquoise,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            agotado
                ? 'Sin créditos: puedes ver tu historial, pero no crear ni regenerar campañas.'
                : '1 crédito = 1 generación. Mejorar el texto y restaurar versiones no gastan.',
            style: context.text.bodySmall?.copyWith(color: agotado ? Nexo.onNavyError : Nexo.onNavyMuted),
          ),
          if (agotado && onRequest != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRequest,
              style: FilledButton.styleFrom(backgroundColor: Nexo.turquoise, foregroundColor: Nexo.navyDeep),
              icon: const Icon(LucideIcons.plus),
              label: const Text('Solicitar créditos'),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Flujo ──────────────────────────────────────────────────

const pasosFlujo = ['Dictar', 'Generar', 'Aprobar', 'Publicar', 'Medir'];

int pasoDeEstado(EstadoCampana e, {bool publicada = false}) => switch (e) {
      EstadoCampana.borrador => 0,
      EstadoCampana.pendienteIa => 1,
      EstadoCampana.generado => 1,
      EstadoCampana.pendienteAprobacion => 2,
      EstadoCampana.rechazado => 2,
      EstadoCampana.fracaso => 2,
      EstadoCampana.aprobado => publicada ? 4 : 3,
    };

/// Dictar → Generar → Aprobar → Publicar → Medir: el recorrido de una
/// campaña con el lenguaje de la línea. Paradas hechas llenas, la actual
/// turquesa con anillo, las que faltan huecas. El anillo se desliza al
/// cambiar de paso (240 ms).
class FlowStepper extends StatelessWidget {
  const FlowStepper({super.key, required this.current, this.onNavy = false});

  final int current;
  final bool onNavy;

  @override
  Widget build(BuildContext context) {
    final via = onNavy ? Nexo.via : context.colors.outlineVariant;
    final hecho = onNavy ? Nexo.turquoiseSoft : context.colors.primary;
    final fondo = onNavy ? Nexo.banda : context.colors.surface;
    final tenue = onNavy ? Nexo.onNavyMuted : context.colors.onSurfaceVariant;
    final tinta = onNavy ? Nexo.onNavy : context.colors.onSurface;
    final mover = Motion.of(context, Motion.move);
    return Semantics(
      label: 'Paso ${current + 1} de ${pasosFlujo.length}: ${pasosFlujo[current.clamp(0, pasosFlujo.length - 1)]}',
      excludeSemantics: true,
      child: LayoutBuilder(builder: (context, constraints) {
        final n = pasosFlujo.length;
        final slot = constraints.maxWidth / n;
        const centro = 18.0;
        final paso = current.clamp(0, n - 1);
        return SizedBox(
          height: 60,
          child: Stack(
            children: [
              Positioned(
                left: slot / 2,
                right: slot / 2,
                top: centro - 2,
                child: Container(height: 4, decoration: BoxDecoration(color: via, borderRadius: BorderRadius.circular(2))),
              ),
              Positioned(
                left: slot / 2,
                top: centro - 2,
                child: AnimatedContainer(
                  duration: mover,
                  curve: Motion.easeInOut,
                  height: 4,
                  width: slot * paso,
                  decoration: BoxDecoration(color: hecho, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              AnimatedPositioned(
                duration: mover,
                curve: Motion.easeInOut,
                left: slot * paso + slot / 2 - 18,
                top: 0,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: fondo,
                    border: Border.all(color: Nexo.turquoiseSoft, width: 2),
                  ),
                ),
              ),
              for (var i = 0; i < n; i++)
                Positioned(
                  left: slot * i,
                  width: slot,
                  top: 0,
                  child: Column(
                    children: [
                      SizedBox(
                        height: centro * 2,
                        child: Center(
                          child: Container(
                            width: i == paso ? 24 : 18,
                            height: i == paso ? 24 : 18,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: i < paso ? hecho : (i == paso ? Nexo.turquoise : fondo),
                              border: i > paso ? Border.all(color: via, width: 4) : null,
                            ),
                            child: i < paso
                                ? Icon(LucideIcons.check, size: 12, color: onNavy ? Nexo.navyDeep : context.colors.onPrimary)
                                : i == paso
                                    ? Center(
                                        child: Container(
                                          width: 7,
                                          height: 7,
                                          decoration: const BoxDecoration(color: Nexo.navyDeep, shape: BoxShape.circle),
                                        ),
                                      )
                                    : null,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        pasosFlujo[i],
                        maxLines: 1,
                        overflow: TextOverflow.visible,
                        softWrap: false,
                        style: context.text.labelMedium?.copyWith(
                          fontWeight: i == paso ? FontWeight.w800 : FontWeight.w600,
                          color: i <= paso ? tinta : tenue,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }
}

/// Fecha corta en español de Perú: "21 oct. 2026".
String fechaCorta(DateTime? d) => d == null ? 'sin fecha' : DateFormat('d MMM y', 'es').format(d);
String fechaHora(DateTime? d) => d == null ? 'sin fecha' : DateFormat("d MMM y, HH:mm", 'es').format(d);
