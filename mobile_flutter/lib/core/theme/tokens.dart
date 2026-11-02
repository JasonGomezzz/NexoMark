import 'package:flutter/material.dart';

/// Sistema visual "Conforme" (dirección C, elegida el 31/10/2026). Los valores
/// son los de `docs/diseno/direcciones.md` → «Dirección elegida» y los de
/// `frontend/src/index.css`; si uno cambia allí, se cambia aquí el mismo día.
/// `test/paleta_test.dart` comprueba el contraste AA de los pares de texto.
///
/// Idea: cada campaña es una prueba de imprenta. El marino es la **mesa** que
/// enmarca la app; el trabajo ocurre en un **pliego** claro con **marcas de
/// corte**; el recorrido es la **orden de trabajo** (cinco casillas que se
/// sellan) y el cliente aprueba con un **sello** que lleva la N.
abstract final class Nexo {
  // Marca: iguales en ambos temas.
  static const navy = Color(0xFF14283F);
  static const navyDeep = Color(0xFF0B1929);
  static const turquoise = Color(0xFF17B8AD);
  static const turquoiseSoft = Color(0xFF79DDD3);
  static const onNavy = Color(0xFFFFFFFF);
  static const onNavyMuted = Color(0xFFB9CBD8);
  static const onNavyError = Color(0xFFFFB4AB);

  // Color de marca de cada red: solo para su logo, nunca en gráficos (ver NexoColors.chart*).
  static const facebook = Color(0xFF1877F2);
  static const instagram = Color(0xFFE8409C);

  // Radios (direcciones.md → Formas).
  /// Controles y botones.
  static const radiusField = 10.0;

  /// Casillas de la orden de trabajo.
  static const radiusCasilla = 7.0;

  /// El pliego en móvil (18 en escritorio) y las superficies dentro de él.
  static const radiusSurface = 14.0;

  /// Modales y hojas inferiores.
  static const radiusSheet = 22.0;

  // Trazos.
  /// Borde punteado de una casilla por sellar.
  static const punteado = 1.5;

  /// Marca de corte: 1.5 × 16 px.
  static const corteGrosor = 1.5;
  static const corteLargo = 16.0;

  // Espaciado: base 4. En móvil el pliego deja 8 px de mesa y rellena 16 por dentro.
  static const margenMesa = 8.0;
  static const gutter = 16.0;
}

/// Tokens que Material no trae: la mesa, el registro, el pelo, estados y
/// series por red. La mesa y el registro cambian con el tema.
@immutable
class NexoColors extends ThemeExtension<NexoColors> {
  const NexoColors({
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.warning,
    required this.warningContainer,
    required this.cama,
    required this.cama2,
    required this.camaLine,
    required this.registro,
    required this.hairline,
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

  /// La mesa: marco de la app y navegación.
  final Color cama;

  /// Bloques sobre la mesa (la pastilla de créditos, el conteo).
  final Color cama2;

  /// Divisores y casillas por sellar sobre la mesa.
  final Color camaLine;

  /// Marcas de corte.
  final Color registro;

  /// Hilos entre filas de la ficha y las tablas.
  final Color hairline;

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
    cama: Color(0xFF14283F),
    cama2: Color(0xFF1D3550),
    camaLine: Color(0xFF2C4862),
    registro: Color(0xFF79DDD3),
    hairline: Color(0xFFC9DADD),
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
    cama: Color(0xFF07111D),
    cama2: Color(0xFF14283F),
    camaLine: Color(0xFF22405A),
    registro: Color(0xFF3FA79E),
    hairline: Color(0xFF22405A),
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
    Color? cama,
    Color? cama2,
    Color? camaLine,
    Color? registro,
    Color? hairline,
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
      cama: cama ?? this.cama,
      cama2: cama2 ?? this.cama2,
      camaLine: camaLine ?? this.camaLine,
      registro: registro ?? this.registro,
      hairline: hairline ?? this.hairline,
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
      cama: l(cama, other.cama),
      cama2: l(cama2, other.cama2),
      camaLine: l(camaLine, other.camaLine),
      registro: l(registro, other.registro),
      hairline: l(hairline, other.hairline),
      chartInstagram: l(chartInstagram, other.chartInstagram),
      chartX: l(chartX, other.chartX),
      chartFacebook: l(chartFacebook, other.chartFacebook),
      chartTiktok: l(chartTiktok, other.chartTiktok),
    );
  }
}

/// En Flutter el pliego es `surface` (el `background` de la web).
const nexoLightScheme = ColorScheme(
  brightness: Brightness.light,
  surface: Color(0xFFF7FBFB),
  surfaceDim: Color(0xFFD4E2E5),
  surfaceBright: Color(0xFFF7FBFB),
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
  outlineVariant: Color(0xFF9FB8BE),
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
  surface: Color(0xFF0F2236),
  surfaceDim: Color(0xFF0B1929),
  surfaceBright: Color(0xFF26445C),
  surfaceContainerLowest: Color(0xFF14283F),
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
