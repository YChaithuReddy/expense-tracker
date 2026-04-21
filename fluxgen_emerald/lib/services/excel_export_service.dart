import 'dart:io';

import 'package:excel/excel.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

/// Service for exporting expense data to Excel (.xlsx) files.
///
/// Uses the `excel` package to create workbooks with formatted headers
/// and one row per expense entry.
class ExcelExportService {
  ExcelExportService();

  /// Exports a list of expense maps to an Excel workbook and saves it
  /// to the app's temporary directory.
  ///
  /// Each map is expected to have Supabase snake_case keys:
  /// `date`, `category`, `vendor`, `description`, `amount`,
  /// `payment_mode`, `visit_type`, `bill_attached`.
  ///
  /// Returns the absolute file path of the saved `.xlsx` file.
  Future<String> exportToExcel(List<Map<String, dynamic>> expenses) async {
    final excel = Excel.createExcel();

    // Remove default "Sheet1" and create "Expenses"
    excel.rename('Sheet1', 'Expenses');
    final sheet = excel['Expenses'];

    // ── Header row ───────────────────────────────────────────────────────
    final headers = [
      'Date',
      'Category',
      'Vendor',
      'Description',
      'Amount',
      'Payment Mode',
      'Visit Type',
      'Bill Attached',
    ];

    final headerStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#006699'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      horizontalAlign: HorizontalAlign.Center,
    );

    for (int col = 0; col < headers.length; col++) {
      final cell = sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: col, rowIndex: 0),
      );
      cell.value = TextCellValue(headers[col]);
      cell.cellStyle = headerStyle;
    }

    // ── Data rows ────────────────────────────────────────────────────────
    final dateFormat = DateFormat('dd MMM yyyy');

    for (int i = 0; i < expenses.length; i++) {
      final e = expenses[i];
      final rowIndex = i + 1;

      // Date
      String dateStr = '';
      if (e['date'] != null) {
        try {
          final parsed = DateTime.parse(e['date'] as String);
          dateStr = dateFormat.format(parsed);
        } catch (_) {
          dateStr = e['date']?.toString() ?? '';
        }
      }

      // Amount
      final amount = (e['amount'] is num)
          ? (e['amount'] as num).toDouble()
          : double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0;

      final rowData = <CellValue>[
        TextCellValue(dateStr),
        TextCellValue((e['category'] as String?) ?? ''),
        TextCellValue((e['vendor'] as String?) ?? ''),
        TextCellValue((e['description'] as String?) ?? ''),
        DoubleCellValue(amount),
        TextCellValue((e['payment_mode'] as String?) ?? ''),
        TextCellValue((e['visit_type'] as String?) ?? ''),
        TextCellValue((e['bill_attached'] as String?) ?? ''),
      ];

      for (int col = 0; col < rowData.length; col++) {
        sheet
            .cell(
              CellIndex.indexByColumnRow(columnIndex: col, rowIndex: rowIndex),
            )
            .value = rowData[col];
      }
    }

    // ── Set column widths for readability ─────────────────────────────────
    sheet.setColumnWidth(0, 16); // Date
    sheet.setColumnWidth(1, 18); // Category
    sheet.setColumnWidth(2, 22); // Vendor
    sheet.setColumnWidth(3, 30); // Description
    sheet.setColumnWidth(4, 14); // Amount
    sheet.setColumnWidth(5, 16); // Payment Mode
    sheet.setColumnWidth(6, 14); // Visit Type
    sheet.setColumnWidth(7, 14); // Bill Attached

    // ── Save to temp directory ────────────────────────────────────────────
    final dir = await getTemporaryDirectory();
    final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final filePath = '${dir.path}/expenses_$timestamp.xlsx';
    final fileBytes = excel.encode();

    if (fileBytes == null) {
      throw Exception('Failed to encode Excel workbook');
    }

    final file = File(filePath);
    await file.writeAsBytes(fileBytes);

    return filePath;
  }
}
