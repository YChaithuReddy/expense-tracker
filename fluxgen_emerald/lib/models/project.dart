/// Model representing a project from the 'projects' Supabase table.
///
/// Projects are organizational units within a company that expenses and
/// advances can be tagged against. They have budgets, timelines, and statuses.
class Project {
  final String id;
  final String organizationId;
  final String projectCode;
  final String projectName;
  final String? clientName;
  final String? description;
  final String status; // active, completed, on_hold
  final double? budget;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Project({
    required this.id,
    required this.organizationId,
    required this.projectCode,
    required this.projectName,
    this.clientName,
    this.description,
    this.status = 'active',
    this.budget,
    this.startDate,
    this.endDate,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  /// Whether this project is currently active.
  bool get isActive => status == 'active';

  /// Display label combining code and name (e.g. "PRJ-001 - Office Reno").
  String get displayLabel => '$projectCode - $projectName';

  /// Formatted budget with Rupee symbol, or null if no budget set.
  String? get formattedBudget =>
      budget != null ? '\u20B9${budget!.toStringAsFixed(2)}' : null;

  /// Creates a [Project] from a Supabase JSON row (snake_case keys).
  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      projectCode: (json['project_code'] as String?) ?? '',
      projectName: (json['project_name'] as String?) ?? '',
      clientName: json['client_name'] as String?,
      description: json['description'] as String?,
      status: (json['status'] as String?) ?? 'active',
      budget: json['budget'] != null
          ? (json['budget'] is num)
              ? (json['budget'] as num).toDouble()
              : double.tryParse(json['budget'].toString())
          : null,
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'] as String)
          : null,
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      createdBy: json['created_by'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  /// Converts this project to a Supabase-compatible JSON map (snake_case keys).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organization_id': organizationId,
      'project_code': projectCode,
      'project_name': projectName,
      'client_name': clientName,
      'description': description,
      'status': status,
      'budget': budget,
      'start_date': startDate?.toIso8601String().split('T').first,
      'end_date': endDate?.toIso8601String().split('T').first,
      'created_by': createdBy,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Creates a copy with the given fields replaced.
  Project copyWith({
    String? id,
    String? organizationId,
    String? projectCode,
    String? projectName,
    String? clientName,
    String? description,
    String? status,
    double? budget,
    DateTime? startDate,
    DateTime? endDate,
    String? createdBy,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Project(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      projectCode: projectCode ?? this.projectCode,
      projectName: projectName ?? this.projectName,
      clientName: clientName ?? this.clientName,
      description: description ?? this.description,
      status: status ?? this.status,
      budget: budget ?? this.budget,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Project && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Project(id: $id, code: $projectCode, name: $projectName)';
}
