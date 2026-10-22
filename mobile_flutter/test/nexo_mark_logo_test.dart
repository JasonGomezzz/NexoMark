import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/core/theme/tokens.dart';
import 'package:nexomark/widgets/nexo_mark_logo.dart';

void main() {
  group('N de dos piezas', () {
    testWidgets('se ve como el ícono aprobado', (tester) async {
      tester.view.physicalSize = const Size(300, 300);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final key = GlobalKey();
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: RepaintBoundary(
              key: key,
              child: const ColoredBox(color: Nexo.navy, child: NexoMarkLogo(size: 256)),
            ),
          ),
        ),
      );

      var distintos = 0;
      await tester.runAsync(() async {
        final dibujo = await (key.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage();
        final maestro = await decodeImageFromList(File('assets/brand/nexomark-icon.png').readAsBytesSync());
        final a = (await dibujo.toByteData())!;
        final b = (await maestro.toByteData())!;
        expect(dibujo.width, maestro.width);
        // El ícono trae esquinas transparentes: se pone sobre el mismo marino.
        const fondo = [0x14, 0x28, 0x3F];
        for (var i = 0; i < a.lengthInBytes; i += 4) {
          final alfa = b.getUint8(i + 3) / 255;
          for (var c = 0; c < 3; c++) {
            final esperado = b.getUint8(i + c) * alfa + fondo[c] * (1 - alfa);
            if ((a.getUint8(i + c) - esperado).abs() > 64) {
              distintos++;
              break;
            }
          }
        }
      });
      // Solo bordes suavizados (2 píxeles hoy); una pieza corrida unos puntos o un color cambiado pasa de 10.
      expect(distintos, lessThan(10), reason: '$distintos píxeles distintos al ícono aprobado');
    });
  });
}
