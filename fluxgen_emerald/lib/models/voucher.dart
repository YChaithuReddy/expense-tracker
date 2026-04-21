import 'package:emerald/models/user_profile.dart';

/// Model representing a voucher from the 'vouchers' Supabase table.
///
/// Vouchers bundle multiple expenses into a single approval request.
/// They flow through a multi-stage approval workflow:
/// pending_manager -> manager_approved/pending_accountant -> approved -> reimbursed.
class Voucher {
  final String id;
  final String organizationId;
  final String submittedBy;
  final String voucherNumber;
  final String status; // pending_manager, manager_approved, pending_accountant, approved, rejected, reimbursed
  final String? managerId;
  final String? accountantId;
  final double totalAmount;
  final int expenseCount;
  final String? purpose;
  final String? notes;
  final String? advanceId;
  final String? projectId;
  final String? googleSheetUrl;
  final String? pdfUrl;
  final String? pdfFilename;
  final DateTime? submittedAt;
  final DateTime? managerActionAt;
  final DateTime? accountantActionAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Nested relations (from joins)
  final UserProfile? submitter;
  final UserProfile? manager;
  final UserProfile? accountant;

  const Voucher({
    required this.id,
    required this.organizationId,
    required this.submittedBy,
    required this.voucherNumber,
    this.status = 'pending_manager',
    this.managerId,
    this.accountantId,
    this.totalAmount = 0.0,
    this.expenseCount = 0,
    this.purpose,
    this.notes,
    this.advanceId,
    this.projectId,
    this.googleSheetUrl,
    this.pdfUrl,
    this.pdfFilename,
    this.submittedAt,
    this.managerActionAt,
    this.accountantActionAt,
    this.createdAt,
    this.updatedAt,
    this.submitter,
    this.manager,
    this.accountant,
  });

  /// Whether the voucher is awaiting manager approval.
  bool get isPendingManager => status == 'pending_manager';

  /// Whether the manager has approved and it's awaiting accountant.
  bool get isPendingAccountant =>
      status == 'manager_approved' || status == 'pending_accountant';

  /// Whether the voucher has been fully approved.
  bool get isApproved => status == 'approved';

  /// Whether the voucher was rejected at any stage.
  bool get isRejected => status == 'rejected';

  /// Whether the voucher has been reimbursed.
  bool get isReimbursed => status == 'reimbursed';

  /// Whether the voucher is still in an active approval flow.
  bool get isInProgress =>
      isPendingManager || isPendingAccountant;

  /// Formatted total amount with Rupee symbol.
  String get formattedAmount => '\u20B9${totalAmount.toStringAsFixed(2)}';

  /// Human-readable status label.
  String get statusLabel {
    switch (status) {
      case 'pending_manager':
        return 'Pending Manager';
      case 'manager_approved':
        return 'Manager Approved';
      case 'pending_accountant':
        return 'Pending Accountant';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'reimbursed':
        return 'Reimbursed';
      default:
        return status;
    }
  }

  /// Creates a [Voucher] from a Supabase JSON row (snake_case keys).
  ///
  /// Supports optional nested relations: submitter, manager, accountant
  /// from Supabase foreign key joins.
  factory Voucher.fromJson(Map<String, dynamic> json) {
    return Voucher(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      submittedBy: json['submitted_by'] as String,
      voucherNumber: (json['voucher_number'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'pending_manager',
      managerId: json['manager_id'] as String?,
      accountantId: json['accountant_id'] as String?,
      totalAmount: (json['total_amount'] is num)
          ? (json['total_amount'] as num).toDouble()
          : double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0,
      expenseCount: (json['expense_count'] is num)
          ? (json['expense_count'] as num).toInt()
          : int.tryParse(json['expense_count']?.toString() ?? '0') ?? 0,
      purpose: json['purpose'] as String?,
      notes: json['notes'] as String?,
      advanceId: json['advance_id'] as String?,
      projectId: json['project_id'] as String?,
      googleSheetUrl: json['google_sheet_url'] as String?,
      pdfUrl: json['pdf_url'] as String?,
      pdfFilename: json['pdf_filename'] as String?,
      submittedAt: json['submitted_at'] != null
          ? DateTime.parse(json['submitted_at'] as String)
          : null,
      managerActionAt: json['manager_action_at'] != null
          ? DateTime.parse(json['manager_action_at'] as String)
          : null,
      accountantActionAt: json['accountant_action_at'] != null
          ? DateTime.parse(json['accountant_action_at'] as String)
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
      manager: json['manager'] != null && json['manager'] is Map<String, dynamic>
          ? UserProfile.fromJson(json['manager'] as Map<String, dynamic>)
          : null,
      accountant: json['accountant'] != null && json['accountant'] is Map<String, dynamic>
          ? UserProfile.fromJson(json['accountant'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Converts this voucher to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organization_id': organizationId,
      'submitted_by': submittedBy,
      'voucher_number': voucherNumber,
      'status': status,
      'manager_id': managerId,
      'accountant_id': accountantId,
      'total_amount': totalAmount,
      'expense_count': expenseCount,
      'purpose': purpose,
      'notes': notes,
      'advance_id': advanceId,
      'project_id': projectId,
      'google_sheet_url': googleSheetUrl,
      'pdf_url': pdfUrl,
      'pdf_filename': pdfFilename,
      if (submittedAt != null) 'submitted_at': submittedAt!.toIso8601String(),
      if (managerActionAt != null)
        'manager_action_at': managerActionAt!.toIso8601String(),
      if (accountantActionAt != null)
        'accountant_action_at': accountantActionAt!.toIso8601String(),
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  Voucher copyWith({
    String? id,
    String? organizationId,
    String? submittedBy,
    String? voucherNumber,
    String? status,
    String? managerId,
    String? accountantId,
    double? totalAmount,
    int? expenseCount,
    String? purpose,
    String? notes,
    String? advanceId,
    String? projectId,
    String? googleSheetUrl,
    String? pdfUrl,
    String? pdfFilename,
    DateTime? submittedAt,
    DateTime? managerActionAt,
    DateTime? accountantActionAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    UserProfile? submitter,
    UserProfile? manager,
    UserProfile? accountant,
  }) {
    return Voucher(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      submittedBy: submittedBy ?? this.submittedBy,
      voucherNumber: voucherNumber ?? this.voucherNumber,
      status: status ?? this.status,
      managerId: managerId ?? this.managerId,
      accountantId: accountantId ?? this.accountantId,
      totalAmount: totalAmount ?? this.totalAmount,
      expenseCount: expenseCount ?? this.expenseCount,
      purpose: purpose ?? this.purpose,
      notes: notes ?? this.notes,
      advanceId: advanceId ?? this.advanceId,
      projectId: projectId ?? this.projectId,
      googleSheetUrl: googleSheetUrl ?? this.googleSheetUrl,
      pdfUrl: pdfUrl ?? this.pdfUrl,
      pdfFilename: pdfFilename ?? this.pdfFilename,
      submittedAt: submittedAt ?? this.submittedAt,
      managerActionAt: managerActionAt ?? this.managerActionAt,
      accountantActionAt: accountantActionAt ?? this.accountantActionAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      submitter: submitter ?? this.submitter,
      manager: manager ?? this.manager,
      accountant: accountant ?? this.accountant,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Voucher && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Voucher(id: $id, number: $voucherNumber, status: $status, amount: $totalAmount)';
}
