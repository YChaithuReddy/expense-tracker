import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/core/theme/app_colors.dart';
import 'package:emerald/providers/theme_provider.dart';
import 'package:emerald/screens/auth/login_screen.dart';
import 'package:emerald/screens/employee/employee_shell.dart';
import 'package:emerald/screens/admin/admin_shell.dart';

class FluxGenApp extends ConsumerWidget {
  const FluxGenApp({super.key});

  // ─── Dark Theme Colors ──────────────────────────────────────────────
  static const _darkScaffold = Color(0xFF0F172A);
  static const _darkSurface = Color(0xFF1E293B);
  static const _darkSurfaceLow = Color(0xFF1A2332);
  static const _darkOnSurface = Color(0xFFE2E8F0);
  static const _darkOnSurfaceVariant = Color(0xFF94A3B8);
  static const _darkOutline = Color(0xFF475569);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp(
      title: 'FluxGen Expense Tracker',
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,

      // ─── Light Theme ──────────────────────────────────────────────────
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: ColorScheme.light(
          primary: AppColors.primary,
          onPrimary: Colors.white,
          surface: AppColors.surface,
          onSurface: AppColors.onSurface,
          error: AppColors.error,
          outline: AppColors.outline,
        ),
        scaffoldBackgroundColor: AppColors.surface,
        textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
            letterSpacing: -0.02,
          ),
          iconTheme: IconThemeData(color: AppColors.onSurfaceVariant),
        ),
        cardTheme: CardThemeData(
          color: AppColors.surfaceContainerLowest,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          margin: EdgeInsets.zero,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.onSurface,
            side: BorderSide(color: AppColors.outline),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surfaceContainerLow,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          labelStyle: const TextStyle(
            color: AppColors.onSurfaceVariant,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.onSurfaceVariant,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedLabelStyle: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.surfaceContainerLow,
          selectedColor: AppColors.primary,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          shape: const StadiumBorder(),
          side: BorderSide.none,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        ),
        dividerTheme: const DividerThemeData(
          color: Colors.transparent,
          space: 24,
        ),
      ),

      // ─── Dark Theme ───────────────────────────────────────────────────
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.dark(
          primary: AppColors.primary,
          onPrimary: Colors.white,
          surface: _darkSurface,
          onSurface: _darkOnSurface,
          error: const Color(0xFFFF6B6B),
          outline: _darkOutline,
        ),
        scaffoldBackgroundColor: _darkScaffold,
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: _darkOnSurface,
            letterSpacing: -0.02,
          ),
          iconTheme: IconThemeData(color: _darkOnSurfaceVariant),
        ),
        cardTheme: CardThemeData(
          color: _darkSurface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          margin: EdgeInsets.zero,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _darkOnSurface,
            side: const BorderSide(color: _darkOutline),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: _darkSurfaceLow,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          labelStyle: const TextStyle(
            color: _darkOnSurfaceVariant,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF1E293B),
          selectedItemColor: AppColors.primary,
          unselectedItemColor: _darkOnSurfaceVariant,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedLabelStyle: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: _darkSurfaceLow,
          selectedColor: AppColors.primary,
          labelStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: _darkOnSurface,
          ),
          shape: const StadiumBorder(),
          side: BorderSide.none,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        ),
        dividerTheme: const DividerThemeData(
          color: Colors.transparent,
          space: 24,
        ),
        dialogTheme: DialogThemeData(
          backgroundColor: _darkSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: _darkSurface,
          contentTextStyle: TextStyle(color: _darkOnSurface),
        ),
      ),

      home: const AuthGate(),
    );
  }
}

/// Decides whether to show login or the main app.
/// Checks persisted session first (instant), then listens for auth changes.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool? _isLoggedIn;

  @override
  void initState() {
    super.initState();
    // Check persisted session immediately (no network needed)
    final session = Supabase.instance.client.auth.currentSession;
    _isLoggedIn = session != null;

    // Listen for future auth changes (login/logout)
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (!mounted) return;
      final hasSession = data.session != null;
      if (hasSession != _isLoggedIn) {
        setState(() => _isLoggedIn = hasSession);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoggedIn == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF3F4F6),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF006699))),
      );
    }
    if (_isLoggedIn!) {
      return const _RoleRouter();
    }
    return const LoginScreen();
  }
}

/// Routes to Admin or Employee shell based on role.
/// Admin/Accountant/Manager → AdminShell only (no employee view).
/// Employee → EmployeeShell only.
class _RoleRouter extends StatefulWidget {
  const _RoleRouter();

  @override
  State<_RoleRouter> createState() => _RoleRouterState();
}

class _RoleRouterState extends State<_RoleRouter> {
  static const _superUserEmail = 'chaithanya@fluxgentech.com';

  String? _role;
  String? _email;
  bool _loading = true;
  bool _showEmployeeView = false;

  @override
  void initState() {
    super.initState();
    _fetchRole();
  }

  Future<void> _fetchRole() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      var profile = await Supabase.instance.client
          .from('profiles')
          .select('role, email')
          .eq('id', user.id)
          .maybeSingle();

      // If Google OAuth user has no profile yet, create one
      if (profile == null) {
        try {
          await Supabase.instance.client.from('profiles').insert({
            'id': user.id,
            'email': user.email,
            'name': user.userMetadata?['name'] ?? user.userMetadata?['full_name'] ?? user.email?.split('@').first ?? 'User',
          });
        } catch (_) {}
        // Re-fetch
        profile = await Supabase.instance.client
            .from('profiles')
            .select('role, email')
            .eq('id', user.id)
            .maybeSingle();
      }

      if (mounted) {
        setState(() {
          _role = profile?['role'] as String? ?? 'employee';
          _email = (profile?['email'] as String? ?? user.email ?? '').toLowerCase();
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('RoleRouter fetchRole error: $e');
      if (mounted) {
        setState(() {
          _role = 'employee';
          _email = Supabase.instance.client.auth.currentUser?.email?.toLowerCase();
          _loading = false;
        });
      }
    }
  }

  bool get _isAdminRole =>
      _role == 'manager' || _role == 'accountant' || _role == 'admin';

  bool get _isSuperUser => _email == _superUserEmail;

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF3F4F6),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFF006699)),
              SizedBox(height: 16),
              Text(
                'Loading your profile...',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Super-user only: can switch between Admin and Employee dashboards
    if (_isSuperUser && _isAdminRole) {
      return _buildToggleableShell();
    }

    // Admin/Accountant/Manager → Admin dashboard only
    if (_isAdminRole) {
      return const AdminShell();
    }

    // Employee → Employee dashboard
    return const EmployeeShell();
  }

  Widget _buildToggleableShell() {
    final isAdminView = !_showEmployeeView;
    return Stack(children: [
      isAdminView ? const AdminShell() : const EmployeeShell(),
      Positioned(
        bottom: 80,
        right: 16,
        child: SafeArea(
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => setState(() => _showEmployeeView = !_showEmployeeView),
              borderRadius: BorderRadius.circular(28),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isAdminView ? const Color(0xFF191C1E) : const Color(0xFF006699),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: (isAdminView ? const Color(0xFF191C1E) : const Color(0xFF006699)).withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.swap_horiz, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    isAdminView ? 'Employee View' : 'Admin View',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}
