import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/motion_widgets.dart';
import 'dictation.dart';

/// Una frase del brief: una parada en la vía del dictado.
class Parada {
  const Parada(this.texto, {this.tiempo});
  final String texto;

  /// Cuándo se dijo, contando desde que se tocó el micrófono. null si se escribió.
  final Duration? tiempo;
}

/// Parte el brief en frases por la puntuación (la que pone el dictado del
/// sistema o la que escribe la persona). La puntuación queda con su frase.
List<String> frasesDe(String texto) {
  final limpio = texto.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (limpio.isEmpty) return const [];
  final partes = <String>[];
  final buffer = StringBuffer();
  for (var i = 0; i < limpio.length; i++) {
    final ch = limpio[i];
    buffer.write(ch);
    final fin = '.,;:!?'.contains(ch) && (i + 1 == limpio.length || limpio[i + 1] == ' ');
    if (fin) {
      partes.add(buffer.toString().trim());
      buffer.clear();
    }
  }
  if (buffer.toString().trim().isNotEmpty) partes.add(buffer.toString().trim());
  return partes;
}

String mmss(Duration d) =>
    '${d.inMinutes.remainder(100).toString().padLeft(2, '0')}:${d.inSeconds.remainder(60).toString().padLeft(2, '0')}';

/// Posición horizontal de la vía: alineada con el centro del micrófono.
const viaX = Nexo.gutter + MicButton.diametro / 2;

/// Vía vertical turquesa con una parada por frase. La frase en curso
/// (mientras se escucha) va en tinta tenue, con anillo `outline-variant` y
/// un cursor turquesa. La vía es una sola línea que baja hasta el micrófono;
/// lo que va debajo de las frases ([pie]) se escribe a su costado.
class ViaDictado extends StatelessWidget {
  const ViaDictado({super.key, required this.paradas, required this.escuchando, this.placeholder, this.pie = const []});

  final List<Parada> paradas;
  final bool escuchando;
  final String? placeholder;
  final List<Widget> pie;

  /// Donde empieza el texto (a la derecha de la vía).
  static const textoX = viaX + 11 + 14;

  @override
  Widget build(BuildContext context) {
    final vacia = paradas.isEmpty;
    return Stack(
      children: [
        Positioned(
          left: viaX - Nexo.viaDictado / 2,
          width: Nexo.viaDictado,
          top: 18,
          bottom: 0,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: vacia ? context.colors.outlineVariant : Nexo.turquoise,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
            ),
          ),
        ),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              label: vacia ? 'Brief vacío' : 'Brief: ${paradas.map((p) => p.texto).join(' ')}',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (vacia)
                    _FilaParada(texto: placeholder ?? '', tiempo: null, estilo: _EstiloParada.ejemplo)
                  else
                    for (var i = 0; i < paradas.length; i++)
                      _Entra(
                        key: ValueKey('parada-$i'),
                        child: _FilaParada(
                          texto: paradas[i].texto,
                          tiempo: paradas[i].tiempo,
                          estilo: escuchando && i == paradas.length - 1 ? _EstiloParada.provisional : _EstiloParada.dicha,
                        ),
                      ),
                ],
              ),
            ),
            for (final w in pie)
              Padding(
                padding: const EdgeInsets.fromLTRB(textoX, 0, Nexo.gutter, 0),
                child: w,
              ),
          ],
        ),
      ],
    );
  }
}

enum _EstiloParada { dicha, provisional, ejemplo }

class _FilaParada extends StatelessWidget {
  const _FilaParada({required this.texto, required this.tiempo, required this.estilo});

  final String texto;
  final Duration? tiempo;
  final _EstiloParada estilo;

