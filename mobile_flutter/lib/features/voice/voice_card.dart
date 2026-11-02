import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/motion_widgets.dart';
import 'dictation.dart';

String mmss(Duration d) =>
    '${d.inMinutes.remainder(100).toString().padLeft(2, '0')}:${d.inSeconds.remainder(60).toString().padLeft(2, '0')}';

/// El brief como párrafo continuo y grande, como una prueba sobre el pliego.
/// Lo confirmado va en tinta plena; lo que el reconocedor aún puede cambiar,
/// en tinta tenue y con el cursor turquesa al final.
class ParrafoDictado extends StatelessWidget {
  const ParrafoDictado({super.key, required this.texto, required this.confirmado, required this.escuchando, required this.ejemplo});

  final String texto;
  final String confirmado;
  final bool escuchando;
  final String ejemplo;

  @override
  Widget build(BuildContext context) {
    final limpio = texto.trimRight();
    if (limpio.isEmpty && !escuchando) {
      return Text(ejemplo, style: context.text.titleLarge?.copyWith(color: context.colors.outline, fontWeight: FontWeight.w500, height: 1.35));
    }
    final base = escuchando && limpio.startsWith(confirmado.trim()) ? confirmado.trim() : limpio;
    final provisional = limpio.substring(base.length);
    final estilo = context.text.headlineMedium;
    return Semantics(
      label: 'Brief: $limpio',
      liveRegion: escuchando,
      excludeSemantics: true,
      child: AnimatedSize(
        duration: Motion.of(context, Motion.stop),
        curve: Motion.easeOut,
        alignment: Alignment.topLeft,
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(text: base),
              if (provisional.isNotEmpty) TextSpan(text: provisional, style: TextStyle(color: context.colors.outline)),
              if (escuchando) const WidgetSpan(alignment: PlaceholderAlignment.middle, child: _Cursor()),
            ],
          ),
          style: estilo,
        ),
      ),
    );
  }
}

/// Cursor turquesa al final del texto mientras se escucha. Parpadea; fijo
/// con "reducir movimiento".
class _Cursor extends StatefulWidget {
  const _Cursor();

  @override
  State<_Cursor> createState() => _CursorState();
}

class _CursorState extends State<_Cursor> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Opacity(
        opacity: _c.value < 0.55 ? 1 : 0,
        child: Container(
          width: 3,
          height: 28,
          margin: const EdgeInsets.only(left: 3),
          decoration: BoxDecoration(color: Nexo.turquoise, borderRadius: BorderRadius.circular(2)),
        ),
      ),
    );
  }
}

/// Micrófono-sello: círculo turquesa de 84 px con un aro de texto
/// «escuchando · mm:ss» que gira una vuelta cada 24 s, solo mientras escucha.
/// Detrás, un halo sigue el volumen real de la voz (el teléfono te oye);
/// con "reducir movimiento" el aro queda quieto y el halo fijo.
class MicSello extends StatefulWidget {
  const MicSello({super.key, required this.escuchando, required this.nivel, required this.tiempo, this.onTap});

  static const diametro = 84.0;
  static const total = 124.0;

  final bool escuchando;
  final double nivel;
  final Duration tiempo;
  final VoidCallback? onTap;

  @override
  State<MicSello> createState() => _MicSelloState();
}

class _MicSelloState extends State<MicSello> with SingleTickerProviderStateMixin {
  late final AnimationController _giro = AnimationController(vsync: this, duration: Motion.aroMicrofono);

  @override
  void didUpdateWidget(MicSello old) {
    super.didUpdateWidget(old);
    _sincronizar();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sincronizar();
  }

  void _sincronizar() {
    final girar = widget.escuchando && !Motion.reduced(context);
    if (girar && !_giro.isAnimating) _giro.repeat();
    if (!girar && _giro.isAnimating) _giro.stop();
  }

