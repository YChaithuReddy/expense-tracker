import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

/// Google Sheets export service.
///
/// Provides methods to:
/// - Open the user's linked Google Sheet in a browser
/// - Fetch the sheet URL from the user's profile
/// - Export expenses to the sheet via the Apps Script web app endpoint
///
/// The export payload format matches the web app's fetchAppsScript pattern:
///   GET `?data={JSON-encoded payload}`
/// where payload = `{ "action": "exportExpenses", "sheetId": "...", "expenses": [...] }`
class GoogleSheetsService {
  GoogleSheetsService._();

  static const String _appsScriptUrl =
      'https://script.google.com/macros/s/AKfycbwwqK0sMKm6L4dYo7QQTXVyOHzhGLZEZLaMGVpbO3hjgJX9DDPexc-SFdEYn2JOg4UCfg/exec';

  /// Opens the user's Google Sheet in a browser.
  ///
  /// Fetches the sheet ID from the user's profile and launches the URL.
  /// Throws if no sheet is linked or the URL cannot be launched.
  static Future<void> openGoogleSheet(String sheetUrl) async {
    final uri = Uri.parse(sheetUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      throw Exception('Could not open Google Sheet');
    }
  }

  /// Fetches the Google Sheet URL for the current user.
  ///
  /// Looks up the `google_sheet_id` field in the `profiles` table.
  /// Returns `null` if no sheet is linked.
  static Future<String?> getSheetUrl() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return null;

