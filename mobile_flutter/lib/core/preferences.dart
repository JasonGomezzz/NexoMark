import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tema claro, oscuro o el del sistema, guardado en el teléfono.
class ThemeModeController extends Notifier<ThemeMode> {
  static const _key = 'tema';

  @override
  ThemeMode build() {
    Future.microtask(_load);
    return ThemeMode.system;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = switch (prefs.getString(_key)) {
      'claro' => ThemeMode.light,
      'oscuro' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, switch (mode) {
      ThemeMode.light => 'claro',
      ThemeMode.dark => 'oscuro',
      ThemeMode.system => 'sistema',
    });
  }
}

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(
  ThemeModeController.new,
);