  @override
  Widget build(BuildContext context) {
    final dicha = estilo == _EstiloParada.dicha;
    final frase = estilo == _EstiloParada.ejemplo
        ? context.text.bodyLarge?.copyWith(color: context.colors.outline)
        : context.text.headlineMedium?.copyWith(color: dicha ? context.colors.onSurface : context.colors.outline);
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: ViaDictado.textoX,
            child: Padding(
              padding: EdgeInsets.only(left: viaX - 11, top: tiempo == null ? 4 : 22),
              child: Align(
                alignment: Alignment.topLeft,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: context.colors.surface,
                    border: Border.all(
                      color: dicha ? Nexo.turquoise : context.colors.outlineVariant,
                      width: Nexo.anilloParada,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: Nexo.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (tiempo != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        mmss(tiempo!),
                        style: context.text.bodySmall?.copyWith(
                          color: context.colors.outline,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  Text.rich(
                    TextSpan(
                      text: texto,
                      children: [
                        if (estilo == _EstiloParada.provisional)
                          const WidgetSpan(alignment: PlaceholderAlignment.middle, child: _Cursor()),
                      ],
                    ),
                    style: frase,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La parada nueva entra con la vía creciendo: altura desde 0.6 y opacidad, 180 ms.
class _Entra extends StatelessWidget {
  const _Entra({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.stop,
      curve: Motion.easeOut,
      child: child,
      builder: (context, t, child) => ClipRect(
        child: Align(
          alignment: Alignment.topCenter,
          heightFactor: 0.6 + 0.4 * t,
          child: Opacity(opacity: t, child: child),
        ),
      ),
    );
  }
}

/// Cursor turquesa al final de la frase en curso. Parpadea; fijo con "reducir movimiento".
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
      _c.value = 1;
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
        opacity: Motion.reduced(context) || _c.value < 0.55 ? 1 : 0,
        child: Container(
          width: 3,
          height: 26,
          margin: const EdgeInsets.only(left: 3),
          decoration: BoxDecoration(color: Nexo.turquoise, borderRadius: BorderRadius.circular(2)),
        ),
      ),
    );
  }
}

/// Micrófono: círculo turquesa de 84 px en la zona del pulgar. Mientras
/// escucha, dos aros siguen el volumen real de la voz (el teléfono te está
/// oyendo); se reajustan con cada lectura en 120 ms, sin rebote. Con
/// "reducir movimiento" el aro queda fijo.
class MicButton extends StatelessWidget {
  const MicButton({super.key, required this.escuchando, required this.nivel, this.onTap});

  static const diametro = 84.0;

  final bool escuchando;
  final double nivel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final activo = onTap != null;
    final n = escuchando ? (reduced ? 0.5 : nivel) : 0.0;
    return Semantics(
      button: true,
      enabled: activo,
      label: escuchando ? 'Detener dictado' : 'Dictar el brief',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        scale: 0.95,
        child: SizedBox.square(
          dimension: diametro,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              for (final (k, alcance) in [(0, 0.34), (1, 0.18)])
                AnimatedScale(
                  key: ValueKey('aro-$k'),
                  scale: escuchando ? 1 + 0.08 + alcance * n : 0.95,
                  duration: const Duration(milliseconds: 120),
                  curve: Motion.easeOut,
                  child: AnimatedOpacity(
                    opacity: escuchando ? (k == 0 ? 0.18 + 0.3 * n : 0.45) : 0,
                    duration: const Duration(milliseconds: 120),
                    child: Container(
                      width: diametro,
                      height: diametro,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: k == 0 ? Nexo.turquoise : null,
                        border: k == 1 ? Border.all(color: Nexo.turquoiseSoft, width: 2) : null,
                      ),
                    ),
                  ),
                ),
              AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                curve: Motion.easeOut,
                width: diametro,
                height: diametro,
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
                    escuchando ? LucideIcons.square : LucideIcons.mic,
                    key: ValueKey(escuchando),
                    size: escuchando ? 28 : 34,
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
              child: Icon(local ? LucideIcons.lock : LucideIcons.cloud, size: 16, color: local ? context.nexo.success : color),
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
