import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../widgets/nexo_widgets.dart';
import '../auth/forgot_password_screen.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _actual = TextEditingController();
  final _nueva = TextEditingController();
  final _confirmar = TextEditingController();
  bool _ver = false;
  bool _ocupado = false;
  String? _error;

  @override
  void dispose() {
    _actual.dispose();
    _nueva.dispose();
    _confirmar.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (_nueva.text.length < 8) return setState(() => _error = 'La nueva contraseña debe tener al menos 8 caracteres.');
    if (_nueva.text != _confirmar.text) return setState(() => _error = 'Las contraseñas nuevas no coinciden.');
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      final mensaje = await ref.read(authRepositoryProvider).changePassword(_actual.text, _nueva.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      String? campo;
      for (final v in e.data.values) {
        if (v is List && v.isNotEmpty) campo ??= '${v.first}';
      }
      setState(() => _error = campo ?? e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user != null && !user.hasPassword) return const ForgotPasswordScreen(crear: true);
    return Scaffold(
      appBar: AppBar(title: const Text('Cambiar contraseña')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: _actual,
              obscureText: !_ver,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(labelText: 'Contraseña actual'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nueva,
              obscureText: !_ver,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: 'Contraseña nueva',
                helperText: 'Al menos 8 caracteres; evita contraseñas comunes o solo números.',
                suffixIcon: IconButton(
                  tooltip: _ver ? 'Ocultar' : 'Mostrar',
                  onPressed: () => setState(() => _ver = !_ver),
                  icon: Icon(_ver ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmar,
              obscureText: !_ver,
              decoration: const InputDecoration(labelText: 'Confirmar contraseña nueva'),
              onSubmitted: (_) => _guardar(),
            ),
            if (_error != null) ...[const SizedBox(height: 12), ErrorBanner(message: _error!)],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _ocupado ? null : _guardar,
              child: _ocupado
                  ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : const Text('Guardar contraseña'),
            ),
          ],
        ),
      ),
    );
  }
}
