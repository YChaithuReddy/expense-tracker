/// Model representing a notification from the 'notifications' Supabase table.
///
/// Notifications are created for events like voucher approvals, advance
/// submissions, and other workflow actions.
class NotificationItem {
  final String id;
  final String userId;
  final String type; // voucher_submitted, voucher_approved, voucher_rejected, etc.
  final String title;
  final String? message;
  final bool read;
  final String? organizationId;
  final String? referenceId;
  final String? referenceType; // advance, voucher
  final DateTime? createdAt;

  const NotificationItem({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    this.message,
    this.read = false,
    this.organizationId,
    this.referenceId,
    this.referenceType,
    this.createdAt,
  });

  /// Whether this notification has not been read yet.
  bool get isUnread => !read;

  /// Whether this notification relates to a voucher event.
  bool get isVoucherNotification => type.startsWith('voucher_');

  /// Whether this notification relates to an advance event.
  bool get isAdvanceNotification => type.startsWith('advance_');

  /// All known notification types.
  static const List<String> knownTypes = [
    'voucher_submitted',
    'voucher_approved',
    'voucher_rejected',
    'voucher_reimbursed',
    'voucher_resubmitted',
    'advance_submitted',
    'advance_approved',
    'advance_rejected',
    'advance_resubmitted',
    'expense_added',
    'employee_joined',
    'project_created',
    'system',
  ];

  /// Creates a [NotificationItem] from a Supabase JSON row (snake_case keys).
  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      type: (json['type'] as String?) ?? 'system',
      title: (json['title'] as String?) ?? '',
      message: json['message'] as String?,
      read: (json['is_read'] as bool?) ?? false,
      organizationId: json['organization_id'] as String?,
      referenceId: json['reference_id'] as String?,
      referenceType: json['reference_type'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  /// Converts this notification to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'type': type,
      'title': title,
      'message': message,
      'is_read': read,
      'organization_id': organizationId,
      'reference_id': referenceId,
      'reference_type': referenceType,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  NotificationItem copyWith({
    String? id,
    String? userId,
    String? type,
    String? title,
    String? message,
    bool? read,
    String? organizationId,
    String? referenceId,
    String? referenceType,
    DateTime? createdAt,
  }) {
    return NotificationItem(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      read: read ?? this.read,
      organizationId: organizationId ?? this.organizationId,
      referenceId: referenceId ?? this.referenceId,
      referenceType: referenceType ?? this.referenceType,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is NotificationItem &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'NotificationItem(id: $id, type: $type, title: $title, read: $read)';
}
