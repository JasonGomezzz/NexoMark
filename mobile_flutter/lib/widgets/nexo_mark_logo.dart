import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// La N de NexoMark IA como dos piezas vectoriales que encajan: la clara
/// (quien crea la campaña) y la turquesa (quien la aprueba). Reproduce el
/// maestro `brand/nexomark-icon-approved-1024.png` y, con todo en reposo, queda
/// del mismo tamaño y en el mismo lugar que ese ícono dentro de un cuadro de
/// [size] (la N es el 53 % del ancho del cuadro y está centrada).
///
/// Cada pieza se anima por separado: [white] y [teal] van de 1 (separada) a 0
/// (encajada), deslizándose a lo largo de la diagonal; [scale] escala la N
/// entera desde su centro (el pequeño asentamiento al encajar).
class NexoMarkLogo extends StatelessWidget {
  const NexoMarkLogo({
    super.key,
    this.size = 120,
    this.white = kAlwaysDismissedAnimation,
    this.teal = kAlwaysDismissedAnimation,
    this.scale = const AlwaysStoppedAnimation(1),
  });

  final double size;
  final Animation<double> white;
  final Animation<double> teal;
  final Animation<double> scale;

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _NexoMarkPainter(white: white, teal: teal, scale: scale),
        ),
      ),
    );
  }
}

// Medidas del maestro de 1024 × 1024. La diagonal de la N avanza 3 en x por
// cada 4 en y, así que se mide con dos ejes: `s` a lo largo de la diagonal y
// `t` a lo ancho (la banda mide 80 de ancho, de t = 62,4 a t = 142,4). El
// encastre es una pestaña cuadrada (26 de ancho, 30 de largo) que sale de la
// pieza clara y entra en una ranura de la turquesa, con 14 de holgura por todos
// lados. Los valores salen de ajustar el dibujo al maestro, píxel a píxel.
const _unit = 1024.0;
const _center = Offset(_unit / 2, _unit / 2);

/// Recorrido de cada pieza al separarse, a lo largo de la diagonal (≈ 7,5 pt con
/// el cuadro de 120 pt). Con 14 de holgura, la pestaña sale de la ranura y las
/// piezas siguen cerca: se lee como "encajar", no como "armar".
const _travel = 64.0;
const _alongBand = Offset(0.6, 0.8);

Offset _band(double s, double t) =>
    Offset(0.6 * s + 0.8 * t, 0.8 * s - 0.6 * t);

/// Polígono con esquinas rectas; el radio de una esquina cóncava la redondea
/// como en el maestro. Todas las esquinas son de 90°.
Path _polygon(List<(Offset, double)> corners) {
  final path = Path();
  final n = corners.length;
  for (var i = 0; i < n; i++) {
    final (p, r) = corners[i];
    final prev = corners[(i - 1 + n) % n].$1;
    final next = corners[(i + 1) % n].$1;
    if (r == 0) {
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      continue;
    }
    final inward = (p - prev) / (p - prev).distance;
    final outward = (next - p) / (next - p).distance;
    final from = p - inward * r;
    final to = p + outward * r;
    i == 0 ? path.moveTo(from.dx, from.dy) : path.lineTo(from.dx, from.dy);
    path.arcToPoint(
      to,
      radius: Radius.circular(r),
      clockwise: inward.dx * outward.dy - inward.dy * outward.dx > 0,
    );
  }
  return path..close();
}

/// Pieza clara: el palo izquierdo, la diagonal hasta el encastre y la pestaña.
final _whitePiece = _polygon([
  (const Offset(240, 264), 0),
  (const Offset(376, 264), 0),
  (_band(697.2, 142.4), 0),
  (_band(697.2, 115.4), 6.6),
  (_band(727.2, 115.4), 0),
  (_band(727.2, 89.4), 0),
  (_band(697.2, 89.4), 6.6),
  (_band(697.2, 62.4), 0),
  (const Offset(408, 440), 0),
  (const Offset(408, 760), 0),
  (const Offset(240, 760), 0),
]);

/// Pieza turquesa: la ranura del encastre, la diagonal y el palo derecho.
final _tealPiece = _polygon([
  (_band(711.4, 142.4), 0),
  (_band(711.4, 129.5), 0),
  (_band(741.3, 129.5), 6.6),
  (_band(741.3, 75.3), 6.6),
  (_band(711.4, 75.3), 0),
  (_band(711.4, 62.4), 0),
  (const Offset(648, 760), 0),
  (const Offset(784, 760), 0),
  (const Offset(784, 264), 0),
  (const Offset(616, 264), 0),
  (const Offset(616, 584), 0),
]);

final _whitePaint = Paint()..color = Nexo.onNavy;
final _tealPaint = Paint()..color = Nexo.turquoise;

class _NexoMarkPainter extends CustomPainter {
  _NexoMarkPainter({
    required this.white,
    required this.teal,
    required this.scale,
  }) : super(repaint: Listenable.merge([white, teal, scale]));

  final Animation<double> white;
  final Animation<double> teal;
  final Animation<double> scale;

  void _piece(Canvas canvas, Path path, Paint paint, Offset shift) {
    canvas
      ..save()
      ..translate(shift.dx, shift.dy)
      ..drawPath(path, paint)
      ..restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas
      ..save()
      ..translate(size.width / 2, size.height / 2)
      ..scale(size.shortestSide / _unit * scale.value)
      ..translate(-_center.dx, -_center.dy);
    _piece(
      canvas,
      _whitePiece,
      _whitePaint,
      _alongBand * -(_travel * white.value),
    );
    _piece(canvas, _tealPiece, _tealPaint, _alongBand * (_travel * teal.value));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_NexoMarkPainter old) =>
      old.white != white || old.teal != teal || old.scale != scale;
}
