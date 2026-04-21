/// User profile from the `profiles` table in Supabase.
class Profile {
  const Profile({
    required this.id,
    required this.email,
    this.name,
    this.employeeId,
    this.designation,
    this.department,
    this.role = 'employee',
    this.organizationId,
    this.profilePicture,
    this.monthlyBudget = 0,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String email;
  final String? name;
  final String? employeeId;
  final String? designation;
  final String? department;
  final String role;
  final String? organizationId;
  final String? profilePicture;
  final double monthlyBudget;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Convenience getter — true when the profile belongs to a company org.
  bool get isCompanyMode => organizationId != null;

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      name: json['name'] as String?,
      employeeId: json['employee_id'] as String?,
      designation: json['designation'] as String?,
      department: json['department'] as String?,
      role: json['role'] as String? ?? 'employee',
      organizationId: json['organization_id'] as String?,
      profilePicture: json['profile_picture'] as String?,
      monthlyBudget:
          (json['monthly_budget'] as num?)?.toDouble() ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'employee_id': employeeId,
      'designation': designation,
      'department': department,
      'role': role,
      'organization_id': organizationId,
      'profile_picture': profilePicture,
      'monthly_budget': monthlyBudget,
    };
  }

  Profile copyWith({
    String? name,
    String? employeeId,
    String? designation,
    String? department,
    String? role,
    String? organizationId,
    String? profilePicture,
    double? monthlyBudget,
  }) {
    return Profile(
      id: id,
      email: email,
      name: name ?? this.name,
      employeeId: employeeId ?? this.employeeId,
      designation: designation ?? this.designation,
      department: department ?? this.department,
      role: role ?? this.role,
      organizationId: organizationId ?? this.organizationId,
      profilePicture: profilePicture ?? this.profilePicture,
      monthlyBudget: monthlyBudget ?? this.monthlyBudget,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  @override
  String toString() => 'Profile(id: $id, name: $name, role: $role)';
}
