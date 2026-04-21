import 'package:emerald/models/user_profile.dart';

/// Model representing an advance from the 'advances' Supabase table.
///
/// Advances are upfront cash/funds given to employees for project expenses.
/// They go through an approval workflow and are eventually reconciled
/// against submitted expense vouchers.
class Advance {
  final String id;
  final String userId;
  final String projectName;
  final double amount;
  final String? notes;
  final String status; // pending_manager, pending_accountant, active, rejected, closed
  final String? managerId;
  final String? accountantId;
  final String? visitType; // project, service, survey
  final String? organizationId;
  final String? paymentStatus;
  final DateTime? submittedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Nested relations (from joins)
  final UserProfile? submitter;

  // Computed fields (from client-side calculation)
  final double? totalSpent;
  final double? remaining;
  final double? percentUsed;

  const Advance({
    required this.id,
    required this.userId,
    required this.projectName,
    required this.amount,
    this.notes,
    this.status = 'active',
    this.managerId,
    this.accountantId,
    this.visitType,
    this.organizationId,
    this.paymentStatus,
    this.submittedAt,
    this.createdAt,
    this.updatedAt,
    this.submitter,
    this.totalSpent,
    this.remaining,
    this.percentUsed,
  });

  /// Whether the advance is awaiting approval.
  bool get isPending =>
      status == 'pending_manager' || status == 'pending_accountant';

  /// Whether the advance is active and funds are available.
  bool get isActive => status == 'active';

  /// Whether the advance was rejected.
  bool get isRejected => status == 'rejected';

  /// Whether the advance has been fully reconciled and closed.
  bool get isClosed => status == 'closed';

  /// Formatted amount with Rupee symbol.
  String get formattedAmount => '\u20B9${amount.toStringAsFixed(2)}';

  /// Formatted remaining balance, or null if not computed.
  String? get formattedRemaining =>
      remaining != null ? '\u20B9${remaining!.toStringAsFixed(2)}' : null;

  /// Creates an [Advance] from a Supabase JSON row (snake_case keys).
  ///
  /// Supports optional nested `submitter` from a join on `user_id`.
  factory Advance.fromJson(Map<String, dynamic> json) {
    return Advance(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      projectName: (json['project_name'] as String?) ?? '',
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      notes: json['notes'] as String?,
      status: (json['status'] as String?) ?? 'active',
      managerId: json['manager_id'] as String?,
      accountantId: json['accountant_id'] as String?,
      visitType: json['visit_type'] as String?,
      organizationId: json['organization_id'] as String?,
      paymentStatus: json['payment_status'] as String?,
      submittedAt: json['submitted_at'] != null
          ? DateTime.parse(json['submitted_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
      submitter: json['submitter'] != null && json['submitter'] is Map<String, dynamic>
          ? UserProfile.fromJson(json['submitter'] as Map<String, dynamic>)
          : null,
      // Computed fields from client-side balance calculation
      totalSpent: json['totalSpent'] != null
          ? (json['totalSpent'] as num).toDouble()
          : null,
      remaining: json['remaining'] != null
          ? (json['remaining'] as num).toDouble()
          : null,
      percentUsed: json['percentUsed'] != null
          ? (json['percentUsed'] as num).toDouble()
          : null,
    );
  }

  /// Converts this advance to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'project_name': projectName,
      'amount': amount,
      'notes': notes,
      'status': status,
      'manager_id': managerId,
      'accountant_id': accountantId,
      'visit_type': visitType,
      'organization_id': organizationId,
      'payment_status': paymentStatus,
      if (submittedAt != null) 'submitted_at': submittedAt!.toIso8601String(),
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Returns a JSON map suitable for inserting a new advance.
  Map<String, dynamic> toInsertJson() {
    return {
      'user_id': userId,
      'project_name': projectName,
      'amount': amount,
      'notes': notes,
      'visit_type': visitType ?? 'project',
      if (organizationId != null) 'organization_id': organizationId,
      if (managerId != null) 'manager_id': managerId,
      if (accountantId != null) 'accountant_id': accountantId,
      if (managerId != null) 'status': 'pending_manager',
      if (managerId != null) 'submitted_at': DateTime.now().toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  Advance copyWith({
    String? id,
    String? userId,
    String? projectName,
    double? amount,
    String? notes,
    String? status,
    String? managerId,
    String? accountantId,
    String? visitType,
    String? organizationId,
    String? paymentStatus,
    DateTime? submittedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    UserProfile? submitter,
    double? totalSpent,
    double? remaining,
    double? percentUsed,
  }) {
    return Advance(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      projectName: projectName ?? this.projectName,
      amount: amount ?? this.amount,
      notes: notes ?? this.notes,
      status: status ?? this.status,
      managerId: managerId ?? this.managerId,
      accountantId: accountantId ?? this.accountantId,
      visitType: visitType ?? this.visitType,
      organizationId: organizationId ?? this.organizationId,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      submittedAt: submittedAt ?? this.submittedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      submitter: submitter ?? this.submitter,
      totalSpent: totalSpent ?? this.totalSpent,
      remaining: remaining ?? this.remaining,
      percentUsed: percentUsed ?? this.percentUsed,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Advance && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Advance(id: $id, project: $projectName, amount: $amount, status: $status)';
}
