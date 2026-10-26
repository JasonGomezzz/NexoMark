import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../widgets/campaign_widgets.dart';
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

const _etiquetaCampo = {
  'titulo': 'Título de la campaña',
  'cliente_nombre': 'Nombre del cliente',
  'cliente_email': 'Correo del cliente',
  'industria': 'Industria',
  'tono': 'Tono',
  'plataforma': 'Red social',
  'prompt': 'Instrucciones para la IA',
};

enum _Etapa { brief, campos, generando }

class LabScreen extends ConsumerStatefulWidget {
  const LabScreen({super.key});

  @override
  ConsumerState<LabScreen> createState() => _LabScreenState();
}

class _LabScreenState extends ConsumerState<LabScreen> {
  final _brief = TextEditingController();
  late final DictationController _dictado = DictationController(
    onText: (t) {
      _brief.value = TextEditingValue(
        text: t,
        selection: TextSelection.collapsed(offset: t.length),
      );
    },
  );
  final _campos = <String, TextEditingController>{
    for (final c in camposIntent) c: TextEditingController(),
  };

  _Etapa _etapa = _Etapa.brief;
  CampaignIntent? _intent;
  Campaign? _campana;
  bool _ocupado = false;
  bool _porVoz = false;

  /// Medición voz vs. formulario: desde el primer toque del micrófono o la primera letra.
  DateTime? _inicioCaptura;
  void _marcarInicio() => _inicioCaptura ??= DateTime.now();
  String? _error;
  Timer? _sondeo;

  @override
  void initState() {
    super.initState();
    // Solo para probar en el simulador (no hay micrófono): `--dart-define=DEMO_BRIEF=…`.
    if (kDebugMode) _brief.text = const String.fromEnvironment('DEMO_BRIEF');
    _brief.addListener(() {
      if (_brief.text.isNotEmpty) _marcarInicio();
    });
    _dictado.preparar();
    _dictado.addListener(() {
      if (_dictado.escuchando) {
        _porVoz = true;
        _marcarInicio();
      }
    });
  }

