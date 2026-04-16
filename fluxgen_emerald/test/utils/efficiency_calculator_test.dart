import 'package:emerald/core/utils/efficiency_calculator.dart';
import 'package:emerald/models/fluxgen_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EfficiencyCalculator.score', () {
    test('On Site + Project = 100', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Project'), 100);
    });
    test('On Site + Service = 90', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Service'), 90);
    });
    test('On Site + Office Work = 85', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onSite, 'Office Work'), 85);
    });
    test('In Office + Project = 80', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.inOffice, 'Project'), 80);
    });
    test('In Office + Service = 75', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.inOffice, 'Service'), 75);
    });
    test('WFH + Project = 70', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.workFromHome, 'Project'), 70);
    });
    test('WFH + Office Work = 60', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.workFromHome, 'Office Work'), 60);
    });
    test('On Leave = 0', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.onLeave, ''), 0);
    });
    test('Holiday = -1 (excluded)', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.holiday, ''), -1);
    });
    test('Weekend = -1 (excluded)', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.weekend, ''), -1);
    });
    test('Unknown default = 50', () {
      expect(EfficiencyCalculator.score(AttendanceStatus.unknown, 'Other'), 50);
    });
  });

  group('EfficiencyCalculator.aggregate', () {
    test('computes per-employee averages', () {
      final entries = [
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
            status: AttendanceStatus.onSite, workType: 'Project'),
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-15',
            status: AttendanceStatus.inOffice, workType: 'Project'),
      ];
      final result = EfficiencyCalculator.aggregate(entries);
      expect(result.employees.length, 1);
      expect(result.employees.first.empName, 'Alice');
      expect(result.employees.first.daysWorked, 2);
      expect(result.employees.first.avgEfficiency, 90); // (100+80)/2
    });

    test('excludes holidays from average', () {
      final entries = [
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-14',
            status: AttendanceStatus.onSite, workType: 'Project'),
        StatusEntry(empId: 'E1', empName: 'Alice', date: '2026-04-15',
            status: AttendanceStatus.holiday),
      ];
      final result = EfficiencyCalculator.aggregate(entries);
      expect(result.employees.first.avgEfficiency, 100); // holiday excluded
      expect(result.employees.first.daysWorked, 1);
    });

    test('empty list returns zero summary', () {
      final result = EfficiencyCalculator.aggregate([]);
      expect(result.employees, isEmpty);
      expect(result.deployRate, 0);
    });
  });
}
