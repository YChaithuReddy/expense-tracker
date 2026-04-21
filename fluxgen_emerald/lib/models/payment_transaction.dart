/// Model representing a payment transaction from the 'payment_transactions'
/// Supabase table.
///
/// Tracks actual payments made for advances or voucher reimbursements,
/// including the payment method, reference number, and completion status.
class PaymentTransaction {
  final String id;
  final String? voucherId;
  final String? advanceId;
  final double amount;
  final String? paymentMethod; // manual, neft, upi, imps
  final String? paymentReference;
  final String status; // pending, completed, failed
  final String? userId;
  final String? organizationId;
  final String? initiatedBy;
  final String? notes;
  final DateTime? completedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const PaymentTransaction({
    required this.id,
    this.voucherId,
    this.advanceId,
    required this.amount,
    this.paymentMethod,
    this.paymentReference,
    this.status = 'pending',
    this.userId,
    this.organizationId,
    this.initiatedBy,
    this.notes,
    this.completedAt,
    this.createdAt,
    this.updatedAt,
  });

  /// Whether this payment is still pending.
  bool get isPending => status == 'pending';

  /// Whether this payment has been completed successfully.
  bool get isCompleted => status == 'completed';

  /// Whether this payment failed.
  bool get isFailed => status == 'failed';

  /// Formatted amount with Rupee symbol.
  String get formattedAmount => '\u20B9${amount.toStringAsFixed(2)}';

  /// Human-readable status label.
  String get statusLabel {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  /// Human-readable payment method label.
  String get methodLabel {
    switch (paymentMethod) {
      case 'neft':
        return 'NEFT';
      case 'upi':
        return 'UPI';
      case 'imps':
        return 'IMPS';
      case 'manual':
        return 'Manual';
      default:
        return paymentMethod ?? 'Unknown';
    }
  }

  /// Creates a [PaymentTransaction] from a Supabase JSON row (snake_case keys).
  factory PaymentTransaction.fromJson(Map<String, dynamic> json) {
    return PaymentTransaction(
      id: json['id'] as String,
      // voucher_id is not a column in payment_transactions — stored in notes
      advanceId: json['advance_id'] as String?,
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      paymentMethod: json['payment_method'] as String?,
      paymentReference: json['payment_reference'] as String?,
      status: (json['status'] as String?) ?? 'pending',
      userId: json['user_id'] as String?,
      organizationId: json['organization_id'] as String?,
      initiatedBy: json['initiated_by'] as String?,
      notes: json['notes'] as String?,
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this transaction to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      // voucher_id is not a column in payment_transactions
      'advance_id': advanceId,
      'amount': amount,
      'payment_method': paymentMethod,
      'payment_reference': paymentReference,
      'status': status,
      'user_id': userId,
      'organization_id': organizationId,
      'initiated_by': initiatedBy,
      'notes': notes,
      if (completedAt != null) 'completed_at': completedAt!.toIso8601String(),
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  PaymentTransaction copyWith({
    String? id,
    String? voucherId,
    String? advanceId,
    double? amount,
    String? paymentMethod,
    String? paymentReference,
    String? status,
    String? userId,
    String? organizationId,
    String? initiatedBy,
    String? notes,
    DateTime? completedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return PaymentTransaction(
      id: id ?? this.id,
      voucherId: voucherId ?? this.voucherId,
      advanceId: advanceId ?? this.advanceId,
      amount: amount ?? this.amount,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentReference: paymentReference ?? this.paymentReference,
      status: status ?? this.status,
      userId: userId ?? this.userId,
      organizationId: organizationId ?? this.organizationId,
      initiatedBy: initiatedBy ?? this.initiatedBy,
      notes: notes ?? this.notes,
      completedAt: completedAt ?? this.completedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PaymentTransaction &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'PaymentTransaction(id: $id, amount: $amount, status: $status, method: $paymentMethod)';
}
