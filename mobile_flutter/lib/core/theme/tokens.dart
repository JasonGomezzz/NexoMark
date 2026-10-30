import 'package:flutter/material.dart';

/// Sistema visual "Línea" (dirección B, elegida el 30/10/2026). Los valores
/// son los de `docs/diseno/direcciones.md` → «Dirección elegida» y los de
/// `frontend/src/index.css`; si uno cambia allí, se cambia aquí el mismo día.
/// `test/paleta_test.dart` comprueba el contraste AA de los pares de texto.
///
/// Idea: cada campaña es un viaje por una línea de cinco estaciones
/// (Dictar → Generar → Aprobar → Publicar → Medir). El marino es el andén y
/// el turquesa es el tren que avanza.
abstract final class Nexo {
  // Marca y banda de la línea: iguales en ambos temas.
  static const navy = Color(0xFF14283F);
  static const navyDeep = Color(0xFF0B1929);

  /// Banda de navegación (la línea).
  static const banda = Color(0xFF14283F);

  /// Conteos y créditos dentro de la banda.
  static const banda2 = Color(0xFF1D3550);

  /// Tramo de la línea dentro de la banda.
  static const via = Color(0xFF2C4862);

  /// Anillo de una estación inactiva sobre la banda.
  static const viaClara = Color(0xFF3D5A6E);

  static const turquoise = Color(0xFF17B8AD);
  static const turquoiseSoft = Color(0xFF79DDD3);
  static const onNavy = Color(0xFFFFFFFF);
  static const onNavyMuted = Color(0xFFB9CBD8);
  static const onNavyError = Color(0xFFFFB4AB);

  // Color de marca de cada red: solo para su logo, nunca en gráficos (ver NexoColors.chart*).
  static const facebook = Color(0xFF1877F2);
  static const instagram = Color(0xFFE8409C);

  // Radios (direcciones.md → Formas).
  /// Botones: pastilla, como los letreros de estación.
  static const radiusPill = 999.0;

  /// Campos, selects y fichas.
  static const radiusField = 10.0;

  /// Superficies (paneles, imagen de la campaña, hojas pequeñas).
  static const radiusSurface = 14.0;

  /// Modales y hojas inferiores.
  static const radiusSheet = 22.0;

  // Trazos (móvil).
  /// Vía de la línea: 6 px en escritorio, 4 en móvil.
  static const via4 = 4.0;

  /// Vía del dictado (vertical).
  static const viaDictado = 6.0;

  /// Anillo de una parada.
  static const anilloParada = 5.0;

  /// Regla que abre una sección.
  static const regla = 6.0;

  // Espaciado: base 4.
  static const gutter = 16.0;
}

/// Tokens que Material no trae: estados, hilo, regla y series por red.
@immutable
class NexoColors extends ThemeExtension<NexoColors> {
  const NexoColors({
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.warning,
    required this.warningContainer,
    required this.hairline,
    required this.regla,
    required this.chartInstagram,
    required this.chartX,
    required this.chartFacebook,
    required this.chartTiktok,
  });

  final Color success;
  final Color onSuccess;
  final Color successContainer;
  final Color warning;
  final Color warningContainer;

  /// Hilos entre filas.
  final Color hairline;

  /// Filete de 6 px que abre una sección.
  final Color regla;

  final Color chartInstagram;
  final Color chartX;
  final Color chartFacebook;
  final Color chartTiktok;

  /// Color de la serie de una red en los gráficos (orden fijo: Instagram, X, Facebook, TikTok).
  Color chart(String red) => switch (red) {
        'instagram' => chartInstagram,
        'facebook' => chartFacebook,
        'tiktok' => chartTiktok,
        'x' || 'twitter' => chartX,
        _ => hairline,
      };

  static const light = NexoColors(
    success: Color(0xFF2A7430),
    onSuccess: Color(0xFFFFFFFF),
    successContainer: Color(0xFFDCF3DD),
    warning: Color(0xFF9A4F00),
    warningContainer: Color(0xFFFFE3C2),
    hairline: Color(0xFFD6E5E7),
    regla: Color(0xFF14283F),
    chartInstagram: Color(0xFFB4307E),
    chartX: Color(0xFF6F7A16),
    chartFacebook: Color(0xFF2463C8),
    chartTiktok: Color(0xFFC2501A),
  );

  static const dark = NexoColors(
    success: Color(0xFF8FD991),
    onSuccess: Color(0xFF00390A),
    successContainer: Color(0xFF173D1B),
    warning: Color(0xFFFFBD7C),
    warningContainer: Color(0xFF563100),
    hairline: Color(0xFF1F3A52),
    regla: Color(0xFF3D5A6E),
    chartInstagram: Color(0xFFD45A9C),
    chartX: Color(0xFF8E9A2E),
    chartFacebook: Color(0xFF5B8FE0),
    chartTiktok: Color(0xFFDE7340),
  );

