import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supa;

import '../models/user_profile.dart';
import '../services/auth_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────

/// Provides a singleton [AuthService] instance.
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

// ─── Current Supabase User ───────────────────────────────────────────────

/// Exposes the currently authenticated Supabase [supa.User] reactively.
///
/// Emits a new value whenever the auth state changes (sign-in, sign-out,
/// token refresh). Returns `null` when not authenticated.
final currentUserProvider = StreamProvider<supa.User?>((ref) {
  final authService = ref.watch(authServiceProvider);

  // Seed with current user, then listen for changes.
  final controller = StreamController<supa.User?>();
  controller.add(authService.getCurrentUser());

  final subscription = authService.onAuthStateChange.listen((authState) {
    controller.add(authState.session?.user);
  });

  ref.onDispose(() {
    subscription.cancel();
    controller.close();
  });

  return controller.stream;
});

// ─── User Profile ────────────────────────────────────────────────────────

/// Fetches the [UserProfile] for the currently authenticated user.
///
/// Automatically re-fetches whenever [currentUserProvider] changes.
/// Returns `null` while loading or if not authenticated.
final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final userAsync = ref.watch(currentUserProvider);

  return userAsync.when(
    data: (user) async {
      if (user == null) return null;
      final authService = ref.read(authServiceProvider);
      return authService.getUserProfile();
    },
    loading: () => null,
    error: (_, __) => null,
  );
});

// ─── Auth State Notifier ─────────────────────────────────────────────────

/// State class for the auth notifier. Named `AppAuthState` to avoid
/// collision with Supabase's `AuthState`.
@immutable
class AppAuthState {
  const AppAuthState({
    this.isLoading = false,
    this.error,
    this.user,
    this.profile,
  });

  final bool isLoading;
  final String? error;
  final supa.User? user;
  final UserProfile? profile;

  bool get isAuthenticated => user != null;

  AppAuthState copyWith({
    bool? isLoading,
    String? error,
    supa.User? user,
    UserProfile? profile,
    bool clearError = false,
    bool clearUser = false,
    bool clearProfile = false,
  }) {
    return AppAuthState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      user: clearUser ? null : (user ?? this.user),
      profile: clearProfile ? null : (profile ?? this.profile),
    );
  }
}

/// [StateNotifier] that manages the full authentication lifecycle.
///
/// Use this when you need imperative control (e.g. calling `signIn`,
/// `signUp`, etc. from a button handler).
class AuthNotifier extends StateNotifier<AppAuthState> {
  AuthNotifier(this._authService) : super(const AppAuthState()) {
    _init();
  }

  final AuthService _authService;
  StreamSubscription<supa.AuthState>? _authSub;

  void _init() {
    // Seed with current user
    final user = _authService.getCurrentUser();
    if (user != null) {
      state = state.copyWith(user: user);
      _loadProfile();
    }

    // Listen for auth changes
    _authSub = _authService.onAuthStateChange.listen((event) {
      final newUser = event.session?.user;
      if (newUser != null) {
        state = state.copyWith(user: newUser, clearError: true);
        _loadProfile();
      } else {
        state = state.copyWith(
          clearUser: true,
          clearProfile: true,
          clearError: true,
        );
      }
    });
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await _authService.getUserProfile();
      if (mounted) {
        state = state.copyWith(profile: profile);
      }
    } catch (e) {
      debugPrint('_loadProfile error: $e');
    }
  }

  /// Sign in with email and password.
  Future<void> signIn(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _authService.signIn(
        email: email,
        password: password,
      );
      state = state.copyWith(
        isLoading: false,
        user: response.user,
        clearError: true,
      );
      _loadProfile();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Sign up with email, password, and display name.
  Future<void> signUp(String email, String password, String name) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _authService.signUp(
        email: email,
        password: password,
        name: name,
      );
      state = state.copyWith(
        isLoading: false,
        user: response.user,
        clearError: true,
      );
      _loadProfile();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Sign in with Google OAuth.
  Future<void> signInWithGoogle() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _authService.signInWithGoogle();
      // OAuth redirect flow — user will come back via deep link
      // The auth state change listener will handle the rest
      state = state.copyWith(
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Sign out the current user.
  Future<void> signOut() async {
    state = state.copyWith(isLoading: true);
    await _authService.signOut();
    state = const AppAuthState();
  }

  /// Refresh the user profile from Supabase.
  Future<void> refreshProfile() async {
    await _loadProfile();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}

/// Provider for the [AuthNotifier].
final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AppAuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});
