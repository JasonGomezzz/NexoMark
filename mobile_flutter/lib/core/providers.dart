import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../data/campaign_repository.dart';
import '../data/client_repository.dart';
import '../data/models.dart';
import '../data/social_repository.dart';
import 'api/api_client.dart';
import 'session/token_store.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStoreProvider)));
final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStoreProvider)));
final campaignRepositoryProvider = Provider<CampaignRepository>((ref) => CampaignRepository(ref.watch(apiClientProvider)));
final clientRepositoryProvider = Provider<ClientRepository>((ref) => ClientRepository(ref.watch(apiClientProvider)));
final socialRepositoryProvider = Provider<SocialRepository>((ref) => SocialRepository(ref.watch(apiClientProvider)));

sealed class SessionState {
  const SessionState();
}

class SessionLoading extends SessionState {
  const SessionLoading();
}

class SignedOut extends SessionState {
  const SignedOut([this.aviso]);

  /// Por qué se cerró (sesión vencida, correo cambiado…), para mostrarlo en el login.
  final String? aviso;
}

class SignedIn extends SessionState {
  const SignedIn(this.user);
  final AppUser user;
}

/// Sesión de la app. El enrutador escucha [routerRefresh] para redirigir.
class SessionController extends Notifier<SessionState> {
  final routerRefresh = ValueNotifier<int>(0);

  @override
  SessionState build() {
    ref.read(apiClientProvider).onSessionExpired = () => _expire('Tu sesión venció. Inicia sesión otra vez.');
    Future.microtask(_restore);
    return const SessionLoading();
  }

  AuthRepository get _auth => ref.read(authRepositoryProvider);

  void _set(SessionState value) {
    state = value;
    routerRefresh.value++;
  }

  Future<void> _restore() async {
    if (!await _auth.hasSession()) return _set(const SignedOut());
    try {
      _set(SignedIn(await _auth.me()));
    } on ApiException catch (e) {
      // Sin red no se pierde la sesión guardada: se pide reintentar desde el login.
      _set(SignedOut(e.isNetwork ? e.message : null));
    }
  }

  Future<void> signedIn(AppUser user) async => _set(SignedIn(user));

  /// Vuelve a leer /me (créditos, foto, Google) sin tocar la navegación.
  Future<void> refreshUser() async {
    final current = state;
    if (current is! SignedIn) return;
    try {
      state = SignedIn(await _auth.me());
    } catch (_) {
      // Se conserva el usuario anterior: el error de red ya se muestra en la pantalla que pidió el dato.
    }
  }

  void updateUser(AppUser user) {
    if (state is SignedIn) state = SignedIn(user);
  }

  Future<void> logout([String? aviso]) async {
    await _auth.logout();
    _set(SignedOut(aviso));
  }

  Future<void> _expire(String aviso) async {
    if (state is SignedOut) return;
    await ref.read(tokenStoreProvider).clear();
    _set(SignedOut(aviso));
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);

final currentUserProvider = Provider<AppUser?>((ref) {
  final s = ref.watch(sessionProvider);
  return s is SignedIn ? s.user : null;
});