  @override
  NexoColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? successContainer,
    Color? warning,
    Color? warningContainer,
    Color? hairline,
    Color? regla,
    Color? chartInstagram,
    Color? chartX,
    Color? chartFacebook,
    Color? chartTiktok,
  }) {
    return NexoColors(
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      successContainer: successContainer ?? this.successContainer,
      warning: warning ?? this.warning,
      warningContainer: warningContainer ?? this.warningContainer,
      hairline: hairline ?? this.hairline,
      regla: regla ?? this.regla,
      chartInstagram: chartInstagram ?? this.chartInstagram,
      chartX: chartX ?? this.chartX,
      chartFacebook: chartFacebook ?? this.chartFacebook,
      chartTiktok: chartTiktok ?? this.chartTiktok,
    );
  }

  @override
  NexoColors lerp(NexoColors? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return NexoColors(
      success: l(success, other.success),
      onSuccess: l(onSuccess, other.onSuccess),
      successContainer: l(successContainer, other.successContainer),
      warning: l(warning, other.warning),
      warningContainer: l(warningContainer, other.warningContainer),
      hairline: l(hairline, other.hairline),
      regla: l(regla, other.regla),
      chartInstagram: l(chartInstagram, other.chartInstagram),
      chartX: l(chartX, other.chartX),
      chartFacebook: l(chartFacebook, other.chartFacebook),
      chartTiktok: l(chartTiktok, other.chartTiktok),
    );
  }
}

/// En Flutter el fondo de página es `surface` (el `background` de la web).
const nexoLightScheme = ColorScheme(
  brightness: Brightness.light,
  surface: Color(0xFFF5FAFA),
  surfaceDim: Color(0xFFD4E2E5),
  surfaceBright: Color(0xFFF5FAFA),
  surfaceContainerLowest: Color(0xFFFFFFFF),
  surfaceContainerLow: Color(0xFFEDF5F5),
  surfaceContainer: Color(0xFFE5EFEF),
  surfaceContainerHigh: Color(0xFFDCE9EA),
  surfaceContainerHighest: Color(0xFFD3E3E5),
  onSurface: Color(0xFF14283F),
  onSurfaceVariant: Color(0xFF425C67),
  inverseSurface: Color(0xFF14283F),
  onInverseSurface: Color(0xFFEDF5F5),
  outline: Color(0xFF5A737D),
  outlineVariant: Color(0xFFB6CDD1),
  primary: Color(0xFF087B75),
  onPrimary: Color(0xFFFFFFFF),
  primaryContainer: Color(0xFF086A65),
  onPrimaryContainer: Color(0xFFFFFFFF),
  inversePrimary: Color(0xFF79DDD3),
  primaryFixed: Color(0xFFE4F6F3),
  primaryFixedDim: Color(0xFF79DDD3),
  onPrimaryFixed: Color(0xFF14283F),
  onPrimaryFixedVariant: Color(0xFF086A65),
  secondary: Color(0xFF36566B),
  onSecondary: Color(0xFFFFFFFF),
  secondaryContainer: Color(0xFFE9F2F5),
  onSecondaryContainer: Color(0xFF294858),
  tertiary: Color(0xFF904900),
  onTertiary: Color(0xFFFFFFFF),
  tertiaryContainer: Color(0xFFFFE3C2),
  onTertiaryContainer: Color(0xFF301400),
  error: Color(0xFFBA1A1A),
  onError: Color(0xFFFFFFFF),
  errorContainer: Color(0xFFFFDAD6),
  onErrorContainer: Color(0xFF93000A),
  shadow: Nexo.navy,
  scrim: Nexo.navyDeep,
);

const nexoDarkScheme = ColorScheme(
  brightness: Brightness.dark,
  surface: Color(0xFF0B1929),
  surfaceDim: Color(0xFF0B1929),
  surfaceBright: Color(0xFF26445C),
  surfaceContainerLowest: Color(0xFF102236),
  surfaceContainerLow: Color(0xFF193249),
  surfaceContainer: Color(0xFF203B52),
  surfaceContainerHigh: Color(0xFF29485F),
  surfaceContainerHighest: Color(0xFF33546B),
  onSurface: Color(0xFFF3FAFB),
  onSurfaceVariant: Color(0xFFBDCFD7),
  inverseSurface: Color(0xFFF3FAFB),
  onInverseSurface: Color(0xFF14283F),
  outline: Color(0xFF90ACBA),
  outlineVariant: Color(0xFF3D5A6E),
  primary: Color(0xFF17B8AD),
  onPrimary: Color(0xFF0B1929),
  primaryContainer: Color(0xFF21C9BB),
  onPrimaryContainer: Color(0xFF0B1929),
  inversePrimary: Color(0xFF087B75),
  primaryFixed: Color(0xFF143A42),
  primaryFixedDim: Color(0xFF205960),
  onPrimaryFixed: Color(0xFFD1F4EE),
  onPrimaryFixedVariant: Color(0xFF79DDD3),
  secondary: Color(0xFFB8D0DD),
  onSecondary: Color(0xFF14283F),
  secondaryContainer: Color(0xFF1C364B),
  onSecondaryContainer: Color(0xFFE5F1F5),
  tertiary: Color(0xFFFFBD7C),
  onTertiary: Color(0xFF4B2700),
  tertiaryContainer: Color(0xFF633600),
  onTertiaryContainer: Color(0xFFFFDCC0),
  error: Color(0xFFFFB4AB),
  onError: Color(0xFF690005),
  errorContainer: Color(0xFF93000A),
  onErrorContainer: Color(0xFFFFDAD6),
  shadow: Colors.black,
  scrim: Colors.black,
);

extension NexoTheme on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
  NexoColors get nexo => Theme.of(this).extension<NexoColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
