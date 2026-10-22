import 'dart:async';

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
/// repite al reconstruir y con "reducir movimiento" aparece directo.
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
    if (Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
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
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _t.value,
        child: Transform.translate(offset: Offset(0, widget.offset * (1 - _t.value)), child: child),
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
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: const Duration(milliseconds: 600),
      curve: Motion.easeOut,
      builder: (context, v, _) => Text(
        fmt(v.round()),
        style: style?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
      ),
    );
  }
}

/// Bloque gris con un brillo que lo recorre: "cargando" con la forma del
/// contenido que viene. Movimiento constante → curva lineal. Con
/// "reducir movimiento" queda quieto.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = 8});

  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.stop();
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
    final scheme = Theme.of(context).colorScheme;
    final base = scheme.surfaceContainerHigh;
    final shine = scheme.surfaceContainerLow;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final x = -1.5 + 3 * _c.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(x - 1, 0),
              end: Alignment(x + 1, 0),
              colors: [base, shine, base],
              stops: const [0.25, 0.5, 0.75],
            ),
          ),
        );
      },
    );
  }
}

/// Cambia de contenido con un fundido corto y un leve desplazamiento
/// vertical: para estados que cambian solos (polling) sin que el texto salte.
class SwapIn extends StatelessWidget {
  const SwapIn({super.key, required this.child, this.duration = Motion.fast});

  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: Motion.of(context, duration),
      switchInCurve: Motion.easeOut,
      switchOutCurve: Motion.easeOut,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.centerLeft,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 0.25), end: Offset.zero).animate(animation),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
