import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Key used to persist the theme mode in SharedPreferences.
const _themePrefsKey = 'theme_mode';

/// Provides the [SharedPreferences] instance.
///
/// Must be overridden in main.dart before use:
/// ```dart
/// final prefs = await SharedPreferences.getInstance();
/// runApp(
///   ProviderScope(
///     overrides: [
///       sharedPreferencesProvider.overrideWithValue(prefs),
///     ],
///     child: const App(),
///   ),
/// );
/// ```
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  // This will be overridden before the app starts.
  throw UnimplementedError(
    'sharedPreferencesProvider must be overridden with a real '
    'SharedPreferences instance before use.',
  );
});

/// [StateNotifier] that manages the app's [ThemeMode].
///
/// Persists the user's preference to [SharedPreferences] so it survives
/// app restarts.
class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  ThemeModeNotifier(this._prefs) : super(_loadFromPrefs(_prefs));

  final SharedPreferences _prefs;

  /// Reads the stored theme mode from prefs on construction.
  static ThemeMode _loadFromPrefs(SharedPreferences prefs) {
    final stored = prefs.getString(_themePrefsKey);
    switch (stored) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  /// Sets the theme mode and persists it.
  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    final value = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    await _prefs.setString(_themePrefsKey, value);
  }

  /// Toggles between light and dark mode.
  ///
  /// If currently [ThemeMode.system], switches to light.
  Future<void> toggle() async {
    final next = switch (state) {
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.light,
      ThemeMode.system => ThemeMode.light,
    };
    await setThemeMode(next);
  }
}

/// Provides the current [ThemeMode] and exposes [ThemeModeNotifier] for
/// changing it.
///
/// Usage in a widget:
/// ```dart
/// final themeMode = ref.watch(themeModeProvider);
/// ref.read(themeModeProvider.notifier).toggle();
/// ```
final themeModeProvider =
    StateNotifierProvider<ThemeModeNotifier, ThemeMode>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return ThemeModeNotifier(prefs);
});