  @override
  void dispose() {
    _sondeo?.cancel();
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
      return setState(
        () => _error = 'Cuéntale un poco más (al menos 10 caracteres).',
      );
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      final inicio = _inicioCaptura;
      final capturaMs = inicio == null
          ? null
          : DateTime.now().difference(inicio).inMilliseconds.clamp(0, 3600000);
      final intent = await ref
          .read(campaignRepositoryProvider)
          .interpret(_brief.text, porVoz: _porVoz, capturaMs: capturaMs);
      _inicioCaptura = null;
      for (final campo in camposIntent) {
        _campos[campo]!.text = intent.campos[campo] ?? '';
      }
      HapticFeedback.selectionClick();
      setState(() {
        _intent = intent;
        _etapa = _Etapa.campos;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Map<String, String?> get _valores => {
    for (final e in _campos.entries)
      e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim(),
  };

  Future<void> _confirmar() async {
    final faltan = camposIntent.where((c) => _valores[c] == null).toList();
    if (faltan.isNotEmpty) {
      return setState(
        () => _error =
            'Completa: ${faltan.map((c) => _etiquetaCampo[c]!.toLowerCase()).join(', ')}.',
      );
    }
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      final campana = await ref
          .read(campaignRepositoryProvider)
          .confirm(_intent!.id, _valores);
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
      setState(
        () => _error = e.status == 402
            ? 'No te quedan créditos. Solicita más para generar.'
            : mensajeCampos(e),
      );
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  String mensajeCampos(ApiException e) {
    for (final entry in e.data.entries) {
      final v = entry.value;
      if (v is List && v.isNotEmpty) {
        return '${_etiquetaCampo[entry.key] ?? entry.key}: ${v.first}';
      }
    }
    return e.message;
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
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final sinCreditos = user?.sinCreditos ?? false;
    final paso = switch (_etapa) {
      _Etapa.brief => 0,
      _Etapa.campos => 0,
      _Etapa.generando => _campana?.estado == EstadoCampana.generado ? 2 : 1,
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Laboratorio IA')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            FlowStepper(current: paso),
            const SizedBox(height: 16),
            if (sinCreditos && _etapa != _Etapa.generando) ...[
              _SinCreditos(onRequest: () => context.push('/m/cuenta/creditos')),
              const SizedBox(height: 14),
            ],
            AnimatedSwitcher(
              duration: Motion.of(context, Motion.base),
              switchInCurve: Motion.easeOut,
              switchOutCurve: Motion.easeOut,
              transitionBuilder: (child, a) => FadeTransition(
                opacity: a,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0, 0.03),
                    end: Offset.zero,
                  ).animate(a),
                  child: child,
                ),
              ),
              child: switch (_etapa) {
                _Etapa.brief => _etapaBrief(context),
                _Etapa.campos => _etapaCampos(context, sinCreditos),
                _Etapa.generando => _etapaGenerando(context),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _etapaBrief(BuildContext context) {
    return Column(
      key: const ValueKey('brief'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        VoiceBriefCard(dictado: _dictado, texto: _brief),
        if (_error != null) ...[
          const SizedBox(height: 12),
          ErrorBanner(message: _error!),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _ocupado ? null : _interpretar,
          icon: _ocupado
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : const Icon(Icons.auto_awesome_rounded),
          label: Text(
            _ocupado ? 'Preparando…' : 'Completar datos de la campaña',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'El dictado se convierte en instrucciones. Completa los datos antes de generar; este paso no gasta créditos.',
          style: context.text.bodySmall,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _etapaCampos(BuildContext context, bool sinCreditos) {
    final intent = _intent!;
    var i = 0;
    Widget campo(String clave, Widget child) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Entrance(index: i++, child: child),
    );
    InputDecoration deco(String clave) => InputDecoration(
      labelText: _etiquetaCampo[clave],
      helperText:
          intent.faltantes.contains(clave) && _campos[clave]!.text.isEmpty
          ? 'Completa este dato antes de generar.'
          : null,
    );
    return Column(
      key: const ValueKey('campos'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          'Completa los datos de la campaña',
          subtitle: 'El brief está en las instrucciones. Revisa todo antes de generar.',
        ),
        for (final aviso in intent.advertencias)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InfoBanner(
              message: aviso,
              tone: InfoTone.warning,
              icon: Icons.warning_amber_rounded,
            ),
          ),
        campo(
          'titulo',
          TextField(controller: _campos['titulo'], decoration: deco('titulo')),
        ),
        campo(
          'cliente_nombre',
          TextField(
            controller: _campos['cliente_nombre'],
            decoration: deco('cliente_nombre'),
          ),
        ),
        campo(
          'cliente_email',
          TextField(
            controller: _campos['cliente_email'],
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: deco('cliente_email').copyWith(
              helperText: 'Aquí le llegará la campaña para aprobar. Debe ser el correo de su cuenta de cliente.',
              helperMaxLines: 2,
            ),
          ),
        ),
        campo(
          'industria',
          _SelectorChips(
            titulo: 'Industria',
            opciones: const {
              'tecnologia': 'Tecnología',
              'salud': 'Salud',
              'educacion': 'Educación',
              'retail': 'Retail',
              'gastronomia': 'Gastronomía',
              'moda': 'Moda',
              'finanzas': 'Finanzas',
              'entretenimiento': 'Entretenimiento',
              'otro': 'Otro',
            },
            valor: _campos['industria']!.text,
            onChanged: (v) => setState(() => _campos['industria']!.text = v),
          ),
        ),
        campo(
          'tono',
          _SelectorChips(
            titulo: 'Tono',
            opciones: tonos,
            valor: _campos['tono']!.text,
            onChanged: (v) => setState(() => _campos['tono']!.text = v),
          ),
        ),
        campo(
          'plataforma',
          _SelectorChips(
            titulo: 'Red social (orienta el texto)',
            opciones: {
              'instagram': 'Instagram',
              'facebook': 'Facebook',
              'tiktok': 'TikTok',
              'twitter': 'X',
            },
            valor: _campos['plataforma']!.text,
            iconos: true,
            onChanged: (v) => setState(() => _campos['plataforma']!.text = v),
          ),
        ),
        campo(
          'prompt',
          TextField(
            controller: _campos['prompt'],
            minLines: 3,
            maxLines: 6,
            decoration: deco('prompt'),
          ),
        ),
        if (_error != null) ...[
          ErrorBanner(message: _error!),
          const SizedBox(height: 12),
        ],
        FilledButton.icon(
          onPressed: _ocupado || sinCreditos ? null : _confirmar,
          icon: _ocupado
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : const Icon(Icons.bolt_rounded),
          label: Text(
            _ocupado ? 'Enviando a la IA…' : 'Confirmar y generar · 1 crédito',
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _ocupado ? null : _descartar,
          child: const Text('Volver al brief'),
        ),
      ],
    );
  }

  Widget _etapaGenerando(BuildContext context) {
    final c = _campana!;
    final listo = c.estado == EstadoCampana.generado;
    final fallo = c.estado == EstadoCampana.borrador;
    return Column(
      key: const ValueKey('generando'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NexoCard(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: CampaignImage(campaign: c, radius: 10),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(c.titulo, style: context.text.titleMedium),
                  ),
                  StatePill(c.estado),
                ],
              ),
              const SizedBox(height: 10),
              SwapIn(
                child: listo
                    ? Text(
                        c.textoGenerado ?? '',
                        key: const ValueKey('texto'),
                        maxLines: 6,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.bodyMedium,
                      )
                    : fallo
                    ? InfoBanner(
                        key: const ValueKey('fallo'),
                        tone: InfoTone.warning,
                        message:
                            '${c.iaErrorMessage ?? 'La IA no pudo generar la campaña.'} Se devolvió el crédito; puedes regenerarla desde Proyectos.',
                      )
                    : const Column(
                        key: ValueKey('esqueleto'),
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Skeleton(height: 14),
                          SizedBox(height: 8),
                          Skeleton(height: 14),
                          SizedBox(height: 8),
                          Skeleton(width: 180, height: 14),
                        ],
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (!listo && !fallo)
          Text(
            'La IA está escribiendo el texto y creando la imagen. Puedes salir: te avisamos aquí y en Proyectos cuando termine.',
            style: context.text.bodySmall,
            textAlign: TextAlign.center,
          ),
        if (listo || fallo) ...[
          FilledButton(
            onPressed: () => context.go('/m/proyectos/${c.id}'),
            child: Text(
              listo ? 'Revisar y enviar al cliente' : 'Abrir el proyecto',
            ),
          ),
          const SizedBox(height: 8),
        ],
        OutlinedButton(
          onPressed: _nueva,
          child: const Text('Dictar otra campaña'),
        ),
      ],
    );
  }
}

class _SinCreditos extends StatelessWidget {
  const _SinCreditos({required this.onRequest});
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.nexo.warningContainer,
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Modo lectura: no te quedan créditos',
            style: context.text.titleSmall?.copyWith(
              color: context.nexo.warning,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Puedes preparar el brief y ver tu historial, pero generar necesita 1 crédito.',
            style: context.text.bodySmall?.copyWith(
              color: context.nexo.warning,
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onRequest,
            style: TextButton.styleFrom(
              foregroundColor: context.nexo.warning,
              padding: EdgeInsets.zero,
            ),
            child: const Text('Solicitar créditos'),
          ),
        ],
      ),
    );
  }
}

/// Opciones cortas como fichas. La elegida se rellena con transición de color.
class _SelectorChips extends StatelessWidget {
  const _SelectorChips({
    required this.titulo,
    required this.opciones,
    required this.valor,
    required this.onChanged,
    this.iconos = false,
  });

  final String titulo;
  final Map<String, String> opciones;
  final String valor;
  final ValueChanged<String> onChanged;
  final bool iconos;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          titulo,
          style: context.text.labelLarge?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in opciones.entries)
              Pressable(
                onTap: () => onChanged(e.key),
                haptic: true,
                child: AnimatedContainer(
                  duration: Motion.of(context, Motion.fast),
                  curve: Motion.easeOut,
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: valor == e.key
                        ? context.colors.primaryFixed
                        : context.colors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(Nexo.radiusButton),
                    border: Border.all(
                      color: valor == e.key
                          ? context.colors.primary
                          : context.colors.outlineVariant,
                      width: valor == e.key ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (iconos) ...[
                        NetworkIcon(e.key, size: 18),
                        const SizedBox(width: 6),
                      ],
                      Text(e.value, style: context.text.labelLarge),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