  @override
  void dispose() {
    _giro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activo = widget.onTap != null;
    final reduced = Motion.reduced(context);
    final n = widget.escuchando ? (reduced ? 0.5 : widget.nivel) : 0.0;
    final tinta = context.colors.primary;
    return Semantics(
      button: true,
      enabled: activo,
      label: widget.escuchando ? 'Detener dictado, ${mmss(widget.tiempo)}' : 'Dictar el brief',
      excludeSemantics: true,
      child: Pressable(
        onTap: widget.onTap,
        scale: 0.95,
        child: SizedBox.square(
          dimension: MicSello.total,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Aro del sello: texto circular mientras escucha; doble filete en reposo.
              AnimatedOpacity(
                opacity: activo ? 1 : 0.4,
                duration: Motion.of(context, Motion.fast),
                child: RotationTransition(
                  turns: _giro,
                  child: CustomPaint(
                    size: const Size.square(MicSello.total),
                    painter: _AroSello(
                      color: tinta,
                      texto: widget.escuchando ? 'escuchando · ${mmss(widget.tiempo)} · ' : null,
                    ),
                  ),
                ),
              ),
              // Halo con el nivel de voz.
              AnimatedScale(
                scale: widget.escuchando ? 1.02 + 0.16 * n : 0.95,
                duration: const Duration(milliseconds: 120),
                curve: Motion.easeOut,
                child: AnimatedOpacity(
                  opacity: widget.escuchando ? 0.22 + 0.3 * n : 0,
                  duration: const Duration(milliseconds: 120),
                  child: Container(
                    width: MicSello.diametro,
                    height: MicSello.diametro,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: Nexo.turquoise),
                  ),
                ),
              ),
              AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                curve: Motion.easeOut,
                width: MicSello.diametro,
                height: MicSello.diametro,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: activo ? Nexo.turquoise : context.colors.surfaceContainerHigh,
                ),
                child: AnimatedSwitcher(
                  duration: Motion.of(context, Motion.fast),
                  transitionBuilder: (child, a) => FadeTransition(
                    opacity: a,
                    child: ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(a), child: child),
                  ),
                  child: Icon(
                    widget.escuchando ? LucideIcons.square : LucideIcons.mic,
                    key: ValueKey(widget.escuchando),
                    size: widget.escuchando ? 28 : 34,
                    color: activo ? Nexo.navyDeep : context.colors.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AroSello extends CustomPainter {
  _AroSello({required this.color, required this.texto});

  final Color color;
  final String? texto;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 1;
    final filete = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawCircle(c, r, filete);
    canvas.drawCircle(c, MicSello.diametro / 2 + 4, filete..strokeWidth = 1);
    final t = texto;
    if (t == null) return;
    // Texto alrededor del sello, repetido hasta completar la vuelta.
    final estilo = GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: color, letterSpacing: 0.6);
    final radioTexto = (r + MicSello.diametro / 2 + 4) / 2 - 4.5;
    final glifos = [
      for (final ch in t.split(''))
        TextPainter(text: TextSpan(text: ch, style: estilo), textDirection: TextDirection.ltr)..layout(),
    ];
    final largo = glifos.fold<double>(0, (a, g) => a + g.width);
    final vueltas = math.max(1, (2 * math.pi * radioTexto / largo).floor());
    final escala = 2 * math.pi * radioTexto / (largo * vueltas);
    var angulo = -math.pi / 2;
    for (var v = 0; v < vueltas; v++) {
      for (final g in glifos) {
        final paso = g.width * escala / radioTexto;
        final a = angulo + paso / 2;
        canvas
          ..save()
          ..translate(c.dx + radioTexto * math.cos(a), c.dy + radioTexto * math.sin(a))
          ..rotate(a + math.pi / 2);
        g.paint(canvas, Offset(-g.width / 2, -g.height / 2));
        canvas.restore();
        angulo += paso;
      }
    }
  }

  @override
  bool shouldRepaint(_AroSello old) => old.texto != texto || old.color != color;
}

/// Dónde se transcribe: en el teléfono o en el sistema (Apple/Google).
class AvisoPrivacidad extends StatelessWidget {
  const AvisoPrivacidad({super.key, required this.dictado});
  final DictationController dictado;

  @override
  Widget build(BuildContext context) {
    final aviso = dictado.avisoPrivacidad;
    if (aviso == null) return const SizedBox.shrink();
    final local = dictado.modo == ModoDictado.enDispositivo;
    final color = context.colors.onSurfaceVariant;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(local ? LucideIcons.smartphone : LucideIcons.cloud, size: 16, color: color),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(aviso, style: context.text.bodySmall?.copyWith(color: color))),
          ],
        ),
        if (dictado.puedeDescargarIdioma)
          Padding(
            padding: const EdgeInsets.only(left: 16),
            child: TextButton.icon(
              onPressed: dictado.descargarIdioma,
              icon: const Icon(LucideIcons.download, size: 18),
              label: const Text('Descargar español para dictar sin enviar audio'),
            ),
          )
        else if (dictado.descargando)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 24),
            child: Text('Descargando el español…', style: context.text.bodySmall),
          )
        else if (!local && dictado.esIos)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 24),
            child: Text(
              'Para dictar sin conexión, descarga el español para Dictado (Ajustes → General → Teclado).',
              style: context.text.bodySmall,
            ),
          ),
      ],
    );
  }
}
