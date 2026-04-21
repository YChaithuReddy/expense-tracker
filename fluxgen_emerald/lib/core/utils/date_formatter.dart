import 'package:intl/intl.dart';

/// Date and time formatting utilities for the Azure Ledger design system.
///
/// Provides standard formats (DD MMM YYYY), relative time strings
/// ("2 hours ago"), and month-year grouping labels.
abstract final class DateFormatter {
  // ─── Formatters ─────────────────────────────────────────────────────
  static final DateFormat _ddMmmYyyy = DateFormat('dd MMM yyyy');
  static final DateFormat _ddMmmYyyyHhmm = DateFormat('dd MMM yyyy, hh:mm a');
  static final DateFormat _monthYear = DateFormat('MMMM yyyy');
  static final DateFormat _shortMonthYear = DateFormat('MMM yyyy');
  static final DateFormat _dayMonth = DateFormat('dd MMM');
  static final DateFormat _time = DateFormat('hh:mm a');
  static final DateFormat _iso8601 = DateFormat("yyyy-MM-dd'T'HH:mm:ss");

  /// Formats as `DD MMM YYYY` (e.g. `12 Apr 2026`).
  static String format(DateTime date) => _ddMmmYyyy.format(date);

  /// Formats as `DD MMM YYYY, hh:mm AM/PM` (e.g. `12 Apr 2026, 02:30 PM`).
  static String formatWithTime(DateTime date) => _ddMmmYyyyHhmm.format(date);

  /// Formats as `MMMM yyyy` (e.g. `April 2026`).
  static String formatMonthYear(DateTime date) => _monthYear.format(date);

  /// Formats as `MMM yyyy` (e.g. `Apr 2026`).
  static String formatShortMonthYear(DateTime date) {
    return _shortMonthYear.format(date);
  }

  /// Formats as `DD MMM` (e.g. `12 Apr`).
  static String formatDayMonth(DateTime date) => _dayMonth.format(date);

  /// Formats time only as `hh:mm AM/PM` (e.g. `02:30 PM`).
  static String formatTime(DateTime date) => _time.format(date);

  /// Formats as ISO 8601 string.
  static String formatIso8601(DateTime date) => _iso8601.format(date);

  /// Returns a human-readable relative time string.
  ///
  /// Examples:
  /// - `Just now` (< 1 minute)
  /// - `2 minutes ago`
  /// - `1 hour ago`
  /// - `Yesterday`
  /// - `3 days ago`
  /// - `12 Apr 2026` (> 7 days)
  static String relative(DateTime date, {DateTime? relativeTo}) {
    final now = relativeTo ?? DateTime.now();
    final difference = now.difference(date);

    if (difference.isNegative) {
      return format(date);
    }

    if (difference.inSeconds < 60) {
      return 'Just now';
    }

    if (difference.inMinutes < 60) {
      final minutes = difference.inMinutes;
      return '$minutes ${minutes == 1 ? 'minute' : 'minutes'} ago';
    }

    if (difference.inHours < 24) {
      final hours = difference.inHours;
      return '$hours ${hours == 1 ? 'hour' : 'hours'} ago';
    }

    if (difference.inDays == 1) {
      return 'Yesterday';
    }

    if (difference.inDays < 7) {
      final days = difference.inDays;
      return '$days ${days == 1 ? 'day' : 'days'} ago';
    }

    return format(date);
  }

  /// Groups a date into a display-friendly label for list section headers.
  ///
  /// Returns `Today`, `Yesterday`, `This Week`, `This Month`, or the
  /// month-year string for older dates.
  static String groupLabel(DateTime date, {DateTime? relativeTo}) {
    final now = relativeTo ?? DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateDay = DateTime(date.year, date.month, date.day);

    final difference = today.difference(dateDay).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';
    if (difference < 7) return 'This Week';

    if (date.year == now.year && date.month == now.month) {
      return 'This Month';
    }

    return formatMonthYear(date);
  }

  /// Parses a date string using common formats.
  ///
  /// Tries ISO 8601 first, then `dd MMM yyyy`. Returns `null` on failure.
  static DateTime? tryParse(String value) {
    return DateTime.tryParse(value) ?? _tryParseCustom(value);
  }

  static DateTime? _tryParseCustom(String value) {
    try {
      return _ddMmmYyyy.parseStrict(value);
    } on FormatException {
      return null;
    }
  }
}
