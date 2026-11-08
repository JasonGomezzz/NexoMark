import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/motion.dart';

/// Respuesta táctil: el elemento se hunde a 0.97 mientras se presiona.
/// Es retroalimentación (se usa decenas de veces al día), así que es corta
/// (140 ms) y sin rebote. Con "reducir movimiento" no escala.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.haptic = false, this.scale = 0.97});

  final Widget child;
  final VoidCallback? onTap;
  final bool haptic;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool value) {
    if (widget.onTap == null || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.selectionClick();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down && !reduced ? widget.scale : 1,
        duration: Motion.press,
        curve: Motion.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Entrada única al aparecer: sube 12 px y pasa de transparente a visible,
/// escalonada por [index] (50 ms). Evita que todo llegue de golpe. No se
/// repite al reconstruir; con "reducir movimiento" solo se funde, sin subir.
class Entrance extends StatefulWidget {
  const Entrance({super.key, required this.child, this.index = 0, this.offset = 12});

  final Widget child;
  final int index;
  final double offset;

  @override
  State<Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<Entrance> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.base);
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Motion.easeOut);
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Un tope: en listas largas los últimos no deben esperar más de 400 ms.
    final delay = Motion.stagger * widget.index.clamp(0, 8);
    _timer = Timer(delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sube = Motion.reduced(context) ? 0.0 : widget.offset;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _t.value,
        child: Transform.translate(offset: Offset(0, sube * (1 - _t.value)), child: child),
      ),
    );
  }
}

/// Cifra que sube desde 0 la primera vez que se muestra (una sola vez).
/// Solo para valores reales: null se escribe "sin dato" y no se anima.
class CountUp extends StatelessWidget {
  const CountUp({super.key, required this.value, this.style, this.format});

  final int value;
  final TextStyle? style;
  final String Function(int)? format;

  @override
  Widget build(BuildContext context) {
    final fmt = format ?? (v) => '$v';
    if (Motion.reduced(context)) return Text(fmt(value), style: style);
    return TweenAnimationBuilder<double>(
      // Arranca cerca del valor real (90 %): se nota que llegó el dato sin "contar desde 0".
      tween: Tween(begin: value * 0.9, end: value.toDouble()),
      duration: Motion.move,
      curve: Motion.easeOut,
      builder: (context, v, _) => Text(
        fmt(v.round()),
        style: style?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
      ),
    );
  }
}

/// Bloque con la forma del contenido que viene. Ocupa su lugar desde el primer
/// cuadro (nada salta), pero no se ve si la carga dura menos de 300 ms: así una
/// respuesta rápida no parpadea. Después aparece con un fundido de 150 ms y
/// pulsa suave (sin brillo que corre). Todos los bloques pulsan al mismo
/// compás, porque la fase sale del reloj. Con "reducir movimiento" aparece con
/// el mismo fundido pero no late (como `.esqueleto` en la web).
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = 8});

  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.pulso);
  Timer? _espera;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _espera = Timer(Motion.esperaEsqueleto, () {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      final ms = Motion.pulso.inMilliseconds;
      _c.value = (DateTime.now().millisecondsSinceEpoch % ms) / ms;
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _espera?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = scheme.surfaceContainerHigh;
    final suave = Color.lerp(base, scheme.surfaceContainerLow, 0.7)!;
    return AnimatedOpacity(
      opacity: _visible ? 1 : 0,
      duration: Motion.llegada,
      curve: Motion.easeOut,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          // Ida y vuelta con forma de seno: sin cortes al reiniciar el ciclo.
          final t = 0.5 - 0.5 * math.cos(2 * math.pi * _c.value);
          return Container(
            width: widget.width,
            height: widget.height,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(widget.radius),
              color: Color.lerp(base, suave, t),
            ),
          );
        },
      ),
    );
  }
}

/// Llega el contenido real: cambia del esqueleto (u otro estado) al contenido
/// con un fundido de 150 ms, sin desplazamiento (también con "reducir
/// movimiento"). Cambia solo cuando el tipo de widget cambia (esqueleto →
/// lista), no en cada actualización de datos.
class Llegada extends StatelessWidget {
  const Llegada({super.key, required this.child, this.alignment = Alignment.topCenter});

  final Widget child;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: Motion.llegada,
      switchInCurve: Motion.easeOut,
      switchOutCurve: Motion.easeOut,
      layoutBuilder: (current, previous) => Stack(alignment: alignment, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(opacity: animation, child: child),
      child: child,
    );
  }
}

/// Cambia de contenido con un fundido corto y un leve desplazamiento
/// vertical: para estados que cambian solos (polling) sin que el texto salte.
/// Con "reducir movimiento" queda solo el fundido.
class SwapIn extends StatelessWidget {
  const SwapIn({super.key, required this.child, this.duration = Motion.fast});

  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    final reducido = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: duration,
      switchInCurve: Motion.easeOut,
      switchOutCurve: Motion.easeOut,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.centerLeft,
        children: [...previous, ?current],
      ),
      // Con "reducir movimiento" solo el fundido: el texto no sube.
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: reducido
            ? child
            : SlideTransition(
                position: Tween(begin: const Offset(0, 0.25), end: Offset.zero).animate(animation),
                child: child,
              ),
      ),
      child: child,
    );
  }
}
