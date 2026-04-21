/// Model representing an expense from the 'expenses' Supabase table.
///
/// Tracks individual expense entries including amount, category, vendor,
/// receipt information, and approval status.
class Expense {
  final String id;
  final String userId;
  final DateTime date;
  final String? time;
  final String? vendor;
  final String? description;
  final double amount;
  final String category;
  final String? subcategory;
  final String? receiptUrl;
  final String paymentMode; // cash, bank_transfer, upi
  final String? voucherStatus;
  final String? visitType; // project, service, survey
  final String billAttached; // yes, no
  final String? advanceId;
  final String? projectId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Expense({
    required this.id,
    required this.userId,
    required this.date,
    this.time,
    this.vendor,
    this.description,
    required this.amount,
    required this.category,
    this.subcategory,
    this.receiptUrl,
    this.paymentMode = 'cash',
    this.voucherStatus,
    this.visitType,
    this.billAttached = 'yes',
    this.advanceId,
    this.projectId,
    this.createdAt,
    this.updatedAt,
  });

  /// Formats the amount with the Indian Rupee symbol (e.g. "Rs.1,250.00").
  String get formattedAmount {
    // Format with Indian grouping: 1,23,456.78
    final parts = amount.toStringAsFixed(2).split('.');
    final wholePart = parts[0];
    final decimalPart = parts[1];

    if (wholePart.length <= 3) {
      return '\u20B9$wholePart.$decimalPart';
    }

    // Indian number system: last 3 digits, then groups of 2
    final lastThree = wholePart.substring(wholePart.length - 3);
    final remaining = wholePart.substring(0, wholePart.length - 3);

    final buffer = StringBuffer();
    for (int i = remaining.length - 1, count = 0; i >= 0; i--, count++) {
      if (count > 0 && count % 2 == 0) {
        buffer.write(',');
      }
      buffer.write(remaining[remaining.length - 1 - (remaining.length - 1 - i)]);
    }

    // Rebuild remaining with commas (written backwards above, so reverse approach)
    String formattedRemaining = '';
    for (int i = 0; i < remaining.length; i++) {
      final posFromEnd = remaining.length - 1 - i;
      if (posFromEnd > 0 && posFromEnd % 2 == 0) {
        formattedRemaining += '${remaining[i]},';
      } else {
        formattedRemaining += remaining[i];
      }
    }

    return '\u20B9$formattedRemaining,$lastThree.$decimalPart';
  }

  /// Whether this expense has a receipt/bill attached.
  bool get hasBill => billAttached == 'yes';

  /// Whether this expense is linked to an advance.
  bool get isLinkedToAdvance => advanceId != null && advanceId!.isNotEmpty;

  /// Whether this expense has been submitted in a voucher.
  bool get isSubmitted =>
      voucherStatus != null && voucherStatus!.isNotEmpty && voucherStatus != 'none';

  /// Creates an [Expense] from a Supabase JSON row (snake_case keys).
  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      date: DateTime.parse(json['date'] as String),
      time: json['time'] as String?,
      vendor: json['vendor'] as String?,
      description: json['description'] as String?,
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      category: (json['category'] as String?) ?? 'other',
      // subcategory is parsed client-side from the category string, not a DB column
      // receiptUrl: not a column in the expenses table (images are in expense_images)
      paymentMode: (json['payment_mode'] as String?) ?? 'cash',
      voucherStatus: json['voucher_status'] as String?,
      visitType: json['visit_type'] as String?,
      billAttached: (json['bill_attached'] as String?) ?? 'yes',
      advanceId: json['advance_id'] as String?,
      projectId: json['project_id'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this expense to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'date': date.toIso8601String().split('T').first, // Date only (YYYY-MM-DD)
      'time': time,
      'vendor': vendor,
      'description': description,
      'amount': amount,
      'category': category,
      // subcategory and receipt_url are not columns in the expenses table
      'payment_mode': paymentMode,
      'voucher_status': voucherStatus,
      'visit_type': visitType,
      'bill_attached': billAttached,
      'advance_id': advanceId,
      'project_id': projectId,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Returns a JSON map suitable for inserting a new expense (excludes id,
  /// createdAt, updatedAt which are set by the database).
  Map<String, dynamic> toInsertJson() {
    return {
      'user_id': userId,
      'date': date.toIso8601String().split('T').first,
      'time': time,
      'category': category,
      'amount': amount,
      'vendor': vendor ?? 'N/A',
      'description': description ?? 'N/A',
      'visit_type': visitType,
      'payment_mode': paymentMode,
      'bill_attached': billAttached,
      if (advanceId != null) 'advance_id': advanceId,
      if (projectId != null) 'project_id': projectId,
    };
  }

  /// Creates a copy with the given fields replaced.
  Expense copyWith({
    String? id,
    String? userId,
    DateTime? date,
    String? time,
    String? vendor,
    String? description,
    double? amount,
    String? category,
    String? subcategory,
    String? receiptUrl,
    String? paymentMode,
    String? voucherStatus,
    String? visitType,
    String? billAttached,
    String? advanceId,
    String? projectId,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Expense(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      date: date ?? this.date,
      time: time ?? this.time,
      vendor: vendor ?? this.vendor,
      description: description ?? this.description,
      amount: amount ?? this.amount,
      category: category ?? this.category,
      subcategory: subcategory ?? this.subcategory,
      receiptUrl: receiptUrl ?? this.receiptUrl,
      paymentMode: paymentMode ?? this.paymentMode,
      voucherStatus: voucherStatus ?? this.voucherStatus,
      visitType: visitType ?? this.visitType,
      billAttached: billAttached ?? this.billAttached,
      advanceId: advanceId ?? this.advanceId,
      projectId: projectId ?? this.projectId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Expense && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Expense(id: $id, category: $category, amount: $amount, date: $date)';
}
