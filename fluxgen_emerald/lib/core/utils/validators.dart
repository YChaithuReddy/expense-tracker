/// Form field validators for the FluxGen Expense Tracker.
///
/// Each validator returns `null` when the value is valid, or a
/// human-readable error message string when invalid.
/// All validators follow the [FormFieldValidator<String>] signature.
abstract final class Validators {
  // ─── General ────────────────────────────────────────────────────────

  /// Validates that the field is not null, empty, or whitespace-only.
  static String? required(String? value, {String fieldName = 'This field'}) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  // ─── Email ──────────────────────────────────────────────────────────

  static final RegExp _emailRegex = RegExp(
    r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}'
    r'[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?)*$',
  );

  /// Validates a well-formed email address.
  ///
  /// Returns an error message if [value] is empty or not a valid email.
  static String? email(String? value) {
    final requiredError = required(value, fieldName: 'Email');
    if (requiredError != null) return requiredError;

    if (!_emailRegex.hasMatch(value!.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  // ─── Amount ─────────────────────────────────────────────────────────

  /// Validates an expense amount.
  ///
  /// The amount must be a positive number and optionally not exceed [max].
  /// Strips rupee symbols and commas before parsing.
  static String? amount(
    String? value, {
    double max = 10000000,
    bool allowZero = false,
  }) {
    final requiredError = required(value, fieldName: 'Amount');
    if (requiredError != null) return requiredError;

    final cleaned = value!
        .replaceAll('\u20B9', '')
        .replaceAll(',', '')
        .replaceAll(' ', '')
        .trim();

    final parsed = double.tryParse(cleaned);

    if (parsed == null) {
      return 'Enter a valid number';
    }

    if (parsed < 0) {
      return 'Amount cannot be negative';
    }

    if (!allowZero && parsed == 0) {
      return 'Amount must be greater than zero';
    }

    if (parsed > max) {
      return 'Amount cannot exceed \u20B9${max.toStringAsFixed(0)}';
    }

    return null;
  }

  // ─── IFSC Code ──────────────────────────────────────────────────────

  /// Regex: 4 uppercase alpha + 0 + 6 alphanumeric characters.
  static final RegExp _ifscRegex = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');

  /// Validates an Indian Financial System Code (IFSC).
  ///
  /// Format: 4 letters + 0 + 6 alphanumeric characters (e.g. SBIN0001234).
  static String? ifscCode(String? value) {
    final requiredError = required(value, fieldName: 'IFSC code');
    if (requiredError != null) return requiredError;

    final trimmed = value!.trim().toUpperCase();

    if (trimmed.length != 11) {
      return 'IFSC code must be 11 characters';
    }

    if (!_ifscRegex.hasMatch(trimmed)) {
      return 'Enter a valid IFSC code (e.g. SBIN0001234)';
    }

    return null;
  }

  // ─── Phone Number ───────────────────────────────────────────────────

  static final RegExp _phoneRegex = RegExp(r'^[6-9]\d{9}$');

  /// Validates an Indian mobile number (10 digits, starts with 6-9).
  static String? phone(String? value) {
    final requiredError = required(value, fieldName: 'Phone number');
    if (requiredError != null) return requiredError;

    final cleaned = value!.replaceAll(RegExp(r'[\s\-+]'), '');
    // Strip +91 country code if present
    final digits = cleaned.startsWith('91') && cleaned.length == 12
        ? cleaned.substring(2)
        : cleaned;

    if (!_phoneRegex.hasMatch(digits)) {
      return 'Enter a valid 10-digit mobile number';
    }

    return null;
  }

  // ─── Password ───────────────────────────────────────────────────────

  /// Validates password strength.
  ///
  /// Requires at least [minLength] characters (default 8).
  static String? password(String? value, {int minLength = 8}) {
    final requiredError = required(value, fieldName: 'Password');
    if (requiredError != null) return requiredError;

    if (value!.length < minLength) {
      return 'Password must be at least $minLength characters';
    }

    return null;
  }

  /// Validates that [value] matches [originalPassword].
  static String? confirmPassword(String? value, String originalPassword) {
    final requiredError = required(value, fieldName: 'Confirm password');
    if (requiredError != null) return requiredError;

    if (value != originalPassword) {
      return 'Passwords do not match';
    }

    return null;
  }

  // ─── Min / Max Length ───────────────────────────────────────────────

  /// Validates minimum string length.
  static String? minLength(String? value, int min, {String fieldName = 'This field'}) {
    final requiredError = required(value, fieldName: fieldName);
    if (requiredError != null) return requiredError;

    if (value!.trim().length < min) {
      return '$fieldName must be at least $min characters';
    }

    return null;
  }

  /// Validates maximum string length.
  static String? maxLength(String? value, int max, {String fieldName = 'This field'}) {
    if (value == null) return null;

    if (value.trim().length > max) {
      return '$fieldName must not exceed $max characters';
    }

    return null;
  }

  // ─── Composite ──────────────────────────────────────────────────────

  /// Chains multiple validators. Returns the first error encountered,
  /// or `null` if all validators pass.
  ///
  /// ```dart
  /// validator: Validators.compose([
  ///   (v) => Validators.required(v, fieldName: 'Name'),
  ///   (v) => Validators.minLength(v, 2, fieldName: 'Name'),
  /// ]),
  /// ```
  static String? Function(String?) compose(
    List<String? Function(String?)> validators,
  ) {
    return (String? value) {
      for (final validator in validators) {
        final error = validator(value);
        if (error != null) return error;
      }
      return null;
    };
  }
}
