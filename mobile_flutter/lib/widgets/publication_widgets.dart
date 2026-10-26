import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme/motion.dart';
import '../core/theme/tokens.dart';
import '../data/models.dart';
import 'nexo_widgets.dart';

String etiquetaPublicacion(Publication p) => switch (p.estado) {
  'esperando_aprobacion' => 'Se publicará al aprobar',
  'publicando' => p.red == 'tiktok' ? 'Enviando a TikTok…' : 'Publicando…',
  'publicado' => 'Publicada',
  'en_buzon' => 'En tu buzón de TikTok',
  'fallido' =>
    p.resultadoIncierto ? 'Resultado incierto' : 'No se pudo publicar',
  'cancelado' => 'Cancelada',
  _ => p.estado,
};

/// Una publicación con su recorrido: aprobada → publicada (o enviada a
/// TikTok) → medida. Las métricas que Meta aún no entrega dicen "sin dato".
class PublicationTile extends StatelessWidget {
  const PublicationTile({
    super.key,
    required this.publicacion,
    this.onReintentar,
    this.onTap,
    this.onConsultar,
  });

  final Publication publicacion;
  final VoidCallback? onReintentar;
  final VoidCallback? onTap;

  /// TikTok: pregunta el estado del envío (no reenvía).
  final VoidCallback? onConsultar;

  @override
  Widget build(BuildContext context) {
    final p = publicacion;
    final medida = p.ultimaMetrica != null && !p.ultimaMetrica!.vacia;
    final aprobada =
        p.estado != 'esperando_aprobacion' && p.estado != 'cancelado';
    final publicada = p.estado == 'publicado';
    final enBuzon = p.estado == 'en_buzon';
    final fallo = p.estado == 'fallido';
    return NexoCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              NetworkIcon(p.red, size: 28),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.cuentaNombre,
                      style: context.text.titleSmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${etiquetaRed[p.red] ?? p.red} · ${etiquetaPublicacion(p)}',
                      style: context.text.bodySmall?.copyWith(
                        color: fallo ? context.colors.error : null,
                      ),
                    ),
                  ],
                ),
              ),
              if (p.permalink != null && p.permalink!.isNotEmpty)
                IconButton(
                  tooltip: 'Ver en ${etiquetaRed[p.red] ?? p.red}',
                  onPressed: () => launchUrl(
                    Uri.parse(p.permalink!),
                    mode: LaunchMode.externalApplication,
                  ),
                  icon: const Icon(Icons.open_in_new_rounded),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _Linea(
            pasos: [
              ('Aprobada', aprobada),
              (
                p.red == 'tiktok' ? 'Enviada a TikTok' : 'Publicada',
                publicada || enBuzon,
              ),
              ('Medida', medida),
            ],
            error: fallo,
          ),
          if (fallo && (p.error?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 10),
            Text(
              p.error!,
              style: context.text.bodySmall?.copyWith(
                color: context.colors.error,
              ),
            ),
          ],
          if (enBuzon) ...[
            const SizedBox(height: 10),
            Text(
              'TikTok no publica solo: abre la app de TikTok, revisa el borrador en tu buzón y publícalo.',
              style: context.text.bodySmall,
            ),
          ],
          if (publicada) ...[
            const SizedBox(height: 12),
            _MetricasMini(metrica: p.ultimaMetrica, red: p.red),
          ],
          if (onConsultar != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onConsultar,
                icon: const Icon(Icons.sync_rounded, size: 18),
                label: const Text('Consultar estado en TikTok'),
              ),
            ),
          ],
          if (onReintentar != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onReintentar,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Reintentar'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Linea extends StatelessWidget {
  const _Linea({required this.pasos, required this.error});

  final List<(String, bool)> pasos;
  final bool error;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (i, (label, hecho)) in pasos.indexed) ...[
          if (i > 0)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 8, left: 4, right: 4),
                child: AnimatedContainer(
                  duration: Motion.of(context, Motion.base),
                  height: 2,
                  color: hecho
                      ? context.colors.primary
                      : context.colors.outlineVariant,
                ),
              ),
            ),
          Column(
            children: [
              AnimatedContainer(
                duration: Motion.of(context, Motion.base),
                curve: Motion.easeOut,
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hecho
                      ? context.colors.primary
                      : (error && i == 1
                            ? context.colors.error
                            : context.colors.surfaceContainerLowest),
                  border: Border.all(
                    color: hecho ? Colors.transparent : context.colors.outline,
                  ),
                ),
                child: hecho
                    ? Icon(
                        Icons.check_rounded,
                        size: 12,
                        color: context.colors.onPrimary,
                      )
                    : (error && i == 1
                          ? Icon(
                              Icons.close_rounded,
                              size: 12,
                              color: context.colors.onError,
                            )
                          : null),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: context.text.labelSmall?.copyWith(
                  color: hecho ? null : context.colors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MetricasMini extends StatelessWidget {
  const _MetricasMini({required this.metrica, required this.red});

  final Metric? metrica;
  final String red;

  @override
  Widget build(BuildContext context) {
    final m = metrica;
    if (m == null || m.vacia) {
      return Text(
        red == 'tiktok' || red == 'x'
            ? 'Sin dato: ${etiquetaRed[red]} no entrega métricas con los permisos actuales.'
            : 'Meta todavía no entregó métricas (pueden tardar hasta 48 h).',
        style: context.text.bodySmall,
      );
    }
    final items = [
      (Icons.favorite_border_rounded, 'Me gusta', m.meGusta),
      (Icons.repeat_rounded, 'Compartidos', m.compartidos),
      (Icons.visibility_outlined, 'Alcance', m.alcance),
    ];
    return Row(
      children: [
        for (final (icon, label, value) in items)
          Expanded(
            child: Semantics(
              label: '$label: ${valorODato(value)}',
              child: Column(
                children: [
                  Icon(icon, size: 18, color: context.colors.onSurfaceVariant),
                  const SizedBox(height: 2),
                  Text(
                    valorODato(value),
                    style:
                        (value == null
                                ? context.text.bodySmall
                                : context.text.titleSmall)
                            ?.copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Fila de cuenta conectada en Redes.
class NetworkConnectionRow extends StatelessWidget {
  const NetworkConnectionRow({
    super.key,
    required this.red,
    required this.titulo,
    required this.detalle,
    this.trailing,
  });

  final String red;
  final String titulo;
  final String detalle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
        border: Border.all(color: context.colors.outlineVariant),
      ),
      child: Row(
        children: [
          NetworkIcon(red, size: 30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titulo,
                  style: context.text.titleSmall,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  detalle,
                  style: context.text.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
