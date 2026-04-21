import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Service for importing CSV data into Supabase tables.
///
/// Supports importing employees (profiles), projects, and expenses
/// from user-selected CSV files. Uses manual CSV parsing to handle
/// quoted fields without extra dependencies.
class CsvImportService {
  CsvImportService();

  final _supabase = Supabase.instance.client;

  // ─── File Picker ──────────────────────────────────────────────────────

  /// Opens the file picker for CSV files and returns the selected file path,
  /// or `null` if the user cancelled.
  Future<String?> pickCsvFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
    );
    return result?.files.single.path;
  }

  // ─── CSV Parsing ──────────────────────────────────────────────────────

  /// Reads a CSV file at [filePath] and returns a list of row maps.
  ///
  /// The first row is treated as the header. Each subsequent row becomes
  /// a `Map<String, String>` keyed by the header column names (trimmed,
  /// lowercased, spaces replaced with underscores).
  ///
  /// Handles quoted fields containing commas and newlines.
  Future<List<Map<String, String>>> parseCsvFile(String filePath) async {
    final file = File(filePath);
    final content = await file.readAsString();
    final rows = _parseCsvContent(content);

    if (rows.isEmpty) return [];

    // First row is header
    final headers = rows.first
        .map((h) => h.trim().toLowerCase().replaceAll(' ', '_'))
        .toList();

    final result = <Map<String, String>>[];

    for (var i = 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.every((cell) => cell.trim().isEmpty)) continue; // skip blank rows

      final map = <String, String>{};
      for (var j = 0; j < headers.length && j < row.length; j++) {
        map[headers[j]] = row[j].trim();
      }
      result.add(map);
    }

    return result;
  }

  /// Parses raw CSV content into a list of rows, where each row is a list
  /// of cell values. Handles quoted fields with embedded commas and newlines.
  List<List<String>> _parseCsvContent(String content) {
    final rows = <List<String>>[];
    var currentRow = <String>[];
    var currentCell = StringBuffer();
    var inQuotes = false;

    for (var i = 0; i < content.length; i++) {
      final char = content[i];

      if (inQuotes) {
        if (char == '"') {
          // Check for escaped quote ("")
          if (i + 1 < content.length && content[i + 1] == '"') {
            currentCell.write('"');
            i++; // skip next quote
          } else {
            inQuotes = false;
          }
        } else {
          currentCell.write(char);
        }
      } else {
        if (char == '"') {
          inQuotes = true;
        } else if (char == ',') {
          currentRow.add(currentCell.toString());
          currentCell = StringBuffer();
        } else if (char == '\n') {
          currentRow.add(currentCell.toString());
          currentCell = StringBuffer();
          if (currentRow.isNotEmpty) {
            rows.add(currentRow);
            currentRow = <String>[];
          }
        } else if (char == '\r') {
          // skip carriage return
        } else {
          currentCell.write(char);
        }
      }
    }

    // Flush remaining
    if (currentCell.isNotEmpty || currentRow.isNotEmpty) {
      currentRow.add(currentCell.toString());
      rows.add(currentRow);
    }

    return rows;
  }

  // ─── Import: Employees ────────────────────────────────────────────────

  /// Imports employee rows into the `profiles` table.
  ///
  /// Expected columns: name, email, employee_id, role, department.
  /// Returns the number of successfully imported rows.
  Future<int> importEmployees(
    List<Map<String, String>> rows,
    String orgId,
  ) async {
    var count = 0;

    for (final row in rows) {
      final name = row['name'] ?? '';
      final email = row['email'] ?? '';
      if (name.isEmpty || email.isEmpty) continue;

      try {
        await _supabase.from('profiles').upsert(
          {
            'name': name,
            'email': email,
            'employee_id': row['employee_id'] ?? '',
            'role': row['role'] ?? 'employee',
            'department': row['department'] ?? '',
            'organization_id': orgId,
          },
          onConflict: 'email',
        );
        count++;
      } catch (e) {
        debugPrint('importEmployees row error: $e');
      }
    }

    return count;
  }

  // ─── Import: Projects ─────────────────────────────────────────────────

  /// Imports project rows into the `projects` table.
  ///
  /// Expected columns: project_code, project_name, client_name, description.
  /// Returns the number of successfully imported rows.
  Future<int> importProjects(
    List<Map<String, String>> rows,
    String orgId,
  ) async {
    var count = 0;

    for (final row in rows) {
      final code = row['project_code'] ?? '';
      final name = row['project_name'] ?? '';
      if (code.isEmpty || name.isEmpty) continue;

      try {
        await _supabase.from('projects').upsert(
          {
            'project_code': code,
            'project_name': name,
            'client_name': row['client_name'] ?? '',
            'description': row['description'] ?? '',
            'organization_id': orgId,
          },
          onConflict: 'project_code',
        );
        count++;
      } catch (e) {
        debugPrint('importProjects row error: $e');
      }
    }

    return count;
  }

  // ─── Import: Expenses ─────────────────────────────────────────────────

  /// Imports expense rows into the `expenses` table.
  ///
  /// Expected columns: date, category, vendor, description, amount, payment_mode.
  /// Returns the number of successfully imported rows.
  Future<int> importExpenses(
    List<Map<String, String>> rows,
    String userId,
  ) async {
    var count = 0;

    for (final row in rows) {
      final amountStr = row['amount'] ?? '0';
      final amount = double.tryParse(amountStr.replaceAll(',', '')) ?? 0;
      if (amount <= 0) continue;

      try {
        await _supabase.from('expenses').insert({
          'user_id': userId,
          'date': row['date'] ?? DateTime.now().toIso8601String().split('T')[0],
          'category': row['category'] ?? 'Other',
          'vendor': row['vendor'] ?? '',
          'description': row['description'] ?? '',
          'amount': amount,
          'payment_mode': row['payment_mode'] ?? 'Cash',
          'visit_type': row['visit_type'] ?? 'project',
          'bill_attached': row['bill_attached'] ?? 'no',
        });
        count++;
      } catch (e) {
        debugPrint('importExpenses row error: $e');
      }
    }

    return count;
  }
}
