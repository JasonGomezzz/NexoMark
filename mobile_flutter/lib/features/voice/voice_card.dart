import 'package:flutter/material.dart';

import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import 'dictation.dart';

/// Tarjeta de dictado: aviso honesto de dónde se transcribe, micrófono que
/// late con el volumen real de la voz y el texto que aparece mientras se habla.
class VoiceBriefCard extends StatelessWidget {
  const VoiceBriefCard({super.key, required this.dictado, required this.texto, this.enabled = true});

  final DictationController dictado;
  final TextEditingController texto;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: dictado,
      builder: (context, _) {
        final disponible = dictado.modo != ModoDictado.noDisponible;
        return NexoCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Cuéntale la campaña', style: context.text.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          disponible
                              ? 'Toca el micrófono y habla: «Súbeme una foto con 2×1 en capuchinos para Café Aurora».'
                              : 'Este teléfono no tiene reconocimiento de voz. Escribe el brief.',
                          style: context.text.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  if (disponible) ...[
                    const SizedBox(width: 12),
                    MicButton(
                      escuchando: dictado.escuchando,
                      nivel: dictado.nivel,
                      onTap: enabled && dictado.preparado ? () => dictado.alternar(texto.text) : null,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: texto,
                enabled: enabled,
                minLines: 4,
                maxLines: 8,
                maxLength: 2000,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Producto, promoción, cliente, tono y red…',
                  counterText: '',
                  filled: true,
                  fillColor: dictado.escuchando ? context.colors.primaryFixed : context.colors.surfaceContainerLow,
                ),
              ),
              if (dictado.avisoPrivacidad != null) ...[
                const SizedBox(height: 12),
                _AvisoModo(dictado: dictado),
              ],
              if (dictado.aviso != null) ...[
                const SizedBox(height: 10),
                SwapIn(child: InfoBanner(key: ValueKey(dictado.aviso), message: dictado.aviso!, tone: InfoTone.warning)),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _AvisoModo extends StatelessWidget {
  const _AvisoModo({required this.dictado});
  final DictationController dictado;

  @override
  Widget build(BuildContext context) {
    final local = dictado.modo == ModoDictado.enDispositivo;
    final color = local ? context.nexo.success : context.colors.onSurfaceVariant;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(local ? Icons.phonelink_lock_rounded : Icons.cloud_outlined, size: 18, color: color),
            const SizedBox(width: 8),
            Expanded(child: Text(dictado.avisoPrivacidad!, style: context.text.bodySmall?.copyWith(color: color))),
          ],
        ),
        if (dictado.puedeDescargarIdioma)
          TextButton.icon(
            onPressed: dictado.descargarIdioma,
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Descargar español para dictar sin enviar audio'),
          )
        else if (dictado.descargando)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 26),
            child: Text('Descargando el español…', style: context.text.bodySmall),
          )
        else if (!local && dictado.esIos)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 26),
            child: Text(
              'Para dictar sin conexión, el español debe estar descargado para Dictado (Ajustes → General → Teclado).',
              style: context.text.bodySmall,
            ),
          ),
      ],
    );
  }
}

/// Micrófono. Mientras escucha, un anillo turquesa crece con el volumen de
/// la voz (retroalimentación: el teléfono te está oyendo). Se reajusta en
/// cada lectura con 120 ms, sin rebote. Con "reducir movimiento" el anillo
/// solo cambia de intensidad, no de tamaño.
class MicButton extends StatelessWidget {
  const MicButton({super.key, required this.escuchando, required this.nivel, this.onTap, this.size = 68});

  final bool escuchando;
  final double nivel;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final activo = escuchando ? 1.0 : 0.0;
    return Semantics(
      button: true,
      label: escuchando ? 'Detener dictado' : 'Dictar',
      child: Pressable(
        onTap: onTap,
        scale: 0.94,
        child: SizedBox.square(
          dimension: size * 1.5,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedScale(
                scale: reduced ? 1.2 : (1 + 0.15 * activo + 0.35 * nivel * activo),
                duration: const Duration(milliseconds: 120),
                curve: Motion.easeOut,
                child: AnimatedOpacity(
                  opacity: escuchando ? 0.18 + 0.32 * nivel : 0,
                  duration: const Duration(milliseconds: 120),
                  child: Container(
                    width: size,
                    height: size,
                    decoration: const BoxDecoration(color: Nexo.turquoise, shape: BoxShape.circle),
                  ),
                ),
              ),
              AnimatedContainer(
                duration: Motion.of(context, Motion.fast),
                curve: Motion.easeOut,
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: onTap == null
                      ? context.colors.surfaceContainerHigh
                      : escuchando
                          ? Nexo.navy
                          : context.colors.primary,
                  border: Border.all(color: escuchando ? Nexo.turquoise : Colors.transparent, width: 3),
                ),
                child: AnimatedSwitcher(
                  duration: Motion.of(context, Motion.fast),
                  transitionBuilder: (child, a) => FadeTransition(
                    opacity: a,
                    child: ScaleTransition(scale: Tween(begin: 0.8, end: 1.0).animate(a), child: child),
                  ),
                  child: Icon(
                    escuchando ? Icons.stop_rounded : Icons.mic_rounded,
                    key: ValueKey(escuchando),
                    size: size * 0.44,
                    color: onTap == null
                        ? context.colors.onSurfaceVariant
                        : escuchando
                            ? Nexo.turquoise
                            : context.colors.onPrimary,
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
