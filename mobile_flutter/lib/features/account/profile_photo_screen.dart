import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/nexo_widgets.dart';
import 'avatar_provider.dart';

/// Foto de perfil: galería o cámara. El servidor la recorta al centro en un
/// cuadrado de 256×256 y quita los metadatos; aquí se ve igual antes de subir.
class ProfilePhotoScreen extends ConsumerStatefulWidget {
  const ProfilePhotoScreen({super.key});

  @override
  ConsumerState<ProfilePhotoScreen> createState() => _ProfilePhotoScreenState();
}

class _ProfilePhotoScreenState extends ConsumerState<ProfilePhotoScreen> {
  Uint8List? _nueva;
  String _nombre = 'foto.jpg';
  bool _ocupado = false;
  String? _error;

  Future<void> _elegir(ImageSource origen) async {
    setState(() => _error = null);
    try {
      final archivo = await ImagePicker().pickImage(
        source: origen,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 90,
      );
      if (archivo == null) return;
      final bytes = await archivo.readAsBytes();
      if (bytes.length > 2 * 1024 * 1024) {
        return setState(
          () => _error =
              'La foto pesa más de 2 MB. Elige otra o tómala de nuevo.',
        );
      }
      setState(() {
        _nueva = bytes;
        _nombre = archivo.name;
      });
    } on PlatformException {
      setState(
        () => _error = origen == ImageSource.camera
            ? 'Sin permiso de la cámara. Actívalo en Ajustes.'
            : 'Sin permiso de las fotos. Actívalo en Ajustes.',
      );
    }
  }

  Future<void> _subir() async {
    final bytes = _nueva;
    if (bytes == null) return;
    setState(() => _ocupado = true);
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .uploadAvatar(bytes, _nombre);
      ref.invalidate(avatarProvider);
      ref.read(sessionProvider.notifier).updateUser(user);
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(
        () => _error = e.data['errors'] is Map ? _primero(e) : e.message,
      );
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  String _primero(ApiException e) {
    for (final v in (e.data['errors'] as Map).values) {
      if (v is List && v.isNotEmpty) return '${v.first}';
    }
    return e.message;
  }

  Future<void> _quitar() async {
    setState(() => _ocupado = true);
    try {
      final user = await ref.read(authRepositoryProvider).removeAvatar();
      ref.invalidate(avatarProvider);
      ref.read(sessionProvider.notifier).updateUser(user);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final actual = ref
        .watch(
          avatarProvider(user?.hasAvatar == true ? user?.avatarVersion : null),
        )
        .value;
    final mostrar = _nueva ?? actual;
    return Scaffold(
      appBar: AppBar(title: const Text('Foto de perfil')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.base),
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: ScaleTransition(
                    scale: Tween(begin: 0.95, end: 1.0).animate(a),
                    child: child,
                  ),
                ),
                child: Container(
                  key: ValueKey(mostrar?.length ?? 0),
                  width: 200,
                  height: 200,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Nexo.navy,
                    border: Border.all(color: Nexo.turquoise, width: 4),
                  ),
                  alignment: Alignment.center,
                  child: mostrar != null
                      ? Image.memory(
                          mostrar,
                          width: 200,
                          height: 200,
                          fit: BoxFit.cover,
                        )
                      : Text(
                          user?.iniciales ?? '?',
                          style: const TextStyle(
                            color: Nexo.onNavy,
                            fontSize: 64,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Se recorta al centro en un cuadrado y se guarda pequeña (256 × 256), sin datos de ubicación. Máximo 2 MB; JPG, PNG o WebP.',
              style: context.text.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _ocupado
                        ? null
                        : () => _elegir(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Galería'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _ocupado
                        ? null
                        : () => _elegir(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Cámara'),
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              ErrorBanner(message: _error!),
            ],
            const SizedBox(height: 16),
            if (_nueva != null)
              FilledButton(
                onPressed: _ocupado ? null : _subir,
                child: _ocupado
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Text('Usar esta foto'),
              )
            else if (user?.hasAvatar ?? false)
              TextButton.icon(
                onPressed: _ocupado ? null : _quitar,
                icon: Icon(
                  Icons.delete_outline_rounded,
                  color: context.colors.error,
                ),
                label: Text(
                  'Quitar foto',
                  style: TextStyle(color: context.colors.error),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
