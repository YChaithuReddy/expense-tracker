/// Attendance status enum. `apiValue` is the exact string sent to /
/// received from the Apps Script — must match the website's dropdown
/// options in `mobile.html:525-532`.
enum AttendanceStatus {
  onSite,
  inOffice,
  workFromHome,
  onLeave,
  holiday,
  weekend,
  unknown;

  String get apiValue => switch (this) {
        AttendanceStatus.onSite       => 'On Site',
        AttendanceStatus.inOffice     => 'In Office',
        AttendanceStatus.workFromHome => 'Work From Home',
        AttendanceStatus.onLeave      => 'On Leave',
        AttendanceStatus.holiday      => 'Holiday',
        AttendanceStatus.weekend      => 'Weekend',
        AttendanceStatus.unknown      => '',
      };

  String get label => switch (this) {
        AttendanceStatus.onSite       => 'On Site',
        AttendanceStatus.inOffice     => 'In Office',
        AttendanceStatus.workFromHome => 'WFH',
        AttendanceStatus.onLeave      => 'Leave',
        AttendanceStatus.holiday      => 'Holiday',
        AttendanceStatus.weekend      => 'Weekend',
        AttendanceStatus.unknown      => 'Unknown',
      };

  static AttendanceStatus fromApiValue(String v) => switch (v.trim()) {
        'On Site'        => AttendanceStatus.onSite,
        'In Office'      => AttendanceStatus.inOffice,
        'Work From Home' => AttendanceStatus.workFromHome,
        'WFH'            => AttendanceStatus.workFromHome,
        'On Leave'       => AttendanceStatus.onLeave,
        'Leave'          => AttendanceStatus.onLeave,
        'Holiday'        => AttendanceStatus.holiday,
        'Weekend'        => AttendanceStatus.weekend,
        _                => AttendanceStatus.unknown,
      };
}

/// One employee from the Fluxgen `Employees` sheet.
class FluxgenEmployee {
  const FluxgenEmployee({
    required this.id,
    required this.name,
    required this.role,
  });
  final String id;
  final String name;
  final String role;

  factory FluxgenEmployee.fromJson(Map<String, dynamic> json) => FluxgenEmployee(
        id:   (json['id']   as String?) ?? '',
        name: (json['name'] as String?) ?? '',
        role: (json['role'] as String?) ?? '',
      );

  @override
  bool operator ==(Object other) =>
      other is FluxgenEmployee && id == other.id;
  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'FluxgenEmployee(id: $id, name: $name, role: $role)';
}

/// One row in the Fluxgen `StatusUpdates` sheet. All fields other than
/// [empId], [empName], [date], [status] are optional.
class StatusEntry {
  const StatusEntry({
    required this.empId,
    required this.empName,
    required this.date,
    required this.status,
    this.siteName          = '',
    this.workType          = '',
    this.scopeOfWork       = '',
    this.role              = '',
    this.workDone          = '',
    this.completionPct     = '0',
    this.workRemarks       = '',
    this.nextVisitRequired = 'No',
    this.nextVisitDate     = '',
  });
  final String empId;
  final String empName;
  final String date; // YYYY-MM-DD
  final AttendanceStatus status;
  final String siteName;
  final String workType;
  final String scopeOfWork;
  final String role;
  final String workDone;
  final String completionPct;
  final String workRemarks;
  final String nextVisitRequired;
  final String nextVisitDate;

  factory StatusEntry.fromJson(Map<String, dynamic> json) => StatusEntry(
        empId:            (json['empId']            as String?) ?? '',
        empName:          (json['empName']          as String?) ?? '',
        date:             (json['date']             as String?) ?? '',
        status:           AttendanceStatus.fromApiValue(
                            (json['status'] as String?) ?? ''),
        siteName:         (json['siteName']         as String?) ?? '',
        workType:         (json['workType']         as String?) ?? '',
        scopeOfWork:      (json['scopeOfWork']      as String?) ?? '',
        role:             (json['role']             as String?) ?? '',
        workDone:         (json['workDone']         as String?) ?? '',
        completionPct:    (json['completionPct']    as String?) ?? '0',
        workRemarks:      (json['workRemarks']      as String?) ?? '',
        nextVisitRequired:(json['nextVisitRequired'] as String?) ?? 'No',
        nextVisitDate:    (json['nextVisitDate']    as String?) ?? '',
      );

  @override
  bool operator ==(Object other) =>
      other is StatusEntry && empId == other.empId && date == other.date;
  @override
  int get hashCode => Object.hash(empId, date);

  @override
  String toString() =>
      'StatusEntry($empId, $date, ${status.apiValue}, $siteName)';
}
