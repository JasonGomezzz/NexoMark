import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/motion_widgets.dart';
import '../../widgets/nexo_widgets.dart';

/// "Olvidé mi contraseña" — también es "Crear contraseña" para cuentas de
/// Google. El enlace llega al correo y se abre en la web (/reset-password).
/// La respuesta es la misma exista o no la cuenta.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.crear = false});

  /// true desde Cuenta → Seguridad en una cuenta creada con Google.
  final bool crear;

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _enviando = false;
  String? _error;
  String? _listo;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null) _email.text = user.email;
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_email.text.contains('@')) {
      return setState(() => _error = 'Escribe un correo válido.');
    }
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final mensaje = await ref
          .read(authRepositoryProvider)
          .requestPasswordReset(_email.text);
      setState(() => _listo = mensaje);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.crear ? 'Crear contraseña' : 'Recuperar contraseña'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              widget.crear
                  ? 'Tu cuenta entra con Google. Te enviamos un enlace al correo para que elijas una contraseña de NexoMark.'
                  : 'Te enviaremos un enlace para elegir una contraseña nueva. Vence en 30 minutos y sirve una sola vez.',
              style: context.text.bodyLarge,
            ),
            const SizedBox(height: 20),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 240),
              child: _listo != null
                  ? Entrance(
                      key: const ValueKey('listo'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          InfoBanner(
                            message: _listo!,
                            tone: InfoTone.success,
                            icon: Icons.mark_email_read_outlined,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Abre el enlace desde el correo: se abre en la web de NexoMark. Después vuelve aquí e inicia sesión.',
                            style: context.text.bodyMedium?.copyWith(
                              color: context.colors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      key: const ValueKey('form'),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Correo',
                          ),
                          onSubmitted: (_) => _enviar(),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          ErrorBanner(message: _error!),
                        ],
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _enviando ? null : _enviar,
                          child: _enviando
                              ? const SizedBox.square(
                                  dimension: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text('Enviar enlace'),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
