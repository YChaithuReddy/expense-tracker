import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/constants/fluxgen_api.dart';
import '../models/fluxgen_status.dart';

/// Thin HTTP wrapper around the Fluxgen Google Apps Script.
///
/// Apps Script latency is typically 2–5s — callers should show shimmer
/// skeletons. Timeouts are conservative (15–20s) to accommodate cold starts.
class FluxgenApiService {
  FluxgenApiService({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  // ── GET ──────────────────────────────────────────────────────────────

  Future<List<FluxgenEmployee>> getEmployees() async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {'action': FluxgenApi.actionGetEmployees},
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    final body = _decodeBody(resp.body);
    final list = (body['employees'] as List?) ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map((e) {
          try {
            final emp = FluxgenEmployee.fromJson(e);
            return emp.id.isEmpty ? null : emp;
          } catch (_) {
            return null;
          }
        })
        .whereType<FluxgenEmployee>()
        .toList();
  }

  Future<List<StatusEntry>> getStatus(String date) async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {
        'action': FluxgenApi.actionGetStatus,
        'date': date,
      },
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    return _parseStatusRows(resp.body);
  }

  Future<List<StatusEntry>> getStatusRange({
    required String from,
    required String to,
    String empId = 'ALL',
  }) async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {
        'action': FluxgenApi.actionGetStatusRange,
        'from': from,
        'to': to,
        'empId': empId,
      },
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 20));
    return _parseStatusRows(resp.body);
  }

  // ── POST ─────────────────────────────────────────────────────────────

  Future<void> submitStatus({
    required String empId,
    required String empName,
    required String role,
    required AttendanceStatus status,
    required String date,
    String siteName    = '',
    String workType    = '',
    String scopeOfWork = '',
  }) async {
    await _postAction(FluxgenApi.actionSubmitStatus, {
      'empId':       empId,
      'empName':     empName,
      'role':        role,
      'status':      status.apiValue,
      'date':        date,
      'siteName':    siteName,
      'workType':    workType,
      'scopeOfWork': scopeOfWork,
    });
  }

  Future<void> updateWorkDone({
    required String empId,
    required String date,
    required String workDone,
    int completionPct = 0,
    String workRemarks = '',
    bool nextVisitRequired = false,
    String nextVisitDate = '',
  }) async {
    await _postAction('updateWorkDone', {
      'empId':             empId,
      'date':              date,
      'workDone':          workDone,
      'completionPct':     completionPct.toString(),
      'workRemarks':       workRemarks,
      'nextVisitRequired': nextVisitRequired ? 'Yes' : 'No',
      'nextVisitDate':     nextVisitDate,
    });
  }

  // ── Employee CRUD ──────────────────────────────────────────────────

  Future<void> addEmployee({
    required String empId,
    required String empName,
    required String role,
  }) async {
    await _postAction('addEmployee', {
      'empId': empId, 'empName': empName, 'role': role,
    });
  }

  Future<void> editEmployee({
    required String empId,
    required String empName,
    required String role,
  }) async {
    await _postAction('editEmployee', {
      'empId': empId, 'empName': empName, 'role': role,
    });
  }

  Future<void> deleteEmployee({required String empId}) async {
    await _postAction('deleteEmployee', {'empId': empId});
  }

  // ── User CRUD ─────────────────────────────────────────────────────

  Future<void> addUser({
    required String username,
    required String password,
    required String role,
    required String displayName,
  }) async {
    await _postAction('addUser', {
      'username': username, 'password': password,
      'role': role, 'displayName': displayName,
    });
  }

  Future<void> deleteUser({required String username}) async {
    await _postAction('deleteUser', {'username': username});
  }

  Future<List<Map<String, dynamic>>> getUsers() async {
    final uri = Uri.parse(FluxgenApi.scriptUrl).replace(
      queryParameters: {'action': 'getUsers'},
    );
    final resp = await _client.get(uri).timeout(const Duration(seconds: 15));
    final body = _decodeBody(resp.body);
    final users = body['users'];
    if (users is Map<String, dynamic>) {
      return users.entries.map((e) {
        final v = e.value as Map<String, dynamic>;
        return <String, dynamic>{'username': e.key, ...v};
      }).toList();
    }
    return [];
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /// DRYs the POST + accept-302 pattern used by all mutating GAS actions.
  Future<void> _postAction(String action, Map<String, String> params) async {
    final body = <String, String>{'action': action, ...params};
    final resp = await _client
        .post(
          Uri.parse(FluxgenApi.scriptUrl),
          headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
          body: body,
        )
        .timeout(const Duration(seconds: 20));
    // GAS always 302-redirects after execution; 2xx/3xx = success.
    if (resp.statusCode < 200 || resp.statusCode >= 400) {
      throw Exception('$action failed: HTTP ${resp.statusCode}');
    }
  }

  Map<String, dynamic> _decodeBody(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      return const {};
    } catch (_) {
      return const {};
    }
  }

  List<StatusEntry> _parseStatusRows(String raw) {
    final body = _decodeBody(raw);
    final list = (body['data'] as List?) ?? const [];
    final out = <StatusEntry>[];
    for (final row in list) {
      if (row is! Map<String, dynamic>) continue;
      try {
        final entry = StatusEntry.fromJson(row);
        if (entry.empId.isNotEmpty) out.add(entry);
      } catch (_) {
        // Skip malformed row — do not throw.
      }
    }
    return out;
  }
}
