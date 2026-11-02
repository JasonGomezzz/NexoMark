import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
import '../../widgets/conforme.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import '../voice/dictation.dart';
import '../voice/voice_card.dart';
import 'providers.dart';

const tonos = {
  'profesional': 'Profesional',
  'casual': 'Casual',
  'urgente': 'Urgente',
  'inspiracional': 'Inspiracional',
  'humoristico': 'Humorístico',
  'persuasivo': 'Persuasivo',
};

/// Industrias que acepta el servidor (`intent_service`). Otro valor no se guarda.
const industrias = {
  'gastronomia': 'Gastronomía',
  'retail': 'Retail',
  'moda': 'Moda',
  'tecnologia': 'Tecnología',
  'salud': 'Salud',
  'educacion': 'Educación',
  'finanzas': 'Finanzas',
  'entretenimiento': 'Entretenimiento',
  'otro': 'Otro',
};

const _etiquetaCampo = {
  'titulo': 'Título de la campaña',
  'cliente_nombre': 'Nombre del cliente',
  'cliente_email': 'Correo del cliente',
  'industria': 'Industria',
  'tono': 'Tono',
  'plataforma': 'Red social',
  'prompt': 'Instrucciones para la IA',
};

/// Errores por campo del sobre de Django: vienen en `data.errors` o en `data`.
Map<String, String> erroresPorCampo(ApiException e) {
  final fuente = e.data['errors'] is Map ? e.data['errors'] as Map : e.data;
  return {
    for (final entry in fuente.entries)
      if (_etiquetaCampo.containsKey(entry.key) && entry.value is List && (entry.value as List).isNotEmpty)
        '${entry.key}': '${(entry.value as List).first}',
  };
}

enum _Etapa { brief, campos, generando }

class LabScreen extends ConsumerStatefulWidget {
  const LabScreen({super.key});

  @override
  ConsumerState<LabScreen> createState() => _LabScreenState();
}

