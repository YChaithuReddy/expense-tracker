/// Model representing a user profile from the 'profiles' Supabase table.
///
/// Stores user identity, organization membership, and role information.
class UserProfile {
  final String id;
  final String? email;
  final String? name;
  final String? organizationId;
  final String role; // employee, manager, accountant, admin
  final String? employeeId;
  final String? designation;
  final String? department;
  final String? profilePicture;
  final String? googleSheetId;
  final String? managerId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const UserProfile({
    required this.id,
    this.email,
    this.name,
    this.organizationId,
    this.role = 'employee',
    this.employeeId,
    this.designation,
    this.department,
    this.profilePicture,
    this.googleSheetId,
    this.managerId,
    this.createdAt,
    this.updatedAt,
  });

  /// Whether this user has the admin role.
  bool get isAdmin => role == 'admin';

  /// Whether this user has the manager role.
  bool get isManager => role == 'manager';

  /// Whether this user has the accountant role.
  bool get isAccountant => role == 'accountant';

  /// Whether this user belongs to an organization (company mode).
  bool get isCompanyMode => organizationId != null && organizationId!.isNotEmpty;

  /// Display name, falling back to email prefix or 'Unknown'.
  String get displayName {
    if (name != null && name!.isNotEmpty) return name!;
    if (email != null && email!.isNotEmpty) return email!.split('@').first;
    return 'Unknown';
  }

  /// Creates a [UserProfile] from a Supabase JSON row (snake_case keys).
  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String?,
      name: json['name'] as String?,
      organizationId: json['organization_id'] as String?,
      role: (json['role'] as String?) ?? 'employee',
      employeeId: json['employee_id'] as String?,
      designation: json['designation'] as String?,
      department: json['department'] as String?,
      profilePicture: json['profile_picture'] as String?,
      googleSheetId: json['google_sheet_id'] as String?,
      managerId: json['reporting_manager_id'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this profile to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'organization_id': organizationId,
      'role': role,
      'employee_id': employeeId,
      'designation': designation,
      'department': department,
      'profile_picture': profilePicture,
      'google_sheet_id': googleSheetId,
      'reporting_manager_id': managerId,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  UserProfile copyWith({
    String? id,
    String? email,
    String? name,
    String? organizationId,
    String? role,
    String? employeeId,
    String? designation,
    String? department,
    String? profilePicture,
    String? googleSheetId,
    String? managerId,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserProfile(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      organizationId: organizationId ?? this.organizationId,
      role: role ?? this.role,
      employeeId: employeeId ?? this.employeeId,
      designation: designation ?? this.designation,
      department: department ?? this.department,
      profilePicture: profilePicture ?? this.profilePicture,
      googleSheetId: googleSheetId ?? this.googleSheetId,
      managerId: managerId ?? this.managerId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserProfile &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'UserProfile(id: $id, name: $name, role: $role)';
}
