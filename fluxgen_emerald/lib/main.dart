import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/core/constants/app_constants.dart';
import 'package:emerald/providers/theme_provider.dart';
import 'package:emerald/services/offline_queue_service.dart';
import 'package:emerald/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));

  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  // Initialize offline queue
  await OfflineQueueService.instance.init();

  final prefs = await SharedPreferences.getInstance();

  // Initialize Sentry for automatic crash reporting
  await SentryFlutter.init(
    (options) {
      options.dsn = AppConstants.sentryDsn;
      options.tracesSampleRate = 0.3;
      options.environment = 'production';
      options.release = 'com.fluxgentech.emerald@${AppConstants.appVersion}';
      options.attachScreenshot = true;
      options.sendDefaultPii = false; // don't send emails/IPs
    },
    appRunner: () {
      // Set user context for Sentry (user ID only, no PII)
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        Sentry.configureScope((scope) {
          scope.setUser(SentryUser(id: user.id));
        });
      }

      runApp(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
          ],
          child: const FluxGenApp(),
        ),
      );
    },
  );
}
