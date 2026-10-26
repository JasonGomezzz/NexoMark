import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Tema Material 3 con la identidad NexoMark. Inter en todos los roles y nada
/// por debajo de 13 sp. Sin sombras en reposo: las tarjetas se separan por
/// tono y un borde fino.
ThemeData buildTheme(Brightness brightness) {
  final scheme = brightness == Brightness.light
      ? nexoLightScheme
      : nexoDarkScheme;
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    brightness: brightness,
  );
  final inter = GoogleFonts.interTextTheme(base.textTheme);

  TextStyle? t(
    TextStyle? s,
    double size,
    FontWeight w, {
    double? spacing,
    double? height,
  }) => s?.copyWith(
    fontSize: size,
    fontWeight: w,
    letterSpacing: spacing,
    height: height,
    color: scheme.onSurface,
  );

  final textTheme = inter.copyWith(
    displaySmall: t(
      inter.displaySmall,
      30,
      FontWeight.w800,
      spacing: -0.9,
      height: 1.15,
    ),
    headlineMedium: t(
      inter.headlineMedium,
      26,
      FontWeight.w700,
      spacing: -0.5,
      height: 1.2,
    ),
    headlineSmall: t(
      inter.headlineSmall,
      22,
      FontWeight.w700,
      spacing: -0.3,
      height: 1.25,
    ),
    titleLarge: t(inter.titleLarge, 19, FontWeight.w700, spacing: -0.2),
    titleMedium: t(inter.titleMedium, 16, FontWeight.w600),
    titleSmall: t(inter.titleSmall, 14, FontWeight.w600),
    bodyLarge: t(inter.bodyLarge, 16, FontWeight.w400, height: 1.55),
    bodyMedium: t(inter.bodyMedium, 15, FontWeight.w400, height: 1.5),
    bodySmall: t(
      inter.bodySmall,
      13,
      FontWeight.w500,
      height: 1.4,
    )?.copyWith(color: scheme.onSurfaceVariant),
    labelLarge: t(inter.labelLarge, 15, FontWeight.w600),
    labelMedium: t(inter.labelMedium, 13, FontWeight.w600),
    labelSmall: t(inter.labelSmall, 13, FontWeight.w600),
  );

  final buttonShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(Nexo.radiusButton),
  );
  const buttonPadding = EdgeInsets.symmetric(horizontal: 20, vertical: 14);
  const minButton = Size(48, 50);

  return base.copyWith(
    textTheme: textTheme,
    scaffoldBackgroundColor: scheme.surface,
    extensions: [
      brightness == Brightness.light ? NexoColors.light : NexoColors.dark,
    ],
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge,
      foregroundColor: scheme.onSurface,
    ),
    cardTheme: CardThemeData(
      color: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: buttonShape,
        padding: buttonPadding,
        minimumSize: minButton,
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: buttonShape,
        padding: buttonPadding,
        minimumSize: minButton,
        side: BorderSide(color: scheme.outline),
        foregroundColor: scheme.onSurface,
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: buttonShape,
        minimumSize: const Size(48, 48),
        textStyle: textTheme.labelLarge,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: textTheme.bodyMedium?.copyWith(
        color: scheme.onSurfaceVariant,
      ),
      hintStyle: textTheme.bodyMedium?.copyWith(color: scheme.outline),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusButton),
        borderSide: BorderSide(color: scheme.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusButton),
        borderSide: BorderSide(color: scheme.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusButton),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusButton),
        borderSide: BorderSide(color: scheme.error),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      indicatorColor: scheme.primaryFixed,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => textTheme.labelSmall?.copyWith(
          color: states.contains(WidgetState.selected)
              ? scheme.onSurface
              : scheme.onSurfaceVariant,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? scheme.primary
              : scheme.onSurfaceVariant,
        ),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(Nexo.radiusSheet),
        ),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusSheet),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: scheme.inverseSurface,
      contentTextStyle: textTheme.bodyMedium?.copyWith(
        color: scheme.onInverseSurface,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusCard),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusButton),
      ),
      side: BorderSide(color: scheme.outlineVariant),
      labelStyle: textTheme.labelMedium,
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      space: 1,
      thickness: 1,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        // Atrás predictivo de Android 14+: deja ver la pantalla anterior al deslizar.
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
