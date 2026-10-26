import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tokens de sesión en el almacenamiento cifrado del sistema
/// (Keychain en iOS, Keystore en Android). Se borran al cerrar sesión.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  String? _accessCache;

  static const _access = 'access';
  static const _refresh = 'refresh';

  Future<String?> access() async =>
      _accessCache ??= await _storage.read(key: _access);
  Future<String?> refresh() => _storage.read(key: _refresh);

  Future<void> save({required String access, required String refresh}) async {
    _accessCache = access;
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> updateTokens({required String access, String? refresh}) async {
    _accessCache = access;
    await _storage.write(key: _access, value: access);
    if (refresh != null) await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    _accessCache = null;
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}
