import 'package:flutter/material.dart';

/// Sistema visual "Nexo" (frontend/DESIGN.md). Los valores son los mismos de
/// `frontend/src/index.css` y de la app Kotlin (`ui/theme/Color.kt`); el test
/// `test/paleta_test.dart` comprueba el contraste AA de los pares de texto.
abstract final class Nexo {
  // Marca: iguales en ambos temas.
  static const navy = Color(0xFF14283F);
  static const navyDeep = Color(0xFF0B1929);
  static const navyRaised = Color(0xFF1D3550);
  static const navyLine = Color(0xFF2C4862);
  static const turquoise = Color(0xFF17B8AD);
  static const turquoiseSoft = Color(0xFF79DDD3);
  static const onNavy = Color(0xFFFFFFFF);
  static const onNavyMuted = Color(0xFFB9CBD8);
  static const onNavyError = Color(0xFFFFB4AB);

  // Color de red: solo para identificarla, nunca como fondo grande.
  static const facebook = Color(0xFF1877F2);
  static const instagram = Color(0xFFE8409C);

  // Radios (DESIGN.md → Formas).
  static const radiusButton = 10.0;
  static const radiusCard = 14.0;
  static const radiusPanel = 18.0;
  static const radiusSheet = 22.0;
}

/// Tokens semánticos que Material no trae (éxito y pendiente).
@immutable
class NexoColors extends ThemeExtension<NexoColors> {
  const NexoColors({
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.warning,
    required this.warningContainer,
  });

  final Color success;
  final Color onSuccess;
  final Color successContainer;
  final Color warning;
  final Color warningContainer;

  static const light = NexoColors(
    success: Color(0xFF2A7430),
    onSuccess: Color(0xFFFFFFFF),
    successContainer: Color(0xFFDCF3DD),
    warning: Color(0xFF9A4F00),
    warningContainer: Color(0xFFFFE3C2),
  );

  static const dark = NexoColors(
    success: Color(0xFF8FD991),
    onSuccess: Color(0xFF00390A),
    successContainer: Color(0xFF173D1B),
    warning: Color(0xFFFFBD7C),
    warningContainer: Color(0xFF563100),
  );

  @override
  NexoColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? successContainer,
    Color? warning,
    Color? warningContainer,
  }) {
    return NexoColors(
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      successContainer: successContainer ?? this.successContainer,
      warning: warning ?? this.warning,
      warningContainer: warningContainer ?? this.warningContainer,
    );
  }

  @override
  NexoColors lerp(NexoColors? other, double t) {
    if (other == null) return this;
    return NexoColors(
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      successContainer: Color.lerp(successContainer, other.successContainer, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningContainer: Color.lerp(warningContainer, other.warningContainer, t)!,
    );
  }
}

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
