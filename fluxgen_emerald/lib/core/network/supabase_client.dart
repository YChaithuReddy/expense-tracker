import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../constants/app_constants.dart';

/// Singleton wrapper around the Supabase Flutter client.
///
/// Call [SupabaseClientManager.initialize] once in `main()` before
/// `runApp`. After that, access the client via [SupabaseClientManager.client]
/// or the convenience top-level getter [supabase].
///
/// ```dart
/// // In main.dart
/// await SupabaseClientManager.initialize();
/// runApp(const App());
///
/// // Anywhere else
/// final data = await supabase.from('expenses').select();
/// ```
class SupabaseClientManager {
  SupabaseClientManager._();

  static bool _initialized = false;

  /// Initialize the Supabase SDK. Must be called exactly once,
  /// typically in `main()` before `runApp`.
  static Future<void> initialize() async {
    if (_initialized) return;

    await Supabase.initialize(
      url: AppConstants.supabaseUrl,
      anonKey: AppConstants.supabaseAnonKey,
      debug: kDebugMode,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );

    _initialized = true;
  }

  /// The fully-initialized [SupabaseClient].
  ///
  /// Throws a [StateError] if called before [initialize].
  static SupabaseClient get client {
    if (!_initialized) {
      throw StateError(
        'SupabaseClientManager.initialize() has not been called. '
        'Call it in main() before accessing the client.',
      );
    }
    return Supabase.instance.client;
  }

  /// Shortcut to the Supabase Auth instance.
  static GoTrueClient get auth => client.auth;

  /// Whether the SDK has been initialised.
  static bool get isInitialized => _initialized;
}

/// Top-level convenience getter so services can simply write `supabase`
/// instead of `SupabaseClientManager.client`.
SupabaseClient get supabase => SupabaseClientManager.client;
