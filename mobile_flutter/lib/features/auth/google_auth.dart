import 'dart:io' show Platform;

import 'package:google_sign_in_platform_interface/google_sign_in_platform_interface.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../data/auth_repository.dart';
import '../../data/models.dart';

/// Intento de "Continuar con Google" que puede necesitar un segundo paso
/// (confirmar la contraseña de NexoMark para vincular una cuenta existente).
class GoogleAttempt {
  GoogleAttempt(this.challenge, this.idToken);
  final GoogleChallenge challenge;
  final String idToken;
}

class GoogleCancelled implements Exception {}

/// Sign in with Google del sistema (Credential Manager en Android,
/// GoogleSignIn en iOS) con el nonce que entrega Django: el servidor verifica
/// el ID token y emite sus propios JWT. Nunca se guardan tokens de Google.
class GoogleAuth {
  GoogleAuth(this._auth);

  final AuthRepository _auth;

  /// iOS necesita su propio client ID (y el esquema invertido en Info.plist).
  static bool get disponibleEnEsteTelefono => !Platform.isIOS || AppConfig.googleIosClientId.isNotEmpty;

  Future<bool> configurado() async => disponibleEnEsteTelefono && await _auth.googleClientId() != null;

  /// Abre la hoja de Google y devuelve el intento listo para completar.
  Future<GoogleAttempt> abrir({required bool registro, Rol? rol}) async {
    final challenge = await _auth.googleChallenge(registro: registro, rol: rol);
    final platform = GoogleSignInPlatform.instance;
    await platform.init(InitParameters(
      clientId: Platform.isIOS ? AppConfig.googleIosClientId : null,
      serverClientId: challenge.clientId,
      nonce: challenge.nonce,
    ));
    try {
      final result = await platform.authenticate(const AuthenticateParameters());
      final idToken = result.authenticationTokens.idToken;
      if (idToken == null) {
        throw ApiException('Google no devolvió tu identidad. Vuelve a intentarlo.');
      }
      return GoogleAttempt(challenge, idToken);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) throw GoogleCancelled();
      throw ApiException(switch (e.code) {
        GoogleSignInExceptionCode.clientConfigurationError || GoogleSignInExceptionCode.providerConfigurationError =>
          'Google no reconoce esta app todavía (falta registrar el client ID de Android o iOS).',
        GoogleSignInExceptionCode.uiUnavailable => 'No se pudo abrir la ventana de Google en este teléfono.',
        _ => 'No se pudo entrar con Google. Vuelve a intentarlo.',
      });
    }
  }

  Future<AppUser> completar(GoogleAttempt intento, {String? password}) =>
      _auth.googleComplete(intento.challenge, intento.idToken, password: password);
}
