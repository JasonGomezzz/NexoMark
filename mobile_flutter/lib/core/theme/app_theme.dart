import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Tema de la dirección "Línea". Dos familias:
/// - Overpass (600–800): titulares, estaciones, cifras y el texto dictado.
/// - Inter (400–700): cuerpo, controles y tablas.
///
/// Todo el tracking se fija a mano: Material deja +0.25/+0.5 en el cuerpo y
/// eso es lo que hacía ver la app como plantilla. Nada baja de 13 sp.
ThemeData buildTheme(Brightness brightness, {TargetPlatform? platform}) {
  final scheme = brightness == Brightness.light ? nexoLightScheme : nexoDarkScheme;
  final nexo = brightness == Brightness.light ? NexoColors.light : NexoColors.dark;
  final plataforma = platform ?? defaultTargetPlatform;
  final ios = plataforma == TargetPlatform.iOS;
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness, platform: plataforma);

  TextStyle display(double size, FontWeight w, double tracking, double height) => GoogleFonts.overpass(
        fontSize: size,
        fontWeight: w,
        letterSpacing: size * tracking,
        height: height,
        color: scheme.onSurface,
      );
  TextStyle texto(double size, FontWeight w, double height, {Color? color}) => GoogleFonts.inter(
        fontSize: size,
        fontWeight: w,
        letterSpacing: 0,
        height: height,
        color: color ?? scheme.onSurface,
      );
  const cifras = [FontFeature.tabularFigures()];

  final textTheme = TextTheme(
    // Cifra destacada y cifra grande.
    displayLarge: display(40, FontWeight.w800, -0.02, 1).copyWith(fontFeatures: cifras),
    displayMedium: display(28, FontWeight.w800, -0.02, 1).copyWith(fontFeatures: cifras),
    // Título de página (h1 móvil).
    displaySmall: display(30, FontWeight.w800, -0.02, 1.05),
    // Frase dictada (móvil).
    headlineMedium: display(25, FontWeight.w700, -0.02, 1.18),
    // h2 de sección (móvil) y h3.
    headlineSmall: display(20, FontWeight.w800, -0.015, 1.2),
    titleLarge: display(18, FontWeight.w800, -0.01, 1.25),
    titleMedium: texto(16, FontWeight.w600, 1.35),
    titleSmall: texto(15, FontWeight.w600, 1.35),
    bodyLarge: texto(16, FontWeight.w400, 1.6),
    bodyMedium: texto(15, FontWeight.w400, 1.5),
    bodySmall: texto(13, FontWeight.w500, 1.4, color: scheme.onSurfaceVariant),
    labelLarge: texto(15, FontWeight.w600, 1.2),
    // Estación de la línea.
    labelMedium: display(15, FontWeight.w600, 0, 1),
    labelSmall: texto(13, FontWeight.w600, 1.2),
  );

  const pastilla = StadiumBorder();
  const buttonPadding = EdgeInsets.symmetric(horizontal: 22, vertical: 14);
  const minButton = Size(48, 52);
  final campo = BorderRadius.circular(Nexo.radiusField);

  return base.copyWith(
    textTheme: textTheme,
    scaffoldBackgroundColor: scheme.surface,
    extensions: [nexo],
    // En iOS no hay onda: la respuesta al toque es la escala de Pressable y el resaltado.
    splashFactory: ios ? NoSplash.splashFactory : InkSparkle.splashFactory,
    highlightColor: ios ? scheme.onSurface.withValues(alpha: 0.06) : null,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: ios,
      titleTextStyle: textTheme.titleLarge,
      foregroundColor: scheme.onSurface,
    ),
    cardTheme: CardThemeData(
      color: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Nexo.radiusSurface),
        side: BorderSide(color: nexo.hairline),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: pastilla,
        padding: buttonPadding,
        minimumSize: minButton,
        textStyle: textTheme.labelLarge,
        disabledBackgroundColor: scheme.surfaceContainerHigh,
        disabledForegroundColor: scheme.onSurfaceVariant,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: pastilla,
        padding: buttonPadding,
        minimumSize: minButton,
        side: BorderSide(color: scheme.outline),
        foregroundColor: scheme.onSurface,
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: pastilla,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        textStyle: textTheme.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      floatingLabelStyle: textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
      hintStyle: textTheme.bodyMedium?.copyWith(color: scheme.outline),
      helperStyle: textTheme.bodySmall,
      errorStyle: textTheme.bodySmall?.copyWith(color: scheme.error),
      helperMaxLines: 3,
      errorMaxLines: 3,
      border: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.outline)),
      enabledBorder: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.outline)),
      focusedBorder: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.primary, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.error)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.error, width: 2)),
      disabledBorder: OutlineInputBorder(borderRadius: campo, borderSide: BorderSide(color: scheme.outlineVariant)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: scheme.outlineVariant,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Nexo.radiusSheet)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: textTheme.titleLarge,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Nexo.radiusSheet)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: scheme.inverseSurface,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: scheme.onInverseSurface),
      actionTextColor: brightness == Brightness.light ? Nexo.turquoiseSoft : scheme.inversePrimary,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Nexo.radiusSurface)),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: const StadiumBorder(),
      side: BorderSide(color: scheme.outlineVariant),
      labelStyle: textTheme.labelSmall,
      backgroundColor: scheme.surfaceContainerLowest,
    ),
    dividerTheme: DividerThemeData(color: nexo.hairline, space: 1, thickness: 1),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: scheme.primary,
      linearTrackColor: scheme.surfaceContainerHigh,
      circularTrackColor: Colors.transparent,
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
