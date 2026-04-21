/// Model representing employee bank details from the 'employee_bank_details'
/// Supabase table.
///
/// Stores banking and UPI information used for reimbursement payments.
class BankDetails {
  final String id;
  final String userId;
  final String? accountHolderName;
  final String? accountNumber;
  final String? ifscCode;
  final String? bankName;
  final String? upiId;
  final String preferredMethod; // neft, upi, imps
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const BankDetails({
    required this.id,
    required this.userId,
    this.accountHolderName,
    this.accountNumber,
    this.ifscCode,
    this.bankName,
    this.upiId,
    this.preferredMethod = 'neft',
    this.createdAt,
    this.updatedAt,
  });

  /// Whether this record has bank account details filled in.
  bool get hasBankAccount =>
      accountNumber != null &&
      accountNumber!.isNotEmpty &&
      ifscCode != null &&
      ifscCode!.isNotEmpty;

  /// Whether this record has a UPI ID.
  bool get hasUpi => upiId != null && upiId!.isNotEmpty;

  /// Masked account number for display (e.g. "XXXX1234").
  String get maskedAccountNumber {
    if (accountNumber == null || accountNumber!.length < 4) {
      return accountNumber ?? '';
    }
    final lastFour = accountNumber!.substring(accountNumber!.length - 4);
    return 'XXXX$lastFour';
  }

  /// Creates a [BankDetails] from a Supabase JSON row (snake_case keys).
  factory BankDetails.fromJson(Map<String, dynamic> json) {
    return BankDetails(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      accountHolderName: json['account_holder_name'] as String?,
      accountNumber: json['account_number'] as String?,
      ifscCode: json['ifsc_code'] as String?,
      bankName: json['bank_name'] as String?,
      upiId: json['upi_id'] as String?,
      preferredMethod: (json['preferred_method'] as String?) ?? 'neft',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this bank details record to a Supabase-compatible JSON map
  /// (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'account_holder_name': accountHolderName,
      'account_number': accountNumber,
      'ifsc_code': ifscCode,
      'bank_name': bankName,
      'upi_id': upiId,
      'preferred_method': preferredMethod,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Returns a JSON map suitable for upserting bank details (excludes id,
  /// timestamps which are managed by the database).
  Map<String, dynamic> toUpsertJson() {
    return {
      'user_id': userId,
      'account_holder_name': accountHolderName,
      'account_number': accountNumber,
      'ifsc_code': ifscCode?.toUpperCase(),
      'bank_name': bankName,
      'upi_id': upiId,
      'preferred_method': preferredMethod,
    };
  }

  /// Creates a copy with the given fields replaced.
  BankDetails copyWith({
    String? id,
    String? userId,
    String? accountHolderName,
    String? accountNumber,
    String? ifscCode,
    String? bankName,
    String? upiId,
    String? preferredMethod,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BankDetails(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      accountHolderName: accountHolderName ?? this.accountHolderName,
      accountNumber: accountNumber ?? this.accountNumber,
      ifscCode: ifscCode ?? this.ifscCode,
      bankName: bankName ?? this.bankName,
      upiId: upiId ?? this.upiId,
      preferredMethod: preferredMethod ?? this.preferredMethod,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BankDetails &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'BankDetails(id: $id, bank: $bankName, method: $preferredMethod)';
}
