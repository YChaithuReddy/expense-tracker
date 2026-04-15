import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/services/fluxgen_api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('FluxgenApiService.getEmployees', () {
    test('parses employee list', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","employees":['
            '{"id":"E1","name":"Alice","role":"Engineer"},'
            '{"id":"E2","name":"Bob","role":"Technician"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getEmployees();
      expect(result.length, 2);
      expect(result.first.id, 'E1');
      expect(result.first.name, 'Alice');
      expect(result.last.role, 'Technician');
    });

    test('returns empty list on empty response', () async {
      final client = MockClient(
          (_) async => http.Response('{"status":"success","employees":[]}', 200));
      final svc = FluxgenApiService(client: client);
      expect(await svc.getEmployees(), isEmpty);
    });

    test('skips malformed employee rows', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","employees":['
            '{"id":"E1","name":"Alice","role":"Engineer"},'
            'null,'
            '{"bogus":123}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getEmployees();
      expect(result.length, 1);
      expect(result.first.id, 'E1');
    });
  });

  group('FluxgenApiService.getStatus', () {
    test('parses each AttendanceStatus value', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","data":['
            '{"empId":"E1","empName":"Alice","status":"On Site","date":"2026-04-15","siteName":"BLR","workType":"Project","scopeOfWork":"HVAC","role":"Engineer"},'
            '{"empId":"E2","empName":"Bob","status":"In Office","date":"2026-04-15"},'
            '{"empId":"E3","empName":"Cara","status":"Work From Home","date":"2026-04-15"},'
            '{"empId":"E4","empName":"Dev","status":"On Leave","date":"2026-04-15"},'
            '{"empId":"E5","empName":"Eve","status":"Holiday","date":"2026-04-15"},'
            '{"empId":"E6","empName":"Fay","status":"Weekend","date":"2026-04-15"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getStatus('2026-04-15');
      expect(result.length, 6);
      expect(result[0].status, AttendanceStatus.onSite);
      expect(result[0].siteName, 'BLR');
      expect(result[1].status, AttendanceStatus.inOffice);
      expect(result[2].status, AttendanceStatus.workFromHome);
      expect(result[3].status, AttendanceStatus.onLeave);
      expect(result[4].status, AttendanceStatus.holiday);
      expect(result[5].status, AttendanceStatus.weekend);
    });

    test('unknown status string maps to AttendanceStatus.unknown', () async {
      final client = MockClient((_) async => http.Response(
            '{"status":"success","data":['
            '{"empId":"E1","empName":"Alice","status":"Garbage","date":"2026-04-15"}'
            ']}',
            200,
          ));
      final svc = FluxgenApiService(client: client);
      final result = await svc.getStatus('2026-04-15');
      expect(result.first.status, AttendanceStatus.unknown);
    });

    test('empty data array returns empty list', () async {
      final client = MockClient(
          (_) async => http.Response('{"status":"success","data":[]}', 200));
      final svc = FluxgenApiService(client: client);
      expect(await svc.getStatus('2026-04-15'), isEmpty);
    });
  });

  group('FluxgenApiService.submitStatus', () {
    test('sends form-encoded POST body with all required fields', () async {
      String? capturedBody;
      final client = MockClient((req) async {
        capturedBody = req.body;
        return http.Response('{"status":"success"}', 200);
      });
      final svc = FluxgenApiService(client: client);
      await svc.submitStatus(
        empId: 'E1',
        empName: 'Alice',
        role: 'Engineer',
        status: AttendanceStatus.onSite,
        date: '2026-04-15',
        siteName: 'Bangalore',
        workType: 'Project',
        scopeOfWork: 'HVAC Commissioning',
      );
      expect(capturedBody, contains('empId=E1'));
      expect(capturedBody, contains('status=On+Site'));
      expect(capturedBody, contains('siteName=Bangalore'));
      expect(capturedBody, contains('action=submitStatus'));
    });
  });
}
