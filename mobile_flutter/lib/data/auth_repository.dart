import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import '../core/session/token_store.dart';
import 'models.dart';

class GoogleChallenge {
  const GoogleChallenge({required this.ticket, required this.proof, required this.nonce, required this.clientId});
  final String ticket;
  final String proof;
  final String nonce;
  final String clientId;
}

/// Cuenta: sesión, perfil, foto, correo, contraseña, Google y créditos.
class AuthRepository {
  AuthRepository(this._api, this._tokens);

  final ApiClient _api;
  final TokenStore _tokens;
  Dio get _dj => _api.django;

  Future<T> _call<T>(Future<T> Function() body) async {
    try {
      return await body();
    } catch (error) {
      throw toApiException(error);
    }
  }

  Future<AppUser> login(String email, String password) => _call(() async {
        final r = await _dj.post<Map<String, dynamic>>(
          '/api/auth/token/',
          data: {'email': email.trim().toLowerCase(), 'password': password},
          options: publicOptions,
        );
        await _guardarTokens(r.data!);
        return me();
      });

  /// Respuesta plana de simplejwt (login y Google): access, refresh, role, nombre.
  Future<void> _guardarTokens(Map<String, dynamic> body) =>
      _tokens.save(access: body['access'] as String, refresh: body['refresh'] as String);

  Future<AppUser> register({
    required String email,
    required String nombre,
    required String password,
    required Rol rol,
  }) =>
      _call(() async {
        await _dj.post<dynamic>(
          '/api/auth/register/',
          data: {'email': email.trim().toLowerCase(), 'nombre': nombre.trim(), 'password': password, 'rol': rol.name},
          options: publicOptions,
        );
        return login(email, password);
      });

  Future<AppUser> me() => _call(() async {
        final r = await _dj.get<dynamic>('/api/auth/me/');
        return AppUser.fromJson(envelopeData(r)['user'] as Map<String, dynamic>);
      });

  Future<void> logout() async {
    final refresh = await _tokens.refresh();
    try {
      if (refresh != null) await _dj.post<dynamic>('/api/auth/logout/', data: {'refresh': refresh});
    } catch (_) {
      // Cerrar sesión en el teléfono no depende de que el servidor responda.
    } finally {
      await _tokens.clear();
    }
  }

  Future<bool> hasSession() async => await _tokens.refresh() != null;

  Future<String> requestPasswordReset(String email) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/auth/password-reset/',
          data: {'email': email.trim().toLowerCase()},
          options: publicOptions,
        );
        return envelopeMessage(r) ?? 'Si existe una cuenta con ese correo, te enviamos un enlace.';
      });

  // ── Perfil ───────────────────────────────────────────────

  Future<AppUser> updateName(String nombre) => _call(() async {
        final r = await _dj.patch<dynamic>('/api/auth/me/', data: {'nombre': nombre.trim()});
        return AppUser.fromJson(envelopeData(r)['user'] as Map<String, dynamic>);
      });

  Future<AppUser> uploadAvatar(Uint8List bytes, String filename) => _call(() async {
        final form = FormData.fromMap({'avatar': MultipartFile.fromBytes(bytes, filename: filename)});
        final r = await _dj.patch<dynamic>('/api/auth/me/', data: form);
        return AppUser.fromJson(envelopeData(r)['user'] as Map<String, dynamic>);
      });

  Future<AppUser> removeAvatar() => _call(() async {
        final r = await _dj.patch<dynamic>('/api/auth/me/', data: {'remove_avatar': true});
        return AppUser.fromJson(envelopeData(r)['user'] as Map<String, dynamic>);
      });

  /// JPEG 256×256 del propio usuario; null si no tiene foto (204).
  Future<Uint8List?> avatar() => _call(() async {
        final r = await _dj.get<List<int>>('/api/auth/me/avatar/', options: Options(responseType: ResponseType.bytes));
        if (r.statusCode == 204 || r.data == null || r.data!.isEmpty) return null;
        return Uint8List.fromList(r.data!);
      });

  Future<String> changePassword(String actual, String nueva) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/auth/me/change-password/',
          data: {'current_password': actual, 'new_password': nueva},
        );
        return envelopeMessage(r) ?? 'Contraseña actualizada.';
      });

  // ── Cambio de correo ─────────────────────────────────────

  Future<EmailChangePending?> emailChangeStatus() => _call(() async {
        final r = await _dj.get<dynamic>('/api/auth/me/change-email/');
        return EmailChangePending.fromJson(envelopeData(r)['pending']);
      });

  Future<EmailChangePending?> requestEmailChange(String nuevo, String password) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/auth/me/change-email/',
          data: {'new_email': nuevo.trim().toLowerCase(), 'current_password': password},
        );
        return EmailChangePending.fromJson(envelopeData(r)['pending']);
      });

  Future<void> cancelEmailChange() => _call(() => _dj.delete<dynamic>('/api/auth/me/change-email/'));

  // ── Google ───────────────────────────────────────────────

  /// Client ID web del servidor (Android lo usa como serverClientId), o null si no está configurado.
  Future<String?> googleClientId() async {
    try {
      final r = await _dj.get<dynamic>('/api/auth/google/config/', options: publicOptions);
      final data = envelopeData(r);
      return data['configured'] == true ? data['client_id'] as String? : null;
    } catch (_) {
      return null;
    }
  }

  Future<GoogleChallenge> googleChallenge({required bool registro, Rol? rol}) => _call(() async {
        final r = await _dj.post<dynamic>(
          '/api/auth/google/challenge/',
          data: {'purpose': registro ? 'register' : 'login', 'role': ?rol?.name},
          options: publicOptions,
        );
        final d = envelopeData(r);
        return GoogleChallenge(
          ticket: d['ticket'] as String,
          proof: d['proof'] as String,
          nonce: d['nonce'] as String,
          clientId: d['client_id'] as String,
        );
      });

  Future<AppUser> googleComplete(GoogleChallenge challenge, String idToken, {String? password}) => _call(() async {
        final r = await _dj.post<Map<String, dynamic>>(
          '/api/auth/google/complete/',
          data: {
            'ticket': challenge.ticket,
            'proof': challenge.proof,
            'credential': idToken,
            'current_password': ?password,
          },
          options: publicOptions,
        );
        await _guardarTokens(r.data!);
        return me();
      });

  Future<String> googleDisconnect(String password) => _call(() async {
        final r = await _dj.post<dynamic>('/api/auth/google/disconnect/', data: {'current_password': password});
        return envelopeMessage(r) ?? 'Google desvinculado.';
      });

  // ── Créditos ─────────────────────────────────────────────

  Future<({List<CreditRequest> solicitudes, CreditRequest? pendiente})> creditRequests() => _call(() async {
        final r = await _dj.get<dynamic>('/api/auth/credit-requests/');
        final d = envelopeData(r);
        final lista = (d['solicitudes'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(CreditRequest.fromJson)
            .toList();
        final pendiente = d['pendiente'];
        return (
          solicitudes: lista,
          pendiente: pendiente is Map<String, dynamic> ? CreditRequest.fromJson(pendiente) : null,
        );
      });

  Future<String> requestCredits(String motivo) => _call(() async {
        final r = await _dj.post<dynamic>('/api/auth/credit-requests/', data: {'motivo': motivo.trim()});
        return envelopeMessage(r) ?? 'Solicitud enviada.';
      });
}