class _LabScreenState extends ConsumerState<LabScreen> {
  final _brief = TextEditingController();
  late final DictationController _dictado = DictationController(onText: (t) {
    _brief.value = TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));
  });
  final _campos = <String, TextEditingController>{for (final c in camposIntent) c: TextEditingController()};

  _Etapa _etapa = _Etapa.brief;
  CampaignIntent? _intent;
  Campaign? _campana;
  bool _ocupado = false;
  bool _porVoz = false;
  bool _escribiendo = false;
  String? _error;
  Map<String, String> _erroresCampo = const {};
  Timer? _sondeo;

  /// Medición voz vs. formulario: desde el primer toque del micrófono o la primera letra.
  DateTime? _inicioCaptura;
  void _marcarInicio() => _inicioCaptura ??= DateTime.now();

  // Reloj del dictado: tiempo escuchando (suma las pausas); va en el aro del micrófono.
  Duration _acumulado = Duration.zero;
  DateTime? _inicioSesion;
  Timer? _reloj;

  Duration get _escuchado => _acumulado + (_inicioSesion == null ? Duration.zero : DateTime.now().difference(_inicioSesion!));

  @override
  void initState() {
    super.initState();
    // Solo para probar en el simulador (no hay micrófono): `--dart-define=DEMO_BRIEF=…`.
    if (kDebugMode) _brief.text = const String.fromEnvironment('DEMO_BRIEF');
    _brief.addListener(_alCambiarBrief);
    _dictado.preparar().then((_) {
      if (mounted && _dictado.modo == ModoDictado.noDisponible) setState(() => _escribiendo = true);
    });
    _dictado.addListener(_alCambiarDictado);
  }

  void _alCambiarBrief() {
    if (_brief.text.isNotEmpty) _marcarInicio();
    setState(() {});
  }

  void _alCambiarDictado() {
    if (_dictado.escuchando) {
      _porVoz = true;
      _marcarInicio();
      if (_inicioSesion == null) {
        _inicioSesion = DateTime.now();
        _reloj ??= Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
      }
    } else if (_inicioSesion != null) {
      _acumulado += DateTime.now().difference(_inicioSesion!);
      _inicioSesion = null;
      _reloj?.cancel();
      _reloj = null;
    }
  }

  @override
  void dispose() {
    _sondeo?.cancel();
    _reloj?.cancel();
    _dictado.dispose();
    _brief.dispose();
    for (final c in _campos.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _interpretar() async {
    if (_dictado.escuchando) await _dictado.detener();
    if (!mounted) return;
    if (_brief.text.trim().length < 10) {
      return setState(() => _error = 'Cuéntale un poco más: al menos 10 caracteres.');
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      final inicio = _inicioCaptura;
      final capturaMs = inicio == null ? null : DateTime.now().difference(inicio).inMilliseconds.clamp(0, 3600000);
      final intent = await ref.read(campaignRepositoryProvider).interpret(
            _brief.text,
            porVoz: _porVoz,
            capturaMs: capturaMs,
          );
      _inicioCaptura = null;
      for (final campo in camposIntent) {
        var valor = intent.campos[campo] ?? '';
        // Solo valores que el servidor acepta en las fichas.
        if (campo == 'industria' && !industrias.containsKey(valor)) valor = '';
        if (campo == 'tono' && !tonos.containsKey(valor)) valor = '';
        _campos[campo]!.text = valor;
      }
      HapticFeedback.selectionClick();
      setState(() {
        _intent = intent;
        _erroresCampo = const {};
        _etapa = _Etapa.campos;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Map<String, String?> get _valores => {
        for (final e in _campos.entries) e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim(),
      };

  Future<void> _confirmar() async {
    final faltan = camposIntent.where((c) => _valores[c] == null).toList();
    if (faltan.isNotEmpty) {
      return setState(() {
        _erroresCampo = {for (final c in faltan) c: 'Falta completarlo.'};
        _error = faltan.length == 1
            ? 'Falta ${_etiquetaCampo[faltan.first]!.toLowerCase()}.'
            : 'Faltan ${faltan.length} campos: ${faltan.map((c) => _etiquetaCampo[c]!.toLowerCase()).join(', ')}.';
      });
    }
    setState(() {
      _ocupado = true;
      _error = null;
      _erroresCampo = const {};
    });
    try {
      final campana = await ref.read(campaignRepositoryProvider).confirm(_intent!.id, _valores);
      HapticFeedback.mediumImpact();
      setState(() {
        _campana = campana;
        _etapa = _Etapa.generando;
      });
      ref.invalidate(campaignListProvider);
      ref.invalidate(campaignStatsProvider);
      unawaited(ref.read(sessionProvider.notifier).refreshUser());
      _vigilarGeneracion(campana.id);
    } on ApiException catch (e) {
      final porCampo = erroresPorCampo(e);
      setState(() {
        _erroresCampo = porCampo;
        _error = e.status == 402
            ? 'No te quedan créditos. Solicita más para generar.'
            : porCampo.isNotEmpty
                ? 'Revisa ${porCampo.keys.map((c) => _etiquetaCampo[c]!.toLowerCase()).join(', ')}.'
                : e.message;
      });
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  /// La IA trabaja en n8n: se consulta cada 3 s hasta que deja "pendiente_ia".
  void _vigilarGeneracion(int id) {
    _sondeo?.cancel();
    _sondeo = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final c = await ref.read(campaignRepositoryProvider).get(id);
        if (!mounted) return;
        setState(() => _campana = c);
        if (c.estado != EstadoCampana.pendienteIa) {
          _sondeo?.cancel();
          ref.invalidate(campaignListProvider);
          ref.invalidate(campaignStatsProvider);
          unawaited(ref.read(sessionProvider.notifier).refreshUser());
          if (c.estado == EstadoCampana.generado) HapticFeedback.heavyImpact();
        }
      } catch (_) {
        // Un fallo de red puntual no corta la espera: se reintenta en el siguiente ciclo.
      }
    });
  }

  Future<void> _descartar() async {
    final intent = _intent;
    setState(() {
      _etapa = _Etapa.brief;
      _intent = null;
      _error = null;
      _erroresCampo = const {};
    });
    if (intent != null) {
      try {
        await ref.read(campaignRepositoryProvider).discard(intent.id);
      } catch (_) {
        // Descartar es limpieza: si falla, la intención queda como borrador sin efecto.
      }
    }
  }

  void _nueva() {
    _sondeo?.cancel();
    _brief.clear();
    for (final c in _campos.values) {
      c.clear();
    }
    setState(() {
      _etapa = _Etapa.brief;
      _intent = null;
      _campana = null;
      _porVoz = false;
      _inicioCaptura = null;
      _acumulado = Duration.zero;
      _error = null;
      _erroresCampo = const {};
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final sinCreditos = user?.sinCreditos ?? false;
    final (contenido, pie) = switch (_etapa) {
      _Etapa.brief => (_etapaBrief(context, sinCreditos), _pieBrief(context)),
      _Etapa.campos => (_etapaCampos(context), _pieCampos(context, sinCreditos)),
      _Etapa.generando => (_etapaGenerando(context), _pieGenerando(context)),
    };
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: AnimatedSwitcher(
        duration: Motion.of(context, Motion.base),
        switchInCurve: Motion.easeOut,
        switchOutCurve: Motion.easeOut,
        transitionBuilder: (child, a) => FadeTransition(
          opacity: a,
          child: SlideTransition(
            position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(a),
            child: child,
          ),
        ),
        child: KeyedSubtree(key: ValueKey(_etapa), child: contenido),
      ),
      bottomNavigationBar: PieAccion(child: pie),
    );
  }

  // ── Etapa 1: dictar ──────────────────────────────────────

  Widget _etapaBrief(BuildContext context, bool sinCreditos) {
    final vozDisponible = _dictado.modo != ModoDictado.noDisponible;
    return ListenableBuilder(
      listenable: _dictado,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          PliegoTitulo(
            contexto: 'Orden nueva · paso\u00A01\u00A0de\u00A05',
            titulo: 'Dicta la campaña',
            accion: vozDisponible
                ? TextButton.icon(
                    onPressed: () {
                      if (_dictado.escuchando) _dictado.detener();
                      setState(() => _escribiendo = !_escribiendo);
                    },
                    icon: Icon(_escribiendo ? LucideIcons.mic : LucideIcons.pencilLine, size: 18),
                    label: Text(_escribiendo ? 'Dictar' : (_brief.text.isEmpty ? 'Escribir' : 'Editar')),
                  )
                : null,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Nexo.gutter, 20, Nexo.gutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (sinCreditos) ...[
                  _SinCreditos(onRequest: () => context.push('/m/cuenta/creditos')),
                  const SizedBox(height: 16),
                ],
                if (_escribiendo)
                  TextField(
                    controller: _brief,
                    autofocus: vozDisponible,
                    minLines: 5,
                    maxLines: 12,
                    maxLength: 2000,
                    textCapitalization: TextCapitalization.sentences,
                    style: context.text.titleLarge?.copyWith(fontWeight: FontWeight.w600, height: 1.35),
                    decoration: const InputDecoration(hintText: 'Producto, promoción, cliente, tono y red…', counterText: ''),
                  )
                else
                  ParrafoDictado(
                    texto: _brief.text,
                    confirmado: _dictado.confirmado,
                    escuchando: _dictado.escuchando,
                    ejemplo: 'Toca el micrófono y cuéntala como se la contarías a un diseñador: «Súbeme una foto con 2×1 '
                        'en capuchinos los martes para Café Aurora, tono casual, para Instagram».',
                  ),
                const SizedBox(height: 20),
                AvisoPrivacidad(dictado: _dictado),
                if (_dictado.aviso != null) ...[
                  const SizedBox(height: 10),
                  SwapIn(child: InfoBanner(key: ValueKey(_dictado.aviso), message: _dictado.aviso!, tone: InfoTone.warning)),
                ],
                if (_error != null) ...[const SizedBox(height: 12), ErrorBanner(message: _error!)],
                const SizedBox(height: 24),
                const Regla(),
                const SizedBox(height: 18),
                const _FichaPorCompletar(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pieBrief(BuildContext context) {
    return ListenableBuilder(
      listenable: _dictado,
      builder: (context, _) {
        final vozDisponible = _dictado.modo != ModoDictado.noDisponible && !_escribiendo;
        final hayTexto = _brief.text.trim().isNotEmpty;
        final (titulo, detalle) = switch (null) {
          _ when _dictado.escuchando => ('Te escucho', 'Toca para terminar. Puedes pausar y seguir.'),
          _ when hayTexto => (_porVoz ? 'Dictado listo' : 'Texto listo', 'Toca el micrófono para seguir dictando.'),
          _ => ('Toca y cuenta la campaña', 'Producto, promoción, cliente, tono y red.'),
        };
        final completar = SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _ocupado || !hayTexto ? null : _interpretar,
            icon: _ocupado
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator.adaptive(strokeWidth: 2.5))
                : const Icon(LucideIcons.wandSparkles, size: 18),
            label: Text(_ocupado ? 'Completando la ficha…' : 'Completar ficha'),
          ),
        );
        if (!vozDisponible) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              completar,
              const SizedBox(height: 6),
              Text('Completar la ficha no usa créditos; generar la campaña usa 1.', style: context.text.bodySmall, textAlign: TextAlign.center),
            ],
          );
        }
        return Row(
          children: [
            MicSello(
              escuchando: _dictado.escuchando,
              nivel: _dictado.nivel,
              tiempo: _escuchado,
              onTap: _dictado.preparado && !_ocupado ? () => _dictado.alternar(_brief.text) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titulo, style: context.text.headlineSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(detalle, style: context.text.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (hayTexto && !_dictado.escuchando) ...[const SizedBox(height: 10), completar],
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  // ── Etapa 2: la ficha técnica ────────────────────────────

  Widget _etapaCampos(BuildContext context) {
    final xActivo = ref.watch(xConfigProvider).value?.habilitado ?? false;
    final tiktok = ref.watch(tiktokConfigProvider).value?.configurado ?? false;
    final intent = _intent!;
    final plataforma = _campos['plataforma']!.text;

    _Origen origen(String clave) {
      final actual = _campos[clave]!.text.trim();
      if (actual.isEmpty) return _Origen.falta;
      return actual == (intent.campos[clave] ?? '').trim() ? _Origen.ia : _Origen.tuyo;
    }

    Widget texto(String clave, {TextInputType? teclado, int minLines = 1, int maxLines = 1, String? ayuda}) => TextField(
          controller: _campos[clave],
          keyboardType: teclado,
          autocorrect: teclado != TextInputType.emailAddress,
          minLines: minLines,
          maxLines: maxLines,
          onChanged: (_) => setState(() => _erroresCampo = {..._erroresCampo}..remove(clave)),
          decoration: InputDecoration(
            hintText: 'Escríbelo aquí',
            helperText: ayuda,
            errorText: _erroresCampo[clave],
          ),
        );

    Widget fichas(String clave, Map<String, String> opciones, {bool iconos = false}) => _SelectorFichas(
          opciones: opciones,
          valor: _campos[clave]!.text,
          error: _erroresCampo[clave],
          iconos: iconos,
          etiqueta: _etiquetaCampo[clave]!,
          onChanged: (v) => setState(() {
            _campos[clave]!.text = v;
            _erroresCampo = {..._erroresCampo}..remove(clave);
          }),
        );

    final filas = <(String, Widget)>[
      ('titulo', texto('titulo', maxLines: 2)),
      ('cliente_nombre', texto('cliente_nombre')),
      ('cliente_email', texto('cliente_email', teclado: TextInputType.emailAddress, ayuda: 'Aquí le llega la campaña para aprobar: el correo de su cuenta de cliente.')),
      ('industria', fichas('industria', industrias)),
      ('tono', fichas('tono', tonos)),
      (
        'plataforma',
        fichas(
          'plataforma',
          {
            'instagram': 'Instagram',
            'facebook': 'Facebook',
            if (tiktok || plataforma == 'tiktok') 'tiktok': 'TikTok',
            if (xActivo || plataforma == 'twitter') 'twitter': 'X',
          },
          iconos: true,
        ),
      ),
      ('prompt', texto('prompt', minLines: 3, maxLines: 8)),
    ];
    final faltan = filas.where((f) => origen(f.$1) == _Origen.falta).length;

    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        PliegoTitulo(
          contexto: 'Orden nueva · paso\u00A02\u00A0de\u00A05',
          titulo: 'Ficha técnica',
          subtitulo: faltan == 0
              ? 'La IA la llenó con lo que dijiste. Corrige lo que haga falta: nada se genera hasta que confirmes.'
              : faltan == 1
                  ? 'Falta 1 dato que la IA no encontró en el brief.'
                  : 'Faltan $faltan datos que la IA no encontró en el brief.',
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 8, Nexo.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final aviso in intent.advertencias)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: InfoBanner(message: aviso, tone: InfoTone.warning, icon: LucideIcons.triangleAlert),
                ),
              for (var i = 0; i < filas.length; i++) ...[
                Entrance(
                  index: i,
                  child: _FilaFicha(etiqueta: _etiquetaCampo[filas[i].$1]!, origen: origen(filas[i].$1), child: filas[i].$2),
                ),
                if (i < filas.length - 1) Divider(color: context.nexo.hairline),
              ],
              if (_error != null) ...[const SizedBox(height: 12), ErrorBanner(message: _error!)],
            ],
          ),
        ),
      ],
    );
  }

  Widget _pieCampos(BuildContext context, bool sinCreditos) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton.icon(
          onPressed: _ocupado || sinCreditos ? null : _confirmar,
          icon: _ocupado
              ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator.adaptive(strokeWidth: 2.5))
              : const Icon(LucideIcons.wandSparkles, size: 18),
          label: Text(_ocupado ? 'Enviando a la IA…' : 'Generar campaña · 1 crédito'),
        ),
        const SizedBox(height: 2),
        TextButton(onPressed: _ocupado ? null : _descartar, child: const Text('Volver al dictado')),
      ],
    );
  }

  // ── Etapa 3: generando ───────────────────────────────────

  Widget _etapaGenerando(BuildContext context) {
    final c = _campana!;
    final listo = c.estado == EstadoCampana.generado;
    final fallo = c.estado == EstadoCampana.borrador;
    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        PliegoTitulo(
          contexto: 'Orden nueva · paso\u00A02\u00A0de\u00A05',
          titulo: listo ? 'Prueba lista' : (fallo ? 'No se pudo generar' : 'Generando'),
          subtitulo: listo
              ? 'Revisa el texto y la imagen, y envíala a tu cliente.'
              : fallo
                  ? null
                  : 'La IA escribe el texto y crea la imagen. Puedes salir: te espera en Generar.',
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Nexo.gutter, 20, Nexo.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(aspectRatio: 1, child: CampaignImage(campaign: c)),
              const SizedBox(height: 16),
              Align(alignment: Alignment.centerLeft, child: StatePill(c.estado)),
              const SizedBox(height: 10),
              Text(c.titulo, style: context.text.headlineSmall),
              const SizedBox(height: 12),
              SwapIn(
                child: listo
                    ? Text(c.textoGenerado ?? '', key: const ValueKey('texto'), style: context.text.bodyLarge)
                    : fallo
                        ? InfoBanner(
                            key: const ValueKey('fallo'),
                            tone: InfoTone.warning,
                            message: '${c.iaErrorMessage ?? 'La IA no pudo generar la campaña.'} Se devolvió el crédito; puedes regenerarla desde Generar.',
                          )
                        : const Column(
                            key: ValueKey('esqueleto'),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Skeleton(height: 16),
                              SizedBox(height: 10),
                              Skeleton(height: 16),
                              SizedBox(height: 10),
                              Skeleton(width: 180, height: 16),
                            ],
                          ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _pieGenerando(BuildContext context) {
    final c = _campana;
    final terminado = c != null && c.estado != EstadoCampana.pendienteIa;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (terminado) ...[
          FilledButton.icon(
            onPressed: () => context.push('/m/campana/${c.id}', extra: c),
            icon: const Icon(LucideIcons.send, size: 18),
            label: Text(c.estado == EstadoCampana.generado ? 'Revisar y enviar al cliente' : 'Abrir la campaña'),
          ),
          const SizedBox(height: 2),
        ],
        TextButton.icon(onPressed: _nueva, icon: const Icon(LucideIcons.mic, size: 18), label: const Text('Dictar otra campaña')),
      ],
    );
  }
}

/// La ficha técnica antes de dictar: los siete campos «por completar».
class _FichaPorCompletar extends StatelessWidget {
  const _FichaPorCompletar();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Ficha técnica', style: context.text.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Al terminar, la IA la llena con lo que dijiste. Lo que no reconozca queda vacío y te avisa. '
          'Completar la ficha no usa créditos; generar la campaña usa 1.',
          style: context.text.bodySmall,
        ),
        const SizedBox(height: 12),
        for (final (i, campo) in _etiquetaCampo.values.indexed) ...[
          if (i > 0) Divider(color: context.nexo.hairline),
          SizedBox(
            height: 40,
            child: Row(
              children: [
                Expanded(child: Text(campo, style: context.text.bodyMedium)),
                Text('por completar', style: context.text.bodySmall?.copyWith(color: context.colors.outline)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

enum _Origen { ia, tuyo, falta }

/// Una fila de la ficha: el nombre del campo, de dónde salió el dato y el control.
class _FilaFicha extends StatelessWidget {
  const _FilaFicha({required this.etiqueta, required this.origen, required this.child});

  final String etiqueta;
  final _Origen origen;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final (texto, color) = switch (origen) {
      _Origen.ia => ('propuesto por la IA', context.colors.primary),
      _Origen.tuyo => ('corregido por ti', context.colors.onSurfaceVariant),
      _Origen.falta => ('falta', context.nexo.warning),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: Text(etiqueta, style: context.text.titleSmall)),
              AnimatedSwitcher(
                duration: Motion.of(context, Motion.fast),
                child: Text(texto, key: ValueKey(texto), style: context.text.bodySmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _SinCreditos extends StatelessWidget {
  const _SinCreditos({required this.onRequest});
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(color: context.nexo.warningContainer, borderRadius: BorderRadius.circular(Nexo.radiusSurface)),
      child: Row(
        children: [
          Icon(LucideIcons.zap, size: 18, color: context.nexo.warning),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Sin créditos: puedes preparar el brief, pero generar usa 1.',
              style: context.text.bodySmall?.copyWith(color: context.nexo.warning),
            ),
          ),
          TextButton(
            onPressed: onRequest,
            style: TextButton.styleFrom(foregroundColor: context.nexo.warning),
            child: const Text('Solicitar'),
          ),
        ],
      ),
    );
  }
}

/// Opciones cortas como fichas. La elegida se rellena con `primary`.
class _SelectorFichas extends StatelessWidget {
  const _SelectorFichas({
    required this.opciones,
    required this.valor,
    required this.onChanged,
    required this.etiqueta,
    this.error,
    this.iconos = false,
  });

  final Map<String, String> opciones;
  final String valor;
  final ValueChanged<String> onChanged;
  final String etiqueta;
  final String? error;
  final bool iconos;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: etiqueta,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final e in opciones.entries)
                ChoiceChip(
                  label: Text(e.value),
                  avatar: iconos ? NetworkIcon(e.key, size: 18) : null,
                  selected: valor == e.key,
                  showCheckmark: false,
                  onSelected: (_) {
                    HapticFeedback.selectionClick();
                    onChanged(e.key);
                  },
                  backgroundColor: context.colors.surfaceContainerLowest,
                  selectedColor: context.colors.primary,
                  side: BorderSide(color: valor == e.key ? context.colors.primary : context.colors.outlineVariant),
                  labelStyle: context.text.labelLarge?.copyWith(color: valor == e.key ? context.colors.onPrimary : context.colors.onSurface),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                ),
            ],
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Text(error!, style: context.text.bodySmall?.copyWith(color: context.colors.error)),
            ),
        ],
      ),
    );
  }
}