    try {
      final data = await Supabase.instance.client
          .from('profiles')
          .select('google_sheet_id')
          .eq('id', userId)
          .maybeSingle();

      if (data == null) return null;

      final sheetId = data['google_sheet_id'] as String?;
      if (sheetId == null || sheetId.isEmpty) return null;

      return 'https://docs.google.com/spreadsheets/d/$sheetId';
    } catch (e) {
      debugPrint('GoogleSheetsService.getSheetUrl error: $e');
      return null;
    }
  }

  /// Calls the Apps Script endpoint matching the web app's fetchAppsScript pattern.
  ///
  /// For small payloads (< 1800 chars), uses GET with `?data=<JSON>`.
  /// For larger payloads, uses POST with form-encoded `data` field.
  /// Apps Script redirects (302) on success, so we follow redirects.
  static Future<Map<String, dynamic>> _fetchAppsScript(
      Map<String, dynamic> payload) async {
    final jsonPayload = jsonEncode(payload);

    if (jsonPayload.length < 1800) {
      return _fetchViaGet(jsonPayload);
    }
    return _fetchViaPost(jsonPayload);
  }

  /// Follows redirects manually (Google Apps Script 302 → actual response).
  static Future<http.Response> _followRedirects(http.Request request) async {
    final client = http.Client();
    try {
      var currentRequest = request;
      for (int i = 0; i < 5; i++) {
        currentRequest.followRedirects = false;
        final streamed = await client.send(currentRequest).timeout(const Duration(seconds: 60));
        final response = await http.Response.fromStream(streamed);

        if (response.statusCode >= 300 && response.statusCode < 400) {
          final location = response.headers['location'];
          if (location == null) return response;
          final newUri = location.startsWith('http') ? Uri.parse(location) : currentRequest.url.resolve(location);
          currentRequest = http.Request('GET', newUri);
          continue;
        }
        return response;
      }
      throw Exception('Too many redirects');
    } finally {
      client.close();
    }
  }

  /// Parse response body — handles both JSON and HTML (Apps Script redirects).
  static Map<String, dynamic> _parseResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 400) {
      try {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        // Apps Script sometimes returns HTML after redirect — treat as success
        // if status was 2xx/3xx (the script executed)
        debugPrint('GoogleSheets response (${response.statusCode}): ${response.body.substring(0, response.body.length.clamp(0, 200))}');
        return {'status': 'success', 'data': {}};
      }
    }
    throw Exception('Google Sheets API error: ${response.statusCode}');
  }

  /// GET request with data as URL parameter (matches web's _fetchViaGet).
  static Future<Map<String, dynamic>> _fetchViaGet(String jsonPayload) async {
    try {
      final uri = Uri.parse(_appsScriptUrl).replace(
        queryParameters: {'data': jsonPayload},
      );
      final request = http.Request('GET', uri);
      final response = await _followRedirects(request);
      return _parseResponse(response);
    } catch (e) {
      if (e.toString().contains('TimeoutException')) {
        throw Exception('Google Sheets request timed out (60s). Please try again.');
      }
      rethrow;
    }
  }

  /// POST request with form-encoded data (matches web's _fetchViaPost).
  static Future<Map<String, dynamic>> _fetchViaPost(String jsonPayload) async {
    try {
      // For POST, use regular http.post which follows redirects
      final uri = Uri.parse(_appsScriptUrl);
      final response = await http.post(uri, body: {'data': jsonPayload}).timeout(const Duration(seconds: 60));
      return _parseResponse(response);
    } catch (e) {
      if (e.toString().contains('TimeoutException')) {
        throw Exception('Google Sheets request timed out (60s). Please try again.');
      }
      rethrow;
    }
  }

  /// Exports expenses to the user's Google Sheet via the Apps Script endpoint.
  ///
  /// Sends expense data using the same payload format as the web app:
  /// ```json
  /// {
  ///   "action": "exportExpenses",
  ///   "sheetId": "...",
  ///   "expenses": [{"date":"...", "vendor":"...", "category":"...", "amount":0, ...}]
  /// }
  /// ```
  static Future<Map<String, dynamic>> exportToSheet(
    List<Map<String, dynamic>> expenses,
  ) async {
    final sheetUrl = await getSheetUrl();
    if (sheetUrl == null) {
      throw Exception('No Google Sheet linked. Please configure in settings.');
    }

    // Extract sheet ID from the URL
    final sheetId = sheetUrl.split('/d/').last.split('/').first;

    // Format expenses to match the web app's format
    final formattedExpenses = expenses.map((exp) {
      final paymentMode = exp['paymentMode'] as String? ??
          exp['payment_mode'] as String? ??
          '';
      String formattedPaymentMode;
      switch (paymentMode) {
        case 'bank_transfer':
          formattedPaymentMode = 'Bank Transfer';
          break;
        case 'upi':
          formattedPaymentMode = 'UPI';
          break;
        default:
          formattedPaymentMode = 'Cash';
      }

      return {
        'date': exp['date'] ?? '',
        'vendor': exp['vendor'] ?? 'N/A',
        'category': exp['category'] ?? '',
        'amount': (exp['amount'] is num)
            ? (exp['amount'] as num).toDouble()
            : double.tryParse(exp['amount']?.toString() ?? '0') ?? 0,
        'description': exp['description'] ?? '',
        'visitType': exp['visitType'] ?? exp['visit_type'] ?? '',
        'paymentMode': formattedPaymentMode,
        'billAttached':
            (exp['billAttached'] ?? exp['bill_attached']) == 'no'
                ? 'No'
                : 'Yes',
        // New fields for updated Fluxgen sheet format
        'modeOfExpense': exp['mode_of_expense'] ?? '',
        'fromLocation': exp['from_location'] ?? '',
        'toLocation': exp['to_location'] ?? '',
        'kilometers': exp['kilometers'] ?? 0,
      };
    }).toList();

    // Sort chronologically (oldest first) like the web app
    formattedExpenses.sort((a, b) =>
        (a['date'] as String).compareTo(b['date'] as String));

    final payload = {
      'action': 'exportExpenses',
      'sheetId': sheetId,
      'expenses': formattedExpenses,
    };

    final result = await _fetchAppsScript(payload);

    if (result['status'] != 'success') {
      throw Exception(
          result['message'] as String? ?? 'Export failed');
    }

    return result;
  }

  /// Resets the Google Sheet to master template format.
  /// Clears all data rows but preserves the template structure.
  static Future<Map<String, dynamic>> resetSheet() async {
    final sheetUrl = await getSheetUrl();
    if (sheetUrl == null) {
      throw Exception('No Google Sheet linked.');
    }
    final sheetId = sheetUrl.split('/d/').last.split('/').first;

    final result = await _fetchAppsScript({
      'action': 'resetSheet',
      'sheetId': sheetId,
    });

    return result;
  }

  /// Syncs project-level sheets (Log, By Project, Individual tabs) — fire-and-forget.
  /// Matches web's parallel calls: addToLogSheet + addToProjectSheets + addToIndividualProjectTabs.
  static Future<void> syncProjectSheets(
    String sheetId,
    List<Map<String, dynamic>> expenses,
  ) async {
    final formatted = expenses.map((exp) {
      final paymentMode = exp['payment_mode'] as String? ?? 'cash';
      return {
        'date': exp['date'] ?? '',
        'vendor': exp['vendor'] ?? 'N/A',
        'category': exp['category'] ?? '',
        'amount': (exp['amount'] is num) ? (exp['amount'] as num).toDouble() : 0.0,
        'description': exp['description'] ?? '',
        'visitType': exp['visit_type'] ?? '',
        'paymentMode': paymentMode == 'bank_transfer' ? 'Bank Transfer' : paymentMode == 'upi' ? 'UPI' : 'Cash',
        'billAttached': exp['bill_attached'] == 'no' ? 'No' : 'Yes',
        'modeOfExpense': exp['mode_of_expense'] ?? '',
        'fromLocation': exp['from_location'] ?? '',
        'toLocation': exp['to_location'] ?? '',
        'kilometers': exp['kilometers'] ?? 0,
      };
    }).toList();

    // Fire all 3 in parallel (non-blocking)
    await Future.wait([
      _fetchAppsScript({'action': 'addToLogSheet', 'sheetId': sheetId, 'expenses': formatted}).catchError((_) => <String, dynamic>{}),
      _fetchAppsScript({'action': 'addToProjectSheets', 'sheetId': sheetId, 'expenses': formatted}).catchError((_) => <String, dynamic>{}),
      _fetchAppsScript({'action': 'addToIndividualProjectTabs', 'sheetId': sheetId, 'expenses': formatted}).catchError((_) => <String, dynamic>{}),
    ]);
  }
}
