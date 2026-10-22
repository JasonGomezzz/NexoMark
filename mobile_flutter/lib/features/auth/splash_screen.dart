import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session/splash_gate.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/nexo_mark_logo.dart';

/// Mientras se recupera la sesión guardada. Continúa el arranque nativo sin
/// salto: la N queda del mismo tamaño y en el mismo lugar que el ícono (120 pt
/// en el centro, como LaunchImage), y debajo aparece el nombre.
///
/// Es el momento firma de la app y ocurre una vez por arranque (0,8 s): las
/// dos piezas de la N, la clara (quien crea) y la turquesa (quien aprueba),
/// parten separadas por la diagonal y encajan; la N asienta con un pulso breve
/// y entra el nombre. Con "reducir movimiento" la N ya está encajada y solo se
/// funde el nombre.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  /// Línea de tiempo en ms (0–800). Las piezas llegan con 40 ms de diferencia,
  /// la turquesa después: la aprobación cierra lo que la creación abrió.
  static const _total = 800;
  static const _whiteEnds = 520;
  static const _tealStarts = 40;
  static const _tealEnds = 560;
  static const _settleStarts = 530;
  static const _settleEnds = 720;
  static const _textStarts = 440;

  /// El asentamiento: la N crece un 3,5 % al cerrarse el encaje y vuelve.
  static const _settleScale = 1.035;

  /// El nombre sube 8 px mientras se funde.
  static const _textRise = 8.0;

  late final AnimationController _c = AnimationController(vsync: this);
  late Animation<double> _white;
  late Animation<double> _teal;
  late Animation<double> _settle;
  late Animation<double> _text;
  Timer? _safety;
  bool _started = false;
  bool _begun = false;
  bool _reduced = false;

  /// Red de seguridad: si el motor no avisa que el primer cuadro se dibujó, la
  /// animación arranca igual y la compuerta no deja la app detenida aquí.
  static const _firstFrameTimeout = Duration(seconds: 8);

  Animation<double> _span(int from, int to, Curve curve) => CurvedAnimation(
    parent: _c,
    curve: Interval(from / _total, to / _total, curve: curve),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduced = Motion.reduced(context);
    if (_reduced) {
      // La N ya encajada y solo el nombre se funde.
      _white = _teal = kAlwaysDismissedAnimation;
      _settle = const AlwaysStoppedAnimation(1);
      _c.duration = Motion.base;
      _text = CurvedAnimation(parent: _c, curve: Motion.easeOut);
    } else {
      _c.duration = const Duration(milliseconds: _total);
      // Las piezas se mueven por la pantalla: ease-in-out. Desde la separación
      // (1) hasta el encaje (0).
      _white = Tween(begin: 1.0, end: 0.0).animate(_span(0, _whiteEnds, Motion.easeInOut));
      _teal = Tween(begin: 1.0, end: 0.0).animate(_span(_tealStarts, _tealEnds, Motion.easeInOut));
      _settle = TweenSequence<double>([
        TweenSequenceItem(
          tween: Tween(begin: 1.0, end: _settleScale).chain(CurveTween(curve: Motion.easeOut)),
          weight: 4,
        ),
        TweenSequenceItem(
          tween: Tween(begin: _settleScale, end: 1.0).chain(CurveTween(curve: Motion.easeInOut)),
          weight: 6,
        ),
      ]).animate(CurvedAnimation(parent: _c, curve: Interval(_settleStarts / _total, _settleEnds / _total)));
      _text = _span(_textStarts, _total, Motion.easeOut);
    }
    // El reloj arranca con el primer cuadro a la vista, no antes.
    _safety = Timer(_firstFrameTimeout, _begin);
    unawaited(ref.read(splashGateProvider).firstFrame.then((_) => _begin()));
  }

  void _begin() {
    if (_begun || !mounted) return;
    _begun = true;
    _safety?.cancel();
    if (_reduced) {
      // Sin movimiento no hay nada que esperar: la compuerta se abre ya.
      unawaited(_c.forward());
      _release();
    } else {
      unawaited(_c.forward().whenComplete(_release));
    }
  }

  void _release() {
    if (mounted) ref.read(splashGateProvider).release();
  }

  @override
  void dispose() {
    _safety?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Nexo.navy,
        // Sin SizedBox.expand el Stack mide lo que su hijo (120 pt) y se queda en la esquina.
        body: SizedBox.expand(
          child: Stack(
            alignment: Alignment.center,
            children: [
              NexoMarkLogo(size: 120, white: _white, teal: _teal, scale: _settle),
              Positioned(
                top: MediaQuery.sizeOf(context).height / 2 + 74,
                child: AnimatedBuilder(
                  animation: _text,
                  builder: (context, child) => Opacity(
                    opacity: _text.value,
                    child: Transform.translate(
                      offset: Offset(0, _reduced ? 0 : _textRise * (1 - _text.value)),
                      child: child,
                    ),
                  ),
                  child: const Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: 'NexoMark '),
                        TextSpan(
                          text: 'IA',
                          style: TextStyle(color: Nexo.turquoiseSoft),
                        ),
                      ],
                    ),
                    style: TextStyle(
                      color: Nexo.onNavy,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
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
