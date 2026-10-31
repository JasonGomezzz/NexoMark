import 'dart:io' show Platform;

/// Direcciones del backend. Se fijan al compilar con `--dart-define`:
///
///   flutter run --dart-define=API_HOST=192.168.1.20      (iPhone real en la misma Wi-Fi)
///   flutter run --dart-define=DJANGO_URL=https://… --dart-define=SPRING_URL=https://…
///
/// Sin nada: el emulador de Android llega al Mac por 10.0.2.2 y el simulador
/// de iOS por localhost.
abstract final class AppConfig {
  static const _host = String.fromEnvironment('API_HOST');
  static const _django = String.fromEnvironment('DJANGO_URL');
  static const _spring = String.fromEnvironment('SPRING_URL');

  /// Client ID de iOS de Google (va también como esquema invertido en Info.plist).
  static const googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
  );

  static String get host {
    if (_host.isNotEmpty) return _host;
    return Platform.isAndroid ? '10.0.2.2' : 'localhost';
  }

  static String get djangoUrl =>
      _django.isNotEmpty ? _django : 'http://$host:8000';
  static String get springUrl =>
      _spring.isNotEmpty ? _spring : 'http://$host:8080';
}
