/// Model representing an organization from the 'organizations' Supabase table.
///
/// Organizations are the top-level grouping for company mode, containing
/// employees, projects, and approval workflows.
class Organization {
  final String id;
  final String name;
  final String? domain;
  final String? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Organization({
    required this.id,
    required this.name,
    this.domain,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  /// Creates an [Organization] from a Supabase JSON row (snake_case keys).
  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      domain: json['domain'] as String?,
      createdBy: json['created_by'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this organization to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'domain': domain,
      'created_by': createdBy,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  Organization copyWith({
    String? id,
    String? name,
    String? domain,
    String? createdBy,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Organization(
      id: id ?? this.id,
      name: name ?? this.name,
      domain: domain ?? this.domain,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Organization &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'Organization(id: $id, name: $name)';
}
