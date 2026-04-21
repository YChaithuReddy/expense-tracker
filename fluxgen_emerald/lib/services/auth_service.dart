import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/network/supabase_client.dart';
import '../models/user_profile.dart';

/// Authentication service wrapping Supabase Auth and the `profiles` table.
///
/// Provides email/password sign-up, sign-in, Google OAuth, session management,
/// and profile CRUD. All methods throw on failure with a descriptive message
/// suitable for UI display.
class AuthService {
  AuthService();

  // ─── Auth State ────────────────────────────────────────────────────────

  /// Reactive stream of authentication state changes.
  Stream<AuthState> get onAuthStateChange =>
      supabase.auth.onAuthStateChange;

  /// The currently authenticated Supabase [User], or `null`.
  User? getCurrentUser() => supabase.auth.currentUser;

  /// The current session, or `null` if not signed in.
  Session? get currentSession => supabase.auth.currentSession;

  /// Whether a user is currently authenticated.
  bool get isAuthenticated => supabase.auth.currentUser != null;

  // ─── Email / Password ──────────────────────────────────────────────────

  /// Creates a new account with [email] and [password], then inserts a row
  /// into the `profiles` table with the given [name].
  ///
  /// Returns the Supabase [AuthResponse].
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final response = await supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'name': name,
          'full_name': name,
        },
      );

      // Create a profile row for the new user.
      final user = response.user;
      if (user != null) {
        await _ensureProfileExists(
          userId: user.id,
          email: email,
          name: name,
          avatarUrl: null,
        );
      }

      return response;
    } on AuthException catch (e) {
      throw _mapAuthError(e);
    } catch (e) {
      throw Exception('Sign-up failed: $e');
    }
  }

  /// Signs in with [email] and [password].
  ///
  /// Returns the Supabase [AuthResponse] containing the session.
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      return response;
    } on AuthException catch (e) {
      throw _mapAuthError(e);
    } catch (e) {
      throw Exception('Sign-in failed: $e');
    }
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────

  /// Initiates Google OAuth sign-in via Supabase redirect flow.
  ///
  /// Opens browser for Google login, redirects back to app via deep link
  /// `com.fluxgentech.emerald://auth` which Supabase handles automatically.
  Future<bool> signInWithGoogle() async {
    try {
      final success = await supabase.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'com.fluxgentech.emerald://auth',
        queryParams: {
          'hd': 'fluxgentech.com',
        },
      );
      return success;
    } on AuthException catch (e) {
      throw _mapAuthError(e);
    } catch (e) {
      throw Exception('Google sign-in failed: $e');
    }
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────

  /// Signs out the current user (clears session locally and on the server).
  Future<void> signOut() async {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      debugPrint('Sign-out error (non-critical): $e');
      // Even if the server call fails, the local session is cleared.
    }
  }

  // ─── Profile ───────────────────────────────────────────────────────────

  /// Fetches the full [UserProfile] for the currently authenticated user.
  ///
  /// Returns `null` if no user is signed in or if the profile row
  /// doesn't exist yet.
  Future<UserProfile?> getUserProfile() async {
    final user = getCurrentUser();
    if (user == null) return null;

    try {
      final data = await supabase
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (data == null) return null;
      return UserProfile.fromJson(data);
    } catch (e) {
      debugPrint('getUserProfile error: $e');
      return null;
    }
  }

  /// Fetches a [UserProfile] by arbitrary [userId].
  Future<UserProfile?> getProfileById(String userId) async {
    try {
      final data = await supabase
          .from('profiles')
          .select()
          .eq('id', userId)
          .maybeSingle();

      if (data == null) return null;
      return UserProfile.fromJson(data);
    } catch (e) {
      debugPrint('getProfileById error: $e');
      return null;
    }
  }

  /// Updates the current user's profile with the provided fields.
  ///
  /// Only non-null arguments are sent to Supabase.
  Future<UserProfile> updateProfile({
    String? name,
    String? employeeId,
    String? designation,
    String? department,
  }) async {
    final user = getCurrentUser();
    if (user == null) throw Exception('Not authenticated');

    final updates = <String, dynamic>{};
    if (name != null) updates['name'] = name;
    if (employeeId != null) updates['employee_id'] = employeeId;
    if (designation != null) updates['designation'] = designation;
    if (department != null) updates['department'] = department;
    updates['updated_at'] = DateTime.now().toIso8601String();

    try {
      final data = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

      return UserProfile.fromJson(data);
    } catch (e) {
      throw Exception('Failed to update profile: $e');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /// Creates a profile row if one doesn't already exist for [userId].
  Future<void> _ensureProfileExists({
    required String userId,
    required String email,
    String? name,
    String? avatarUrl,
  }) async {
    try {
      final existing = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

      if (existing != null) return; // Profile already exists

      await supabase.from('profiles').insert({
        'id': userId,
        'email': email,
        'name': name ?? email.split('@').first,
        'profile_picture': avatarUrl,
      });
    } catch (e) {
      // Non-critical — the profile trigger on Supabase may also create it.
      debugPrint('_ensureProfileExists warning: $e');
    }
  }

  /// Maps a Supabase [AuthException] to a user-friendly [Exception].
  Exception _mapAuthError(AuthException e) {
    final msg = e.message.toLowerCase();
    if (msg.contains('invalid login credentials') ||
        msg.contains('invalid email or password')) {
      return Exception('Invalid email or password');
    }
    if (msg.contains('email not confirmed')) {
      return Exception('Please verify your email before signing in');
    }
    if (msg.contains('user already registered')) {
      return Exception('An account with this email already exists');
    }
    if (msg.contains('rate limit')) {
      return Exception('Too many attempts. Please try again later.');
    }
    return Exception(e.message);
  }
}
