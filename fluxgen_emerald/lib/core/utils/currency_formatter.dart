import 'package:intl/intl.dart';

/// Indian rupee formatting utilities.
///
/// Uses the Indian numbering system (lakhs / crores) via the `en_IN` locale.
/// All methods are static and stateless for easy use across the app.
abstract final class CurrencyFormatter {
  /// Standard INR formatter: ₹1,23,456.00
  static final NumberFormat _inrFormat = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '\u20B9',
    decimalDigits: 2,
  );

  /// Compact INR formatter without decimals: ₹1,23,456
  static final NumberFormat _inrCompact = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '\u20B9',
    decimalDigits: 0,
  );

  /// Decimal-only formatter (no symbol): 1,23,456.00
  static final NumberFormat _decimalFormat = NumberFormat(
    '#,##,##0.00',
    'en_IN',
  );

  /// Formats [amount] as Indian rupees with 2 decimal places.
  ///
  /// Example: `format(1234.5)` → `₹1,234.50`
  static String format(num amount) {
    return _inrFormat.format(amount);
  }

  /// Formats [amount] as Indian rupees with no decimal places.
  ///
  /// Example: `formatCompact(1234)` → `₹1,234`
  static String formatCompact(num amount) {
    return _inrCompact.format(amount);
  }

  /// Formats [amount] as a decimal string without the rupee symbol.
  ///
  /// Example: `formatDecimal(1234.5)` → `1,234.50`
  static String formatDecimal(num amount) {
    return _decimalFormat.format(amount);
  }

  /// Formats large amounts in a human-readable short form.
  ///
  /// Examples:
  /// - `formatShort(950)` → `₹950`
  /// - `formatShort(15000)` → `₹15K`
  /// - `formatShort(250000)` → `₹2.5L`
  /// - `formatShort(10000000)` → `₹1Cr`
  static String formatShort(num amount) {
    const rupee = '\u20B9';
    final absAmount = amount.abs();
    final sign = amount < 0 ? '-' : '';

    if (absAmount >= 10000000) {
      final crores = absAmount / 10000000;
      return '$sign$rupee${_formatShortNumber(crores)}Cr';
    } else if (absAmount >= 100000) {
      final lakhs = absAmount / 100000;
      return '$sign$rupee${_formatShortNumber(lakhs)}L';
    } else if (absAmount >= 1000) {
      final thousands = absAmount / 1000;
      return '$sign$rupee${_formatShortNumber(thousands)}K';
    } else {
      return '$sign$rupee${absAmount.toStringAsFixed(0)}';
    }
  }

  /// Parses a formatted currency string back to a double.
  ///
  /// Strips the rupee symbol, commas, and whitespace before parsing.
  /// Returns `null` if the string cannot be parsed.
  static double? parse(String value) {
    final cleaned = value
        .replaceAll('\u20B9', '')
        .replaceAll(',', '')
        .replaceAll(' ', '')
        .trim();

    if (cleaned.isEmpty) return null;
    return double.tryParse(cleaned);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  static String _formatShortNumber(double value) {
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }
    // Show one decimal place, strip trailing zero
    final formatted = value.toStringAsFixed(1);
    return formatted.endsWith('0')
        ? formatted.substring(0, formatted.length - 1)
        : formatted;
  }
}
