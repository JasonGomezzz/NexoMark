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
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';
import 'google_auth.dart';

/// Primer mensaje legible de un error de validación de Django ({campo: [mensaje]}).
String mensajeDe(ApiException e) {
  for (final value in e.data.values) {
    if (value is List && value.isNotEmpty && value.first is String) return value.first as String;
    if (value is String && value.isNotEmpty) return value;
  }
  return e.message;
}

final _correo = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _nombre = TextEditingController();

  bool _registro = false;
  Rol _rol = Rol.marketero;
  bool _verPassword = false;
  bool _enviando = false;
  bool _googleListo = false;
  String? _error;
  String? _bienvenida;

  @override
  void initState() {
    super.initState();
    // Solo para pruebas en el simulador: `--dart-define=DEMO_EMAIL=… --dart-define=DEMO_PASSWORD=…`.
    // En una compilación release no existe.
    if (kDebugMode) {
      _email.text = const String.fromEnvironment('DEMO_EMAIL');
      _password.text = const String.fromEnvironment('DEMO_PASSWORD');
    }
    GoogleAuth(ref.read(authRepositoryProvider)).configurado().then((ok) {
      if (mounted) setState(() => _googleListo = ok);
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    _nombre.dispose();
    super.dispose();
  }

  /// "Bienvenido, {nombre}" un instante y recién entonces se entra: el
  /// momento se nota sin hacer esperar (es una vez por sesión).
  Future<void> _entrar(AppUser user) async {
    HapticFeedback.mediumImpact();
    final pausa = Motion.reduced(context) ? const Duration(milliseconds: 400) : const Duration(milliseconds: 900);
    setState(() => _bienvenida = user.primerNombre);
    await Future<void>.delayed(pausa);
    await ref.read(sessionProvider.notifier).signedIn(user);
  }

  Future<void> _enviar() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    final auth = ref.read(authRepositoryProvider);
    try {
      final user = _registro
          ? await auth.register(email: _email.text, nombre: _nombre.text, password: _password.text, rol: _rol)
          : await auth.login(_email.text, _password.text);
      await _entrar(user);
    } on ApiException catch (e) {
      setState(() => _error = e.status == 401 ? 'Correo o contraseña incorrectos.' : mensajeDe(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    final google = GoogleAuth(ref.read(authRepositoryProvider));
    try {
      final intento = await google.abrir(registro: _registro, rol: _registro ? _rol : null);
      try {
        await _entrar(await google.completar(intento));
      } on ApiException catch (e) {
        if (e.flag('link_required') && mounted) {
          final user = await _vincular(google, intento, e.message);
          if (user != null) await _entrar(user);
        } else if (e.flag('registration_required')) {
          setState(() {
            _registro = true;
            _error = e.message;
          });
        } else {
          setState(() => _error = e.message);
        }
      }
    } on GoogleCancelled {
      // La persona cerró la ventana de Google: no es un error.
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  /// El correo de Google ya tiene cuenta: se vincula solo con la contraseña de NexoMark.
  Future<AppUser?> _vincular(GoogleAuth google, GoogleAttempt intento, String mensaje) {
    return showModalBottomSheet<AppUser>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (context) => _VincularGoogleSheet(google: google, intento: intento, mensaje: mensaje),
    );
  }

  @override
  Widget build(BuildContext context) {
    final aviso = switch (ref.watch(sessionProvider)) {
      SignedOut(:final aviso) => aviso,
      _ => null,
    };
    return Scaffold(
      body: Stack(
        children: [
          SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                const Entrance(child: _FlowDemo()),
                const SizedBox(height: 20),
                Entrance(
                  index: 1,
                  child: _Tabs(
                    registro: _registro,
                    onChanged: (v) => setState(() {
                      _registro = v;
                      _error = null;
                    }),
                  ),
                ),
                const SizedBox(height: 16),
                if (aviso != null) ...[
                  InfoBanner(message: aviso, tone: InfoTone.warning, icon: Icons.lock_clock_outlined),
                  const SizedBox(height: 12),
                ],
                Entrance(index: 2, child: _formulario(context)),
              ],
            ),
          ),
          _Bienvenida(nombre: _bienvenida),
        ],
      ),
    );
  }

  Widget _formulario(BuildContext context) {
    return Form(
      key: _form,
      child: AnimatedSize(
        duration: Motion.of(context, Motion.base),
        curve: Motion.easeOut,
        alignment: Alignment.topCenter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_registro) ...[
              _RolSelector(rol: _rol, onChanged: (r) => setState(() => _rol = r)),
              const SizedBox(height: 14),
              TextFormField(
                controller: _nombre,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(labelText: 'Nombre completo'),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Escribe tu nombre (al menos 2 letras).' : null,
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Correo'),
              validator: (v) => _correo.hasMatch((v ?? '').trim()) ? null : 'Escribe un correo válido.',
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              obscureText: !_verPassword,
              textInputAction: _registro ? TextInputAction.next : TextInputAction.done,
              autofillHints: [_registro ? AutofillHints.newPassword : AutofillHints.password],
              onFieldSubmitted: (_) => _registro ? null : _enviar(),
              decoration: InputDecoration(
                labelText: 'Contraseña',
                helperText: _registro ? 'Al menos 8 caracteres; evita contraseñas comunes o solo números.' : null,
                helperMaxLines: 2,
                suffixIcon: IconButton(
                  tooltip: _verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
                  onPressed: () => setState(() => _verPassword = !_verPassword),
                  icon: Icon(_verPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                ),
              ),
              validator: (v) {
                if ((v ?? '').isEmpty) return 'Escribe tu contraseña.';
                if (_registro && v!.length < 8) return 'Usa al menos 8 caracteres.';
                return null;
              },
            ),
            if (_registro) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirm,
                obscureText: !_verPassword,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _enviar(),
                decoration: const InputDecoration(labelText: 'Confirmar contraseña'),
                validator: (v) => v != _password.text ? 'Las contraseñas no coinciden.' : null,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 14),
              ErrorBanner(message: _error!),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _enviando ? null : _enviar,
              child: _enviando
                  ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : Text(_registro ? 'Crear cuenta' : 'Entrar'),
            ),
            if (!_registro)
              Align(
                child: TextButton(
                  onPressed: () => context.push('/olvide'),
                  child: const Text('¿Olvidaste tu contraseña?'),
                ),
              ),
            if (_googleListo) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('o', style: context.text.bodySmall),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _enviando ? null : _google,
                icon: const _GoogleG(),
                label: Text(_registro ? 'Registrarse con Google como ${_rol == Rol.marketero ? 'marketero' : 'cliente'}' : 'Continuar con Google'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Pestañas "Iniciar sesión | Crear cuenta". El indicador se desliza al
/// cambiar: deja claro cuál está activa (cambio de estado, 240 ms).
class _Tabs extends StatelessWidget {
  const _Tabs({required this.registro, required this.onChanged});

  final bool registro;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainer,
        borderRadius: BorderRadius.circular(Nexo.radiusButton + 2),
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: Motion.of(context, Motion.base),
            curve: Motion.easeInOut,
            alignment: registro ? Alignment.centerRight : Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: 0.5,
              child: Container(
                decoration: BoxDecoration(
                  color: context.colors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(Nexo.radiusButton),
                  border: Border.all(color: context.colors.outlineVariant),
                ),
              ),
            ),
          ),
          Row(
            children: [
              for (final (i, label) in ['Iniciar sesión', 'Crear cuenta'].indexed)
                Expanded(
                  child: Semantics(
                    selected: registro == (i == 1),
                    button: true,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(Nexo.radiusButton),
                      onTap: () => onChanged(i == 1),
                      child: Center(
                        child: Text(
                          label,
                          style: context.text.labelLarge?.copyWith(
                            color: registro == (i == 1) ? context.colors.onSurface : context.colors.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RolSelector extends StatelessWidget {
  const _RolSelector({required this.rol, required this.onChanged});

  final Rol rol;
  final ValueChanged<Rol> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget opcion(Rol valor, IconData icon, String titulo, String detalle) {
      final activo = rol == valor;
      return Expanded(
        child: Pressable(
          onTap: () => onChanged(valor),
          haptic: true,
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.fast),
            curve: Motion.easeOut,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: activo ? context.colors.primaryFixed : context.colors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(Nexo.radiusCard),
              border: Border.all(color: activo ? context.colors.primary : context.colors.outlineVariant, width: activo ? 2 : 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: activo ? context.colors.primary : context.colors.onSurfaceVariant),
                const SizedBox(height: 8),
                Text(titulo, style: context.text.titleSmall),
                const SizedBox(height: 2),
                Text(detalle, style: context.text.bodySmall),
              ],
            ),
          ),
        ),
      );
    }

    return Semantics(
      label: 'Cómo usarás NexoMark',
      child: Row(
        children: [
          opcion(Rol.marketero, Icons.campaign_outlined, 'Marketero', 'Creas campañas para tus clientes'),
          const SizedBox(width: 10),
          opcion(Rol.cliente, Icons.verified_outlined, 'Cliente', 'Revisas y apruebas lo que se publica'),
        ],
      ),
    );
  }
}

/// Momento firma (una vez al abrir): el recorrido Dictar → … → Medir avanza
/// solo, como el FlowDemo de la web. Explica el producto; no llama a la API.
class _FlowDemo extends StatefulWidget {
  const _FlowDemo();

  @override
  State<_FlowDemo> createState() => _FlowDemoState();
}

class _FlowDemoState extends State<_FlowDemo> {
  static const _frases = [
    'Dictas: «Súbeme una foto con 2×1 en capuchinos».',
    'La IA escribe el texto y crea la imagen.',
    'Tu cliente la revisa y la aprueba desde su teléfono.',
    'Se publica sola en Instagram y Facebook.',
    'Ves me gusta, comentarios y alcance.',
  ];
  int _paso = 0;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_timer != null) return;
    if (Motion.reduced(context)) {
      _paso = _frases.length - 1;
      _timer = Timer(Duration.zero, () {});
      return;
    }
    _timer = Timer.periodic(const Duration(milliseconds: 1500), (t) {
      if (!mounted || _paso >= _frases.length - 1) return t.cancel();
      setState(() => _paso++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return NavyPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BrandLogo(size: 30, onNavy: true),
          const SizedBox(height: 18),
          Text(
            'De la idea dictada al post publicado',
            style: context.text.headlineSmall?.copyWith(color: Nexo.onNavy, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 18),
          FlowStepper(current: _paso, onNavy: true),
          const SizedBox(height: 6),
          SizedBox(
            height: 44,
            child: SwapIn(
              duration: Motion.base,
              child: Text(
                _frases[_paso],
                key: ValueKey(_paso),
                style: context.text.bodyMedium?.copyWith(color: Nexo.onNavyMuted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Capa "Bienvenido, {nombre}": entra desde 0.96 con fundido (nunca desde 0).
class _Bienvenida extends StatelessWidget {
  const _Bienvenida({required this.nombre});

  final String? nombre;

  @override
  Widget build(BuildContext context) {
    final visible = nombre != null;
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: Motion.of(context, Motion.base),
        curve: Motion.easeOut,
        child: Container(
          color: Nexo.navy,
          alignment: Alignment.center,
          child: AnimatedScale(
            scale: visible ? 1 : 0.96,
            duration: Motion.of(context, const Duration(milliseconds: 320)),
            curve: Motion.easeOut,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandLogo(size: 36, onNavy: true),
                const SizedBox(height: 20),
                Text(
                  'Bienvenido, ${nombre ?? ''}',
                  style: context.text.headlineSmall?.copyWith(color: Nexo.onNavy),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GoogleG extends StatelessWidget {
  const _GoogleG();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      child: const Text(
        'G',
        style: TextStyle(color: Color(0xFF4285F4), fontWeight: FontWeight.w800, fontSize: 15, height: 1),
      ),
    );
  }
}

class _VincularGoogleSheet extends StatefulWidget {
  const _VincularGoogleSheet({required this.google, required this.intento, required this.mensaje});

  final GoogleAuth google;
  final GoogleAttempt intento;
  final String mensaje;

  @override
  State<_VincularGoogleSheet> createState() => _VincularGoogleSheetState();
}

class _VincularGoogleSheetState extends State<_VincularGoogleSheet> {
  final _password = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _confirmar() async {
    if (_password.text.isEmpty) return setState(() => _error = 'Escribe tu contraseña de NexoMark.');
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final user = await widget.google.completar(widget.intento, password: _password.text);
      if (mounted) Navigator.of(context).pop(user);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Vincular Google', style: context.text.titleLarge),
          const SizedBox(height: 8),
          Text(widget.mensaje, style: context.text.bodyMedium),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            autofocus: true,
            onSubmitted: (_) => _confirmar(),
            decoration: const InputDecoration(labelText: 'Contraseña de NexoMark'),
          ),
          if (_error != null) ...[const SizedBox(height: 12), ErrorBanner(message: _error!)],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _enviando ? null : _confirmar,
            child: _enviando
                ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                : const Text('Vincular y entrar'),
          ),
        ],
      ),
    );
  }
}
