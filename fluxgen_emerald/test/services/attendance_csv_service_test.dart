import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/services/attendance_csv_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final entries = [
    StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
        status: AttendanceStatus.onSite, workType: 'Project',
        siteName: 'BLR', scopeOfWork: 'HVAC'),
    StatusEntry(empId: 'E2', empName: 'Bob', date: '2026-04-14',
        status: AttendanceStatus.inOffice, workType: 'Service'),
  ];

  test('employeeDailyCsv has correct headers', () {
    final csv = AttendanceCsvService.employeeDailyCsv(entries);
    final firstLine = csv.split('\n').first;
    expect(firstLine, contains('Employee ID'));
    expect(firstLine, contains('Efficiency'));
  });

  test('employeeDailyCsv has correct row count', () {
    final csv = AttendanceCsvService.employeeDailyCsv(entries);
    final lines = csv.split('\n').where((l) => l.trim().isNotEmpty).toList();
    expect(lines.length, 3); // header + 2 rows
  });

  test('siteCsv filters by site', () {
    final csv = AttendanceCsvService.siteCsv(entries, 'BLR');
    final lines = csv.split('\n').where((l) => l.trim().isNotEmpty).toList();
    expect(lines.length, 2); // header + 1 match
  });

  test('efficiencyCsv includes summary section', () {
    final csv = AttendanceCsvService.efficiencyCsv(entries);
    expect(csv, contains('Deploy'));
    expect(csv, contains('Alice'));
  });

  test('escapes fields with commas', () {
    final tricky = [
      StatusEntry(empId: 'E1', empName: 'Alice, Jr.', date: '2026-04-14',
          status: AttendanceStatus.onSite, workType: 'Project'),
    ];
    final csv = AttendanceCsvService.employeeDailyCsv(tricky);
    expect(csv, contains('"Alice, Jr."'));
  });
}
