import 'package:flutter/material.dart';
import '../../models/fluxgen_status.dart';

/// Azure Ledger design system color constants.
///
/// All colors are defined as compile-time constants for optimal performance.
/// The palette is built around a teal-blue primary with neutral surfaces
/// and semantic status colors for expense workflow states.
abstract final class AppColors {
  // ─── Surfaces ───────────────────────────────────────────────────────
  static const Color surface = Color(0xFFF7F9FB);
  static const Color surfaceContainerLow = Color(0xFFF2F4F6);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);

  // ─── Primary ────────────────────────────────────────────────────────
  static const Color primary = Color(0xFF006699);
  static const Color primaryDark = Color(0xFF00288E);
  static const Color primaryContainer = Color(0xFF1E40AF);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFFD6E3FF);

  // ─── Secondary ──────────────────────────────────────────────────────
  static const Color secondary = Color(0xFF545F71);
  static const Color onSecondary = Color(0xFFFFFFFF);
  static const Color secondaryContainer = Color(0xFFD8E3F8);
  static const Color onSecondaryContainer = Color(0xFF111C2B);

  // ─── Tertiary ───────────────────────────────────────────────────────
  static const Color tertiary = Color(0xFF6D5676);
  static const Color onTertiary = Color(0xFFFFFFFF);
  static const Color tertiaryContainer = Color(0xFFF7D8FF);
  static const Color onTertiaryContainer = Color(0xFF271430);

  // ─── Text / On Surface ──────────────────────────────────────────────
  static const Color onSurface = Color(0xFF191C1E);
  static const Color onSurfaceVariant = Color(0xFF444653);

  // ─── Error ──────────────────────────────────────────────────────────
  static const Color error = Color(0xFFBA1A1A);
  static const Color onError = Color(0xFFFFFFFF);
  static const Color errorContainer = Color(0xFFFFDAD6);
  static const Color onErrorContainer = Color(0xFF410002);

  // ─── Outline ────────────────────────────────────────────────────────
  static const Color outline = Color(0xFF74777F);
  static const Color outlineVariant = Color(0xFFC4C6D0);

  // ─── Status Colors (Expense Workflow) ───────────────────────────────
  static const Color statusActive = Color(0xFF059669);
  static const Color statusPending = Color(0xFFF59E0B);
  static const Color statusClosed = Color(0xFF6B7280);
  static const Color statusReimbursed = Color(0xFF0EA5E9);

  // ─── Status Background Tints ────────────────────────────────────────
  static const Color statusActiveBg = Color(0xFFECFDF5);
  static const Color statusPendingBg = Color(0xFFFFFBEB);
  static const Color statusClosedBg = Color(0xFFF3F4F6);
  static const Color statusReimbursedBg = Color(0xFFF0F9FF);

  // ─── Shadows & Overlays ─────────────────────────────────────────────
  static const Color shadow = Color(0xFF000000);
  static const Color scrim = Color(0xFF000000);

  // ─── Gradients ──────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, primaryDark],
  );

  static const LinearGradient surfaceGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [surfaceContainerLowest, surface],
  );

  /// Returns the background color for a given expense status string.
  static Color statusBackground(String status) {
    return switch (status.toLowerCase()) {
      'active' || 'approved' => statusActiveBg,
      'pending' || 'submitted' => statusPendingBg,
      'closed' || 'rejected' => statusClosedBg,
      'reimbursed' || 'paid' => statusReimbursedBg,
      _ => surfaceContainerLow,
    };
  }

  /// Returns the foreground color for a given expense status string.
  static Color statusForeground(String status) {
    return switch (status.toLowerCase()) {
      'active' || 'approved' => statusActive,
      'pending' || 'submitted' => statusPending,
      'closed' || 'rejected' => statusClosed,
      'reimbursed' || 'paid' => statusReimbursed,
      _ => onSurfaceVariant,
    };
  }

  // ── Attendance (Fluxgen feature) ────────────────────────────────────────

  /// Brand color for each attendance status. Used by the status picker,
  /// weekly grid cells, team list chips, and the floating Attendance pill.
  static Color forAttendanceStatus(AttendanceStatus s) => switch (s) {
        AttendanceStatus.onSite       => const Color(0xFF10B981),
        AttendanceStatus.inOffice     => primary,
        AttendanceStatus.workFromHome => const Color(0xFF8B5CF6),
        AttendanceStatus.onLeave      => const Color(0xFFF59E0B),
        AttendanceStatus.holiday      => const Color(0xFF64748B),
        AttendanceStatus.weekend      => const Color(0xFF94A3B8),
        AttendanceStatus.unknown      => outlineVariant,
      };

  /// Background tint (12% alpha of the brand color). For list row backgrounds.
  static Color forAttendanceStatusBg(AttendanceStatus s) =>
      forAttendanceStatus(s).withValues(alpha: 0.12);
}
