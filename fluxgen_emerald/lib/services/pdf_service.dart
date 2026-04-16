import 'dart:io';

import 'package:flutter/material.dart' show DateTimeRange;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:supabase_flutter/supabase_flutter.dart';

/// Result from [PdfService.generateReimbursementPacket].
class ReimbursementPacketResult {
  final Uint8List bytes;
  final String filename;

  const ReimbursementPacketResult({
    required this.bytes,
    required this.filename,
  });
}

/// Service for generating professional reimbursement PDF documents.
///
/// Creates formatted PDFs with company header, employee info table,
/// expense line items, totals, and page numbers.
class PdfService {
  PdfService();

  /// Brand colour used for headers and accents.
  static const _primary = PdfColor.fromInt(0xFF006699);
  static const _headerBg = PdfColor.fromInt(0xFFF3F4F6);

  /// Generates a reimbursement claim PDF and saves it to the app's
  /// temporary directory.
  ///
  /// [employeeName] — full name of the claimant.
  /// [employeeId] — employee/staff ID.
  /// [period] — human-readable period string (e.g. "March 2026").
  /// [expenses] — list of Supabase expense maps (snake_case keys).
  ///
  /// Returns the absolute file path of the saved `.pdf` file.
  Future<String> generateReimbursementPdf({
    required String employeeName,
    required String employeeId,
    required String period,
    required List<Map<String, dynamic>> expenses,
  }) async {
    final pdf = pw.Document(
      title: 'Reimbursement Claim',
      author: employeeName,
      creator: 'FluxGen Expense Tracker',
    );

    final dateFormat = DateFormat('dd MMM yyyy');

    // Pre-compute total
    double grandTotal = 0;
    for (final e in expenses) {
      final amt = (e['amount'] is num)
          ? (e['amount'] as num).toDouble()
          : double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0;
      grandTotal += amt;
    }

    // Build table rows (split across pages if needed)
    final tableHeaders = ['#', 'Date', 'Category', 'Vendor', 'Description', 'Amount'];

    final tableData = <List<String>>[];
    for (int i = 0; i < expenses.length; i++) {
      final e = expenses[i];

      String dateStr = '';
      if (e['date'] != null) {
        try {
          dateStr = dateFormat.format(DateTime.parse(e['date'] as String));
        } catch (_) {
          dateStr = e['date']?.toString() ?? '';
        }
      }

      final amount = (e['amount'] is num)
          ? (e['amount'] as num).toDouble()
          : double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0;

      tableData.add([
        '${i + 1}',
        dateStr,
        (e['category'] as String?) ?? '',
        (e['vendor'] as String?) ?? '',
        (e['description'] as String?) ?? '',
        amount.toStringAsFixed(2),
      ]);
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        header: (context) => _buildHeader(employeeName, employeeId, period),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          pw.SizedBox(height: 20),

          // ── Expense Table ──────────────────────────────────────────
          pw.TableHelper.fromTextArray(
            context: context,
            headers: tableHeaders,
            data: tableData,
            border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
            headerStyle: pw.TextStyle(
              fontWeight: pw.FontWeight.bold,
              fontSize: 9,
              color: PdfColors.white,
            ),
            headerDecoration: const pw.BoxDecoration(color: _primary),
            headerAlignment: pw.Alignment.center,
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellPadding: const pw.EdgeInsets.symmetric(
              horizontal: 6,
              vertical: 5,
            ),
            cellAlignments: {
              0: pw.Alignment.center,       // #
              1: pw.Alignment.center,       // Date
              2: pw.Alignment.centerLeft,   // Category
              3: pw.Alignment.centerLeft,   // Vendor
              4: pw.Alignment.centerLeft,   // Description
              5: pw.Alignment.centerRight,  // Amount
            },
            columnWidths: {
              0: const pw.FixedColumnWidth(28),
              1: const pw.FixedColumnWidth(72),
              2: const pw.FixedColumnWidth(80),
              3: const pw.FixedColumnWidth(90),
              4: const pw.FlexColumnWidth(),
              5: const pw.FixedColumnWidth(70),
            },
          ),

          pw.SizedBox(height: 12),

          // ── Total Row ──────────────────────────────────────────────
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: pw.BoxDecoration(
              color: _headerBg,
              border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
              borderRadius: pw.BorderRadius.circular(4),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'Total Amount (${expenses.length} expenses)',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
                pw.Text(
                  'Rs. ${grandTotal.toStringAsFixed(2)}',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 13,
                    color: _primary,
                  ),
                ),
              ],
            ),
          ),

          pw.SizedBox(height: 40),

          // ── Signature area ─────────────────────────────────────────
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _signatureBlock('Employee Signature'),
              _signatureBlock('Manager Approval'),
              _signatureBlock('Accounts'),
            ],
          ),
        ],
      ),
    );

    // ── Save to temp directory ─────────────────────────────────────────
    final dir = await getTemporaryDirectory();
    final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final filePath = '${dir.path}/reimbursement_$timestamp.pdf';
    final file = File(filePath);
    await file.writeAsBytes(await pdf.save());

    return filePath;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  NEW: Full reimbursement packet (cover + index + receipt pages)
  // ═══════════════════════════════════════════════════════════════════════

  /// Generates a complete reimbursement packet PDF with:
  /// - **Cover page**: employee name, ID, department, period, total, count, timestamp
  /// - **Index table**: SL No | Date | Vendor | Category | Amount (₹)
  /// - **Per-expense receipt pages**: embedded receipt image with header
  /// - **Footer**: page X of Y, watermark
  ///
  /// [expenses] — raw Supabase rows (snake_case keys). Each may include a
  /// nested `expense_images` list from the junction table.
  ///
  /// [employeeInfo] — map with keys: `name`, `employee_id`, `department`,
  /// `designation`, `email`.
  ///
  /// [period] — optional date range. If null, derived from expense dates.
  ///
  /// Returns [ReimbursementPacketResult] with PDF bytes and a suggested filename.
  Future<ReimbursementPacketResult> generateReimbursementPacket({
    required List<Map<String, dynamic>> expenses,
    required Map<String, dynamic> employeeInfo,
    DateTimeRange? period,
  }) async {
    final dateFormat = DateFormat('dd MMM yyyy');
    final timestampFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final now = DateTime.now();

    // ── Derive period from expenses if not provided ─────────────────────
    DateTime? periodStart = period?.start;
    DateTime? periodEnd = period?.end;
    if (periodStart == null || periodEnd == null) {
      for (final e in expenses) {
        final d = DateTime.tryParse(e['date']?.toString() ?? '');
        if (d != null) {
          periodStart ??= d;
          periodEnd ??= d;
          if (d.isBefore(periodStart)) periodStart = d;
          if (d.isAfter(periodEnd)) periodEnd = d;
        }
      }
    }
    final periodStr = (periodStart != null && periodEnd != null)
        ? '${dateFormat.format(periodStart)} — ${dateFormat.format(periodEnd)}'
        : 'All Expenses';

    // ── Compute totals ──────────────────────────────────────────────────
    double grandTotal = 0;
    for (final e in expenses) {
      grandTotal += _parseAmount(e['amount']);
    }

    final empName = (employeeInfo['name'] as String?) ?? 'Employee';
    final empId = (employeeInfo['employee_id'] as String?) ?? '';
    final empDept = (employeeInfo['department'] as String?) ?? '';
    final empDesignation = (employeeInfo['designation'] as String?) ?? '';

    // ── Fetch receipt images concurrently ────────────────────────────────
    final receiptImages = await _fetchAllReceiptImages(expenses);

    // ── Build the PDF ───────────────────────────────────────────────────
    final pdf = pw.Document(
      title: 'Reimbursement Packet',
      author: empName,
      creator: 'FluxGen Expense Tracker',
    );

    // ── PAGE 1: Cover ───────────────────────────────────────────────────
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(50),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.SizedBox(height: 60),

            // Company name
            pw.Text(
              'FluxGen Technologies',
              style: pw.TextStyle(
                fontSize: 28,
                fontWeight: pw.FontWeight.bold,
                color: _primary,
              ),
            ),
            pw.Divider(color: _primary, thickness: 3),
            pw.SizedBox(height: 8),
            pw.Text(
              'REIMBURSEMENT CLAIM PACKET',
              style: pw.TextStyle(
                fontSize: 14,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.grey600,
                letterSpacing: 2,
              ),
            ),
            pw.SizedBox(height: 40),

            // Employee info card
            pw.Container(
              padding: const pw.EdgeInsets.all(20),
              decoration: pw.BoxDecoration(
                color: _headerBg,
                borderRadius: pw.BorderRadius.circular(8),
                border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'EMPLOYEE DETAILS',
                    style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.grey500,
                      letterSpacing: 1.5,
                    ),
                  ),
                  pw.SizedBox(height: 12),
                  _coverInfoRow('Name', empName),
                  if (empId.isNotEmpty) _coverInfoRow('Employee ID', empId),
                  if (empDept.isNotEmpty) _coverInfoRow('Department', empDept),
                  if (empDesignation.isNotEmpty)
                    _coverInfoRow('Designation', empDesignation),
                ],
              ),
            ),
            pw.SizedBox(height: 24),

            // Claim summary card
            pw.Container(
              padding: const pw.EdgeInsets.all(20),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFFEFF6FF),
                borderRadius: pw.BorderRadius.circular(8),
                border: pw.Border.all(color: _primary, width: 0.5),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'CLAIM SUMMARY',
                    style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: _primary,
                      letterSpacing: 1.5,
                    ),
                  ),
                  pw.SizedBox(height: 12),
                  _coverInfoRow('Period', periodStr),
                  _coverInfoRow(
                      'Expense Count', '${expenses.length} expenses'),
                  _coverInfoRow(
                    'Total Amount',
                    'Rs. ${grandTotal.toStringAsFixed(2)}',
                    valueBold: true,
                    valueColor: _primary,
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 24),

            // Generated timestamp
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(
                  horizontal: 16, vertical: 10),
              decoration: pw.BoxDecoration(
                borderRadius: pw.BorderRadius.circular(6),
                border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'Generated',
                    style: const pw.TextStyle(
                        fontSize: 9, color: PdfColors.grey500),
                  ),
                  pw.Text(
                    timestampFormat.format(now),
                    style: pw.TextStyle(
                        fontSize: 10, fontWeight: pw.FontWeight.bold),
                  ),
                ],
              ),
            ),

            pw.Spacer(),

            // Watermark at bottom
            pw.Center(
              child: pw.Text(
                'FluxGen Expense Tracker',
                style: const pw.TextStyle(
                  fontSize: 10,
                  color: PdfColors.grey400,
                ),
              ),
            ),
          ],
        ),
      ),
    );

    // ── PAGE 2+: Index Table ─────────────────────────────────────────────
    final tableHeaders = ['SL No', 'Date', 'Vendor', 'Category', 'Amount'];
    final tableData = <List<String>>[];
    for (int i = 0; i < expenses.length; i++) {
      final e = expenses[i];
      String dateStr = '';
      if (e['date'] != null) {
        try {
          dateStr = dateFormat.format(DateTime.parse(e['date'] as String));
        } catch (_) {
          dateStr = e['date']?.toString() ?? '';
        }
      }
      final amount = _parseAmount(e['amount']);
      tableData.add([
        '${i + 1}',
        dateStr,
        (e['vendor'] as String?) ?? 'N/A',
        (e['category'] as String?) ?? '',
        'Rs. ${amount.toStringAsFixed(2)}',
      ]);
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        header: (context) => _packetPageHeader('Expense Index'),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            context: context,
            headers: tableHeaders,
            data: tableData,
            border:
                pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
            headerStyle: pw.TextStyle(
              fontWeight: pw.FontWeight.bold,
              fontSize: 9,
              color: PdfColors.white,
            ),
            headerDecoration: const pw.BoxDecoration(color: _primary),
            headerAlignment: pw.Alignment.center,
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellPadding: const pw.EdgeInsets.symmetric(
                horizontal: 6, vertical: 5),
            cellAlignments: {
              0: pw.Alignment.center, // SL No
              1: pw.Alignment.center, // Date
              2: pw.Alignment.centerLeft, // Vendor
              3: pw.Alignment.centerLeft, // Category
              4: pw.Alignment.centerRight, // Amount
            },
            columnWidths: {
              0: const pw.FixedColumnWidth(36),
              1: const pw.FixedColumnWidth(80),
              2: const pw.FlexColumnWidth(2),
              3: const pw.FlexColumnWidth(1.5),
              4: const pw.FixedColumnWidth(85),
            },
          ),
          pw.SizedBox(height: 16),

          // Grand total row
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
            decoration: pw.BoxDecoration(
              color: _headerBg,
              border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
              borderRadius: pw.BorderRadius.circular(4),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'Grand Total (${expenses.length} expenses)',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
                pw.Text(
                  'Rs. ${grandTotal.toStringAsFixed(2)}',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 13,
                    color: _primary,
                  ),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 40),

          // Signature area
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _signatureBlock('Employee Signature'),
              _signatureBlock('Manager Approval'),
              _signatureBlock('Accounts'),
            ],
          ),
        ],
      ),
    );

    // ── PER-EXPENSE RECEIPT PAGES ────────────────────────────────────────
    for (int i = 0; i < expenses.length; i++) {
      final e = expenses[i];
      final imageBytes = receiptImages[e['id'] as String?];
      final amount = _parseAmount(e['amount']);

      String dateStr = '';
      if (e['date'] != null) {
        try {
          dateStr = dateFormat.format(DateTime.parse(e['date'] as String));
        } catch (_) {
          dateStr = e['date']?.toString() ?? '';
        }
      }

      final receiptHeader =
          '#${i + 1}  |  ${(e['vendor'] as String?) ?? 'N/A'}  |  $dateStr  |  Rs. ${amount.toStringAsFixed(2)}';

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(30),
          build: (context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Receipt header bar
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: const pw.BoxDecoration(color: _primary),
                  child: pw.Text(
                    receiptHeader,
                    style: pw.TextStyle(
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.white,
                    ),
                  ),
                ),
                pw.SizedBox(height: 4),

                // Description / category line
                if ((e['description'] as String?)?.isNotEmpty == true ||
                    (e['category'] as String?)?.isNotEmpty == true)
                  pw.Container(
                    width: double.infinity,
                    padding: const pw.EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    color: _headerBg,
                    child: pw.Text(
                      [
                        if ((e['category'] as String?)?.isNotEmpty == true)
                          e['category'] as String,
                        if ((e['description'] as String?)?.isNotEmpty ==
                            true)
                          e['description'] as String,
                      ].join('  —  '),
                      style: const pw.TextStyle(
                          fontSize: 8, color: PdfColors.grey600),
                    ),
                  ),
                pw.SizedBox(height: 8),

                // Receipt image or placeholder
                pw.Expanded(
                  child: imageBytes != null
                      ? pw.Center(
                          child: pw.Image(
                            pw.MemoryImage(imageBytes),
                            fit: pw.BoxFit.contain,
                          ),
                        )
                      : pw.Center(
                          child: pw.Container(
                            padding: const pw.EdgeInsets.all(40),
                            decoration: pw.BoxDecoration(
                              borderRadius: pw.BorderRadius.circular(8),
                              border: pw.Border.all(
                                  color: PdfColors.grey300, width: 1),
                            ),
                            child: pw.Column(
                              mainAxisSize: pw.MainAxisSize.min,
                              children: [
                                pw.Text(
                                  'No receipt attached',
                                  style: pw.TextStyle(
                                    fontSize: 14,
                                    fontWeight: pw.FontWeight.bold,
                                    color: PdfColors.grey400,
                                  ),
                                ),
                                pw.SizedBox(height: 4),
                                pw.Text(
                                  'Expense #${i + 1} — ${(e['vendor'] as String?) ?? 'N/A'}',
                                  style: const pw.TextStyle(
                                    fontSize: 10,
                                    color: PdfColors.grey400,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                ),
                pw.SizedBox(height: 8),

                // Footer line
                pw.Container(
                  padding: const pw.EdgeInsets.only(top: 8),
                  decoration: const pw.BoxDecoration(
                    border: pw.Border(
                        top: pw.BorderSide(color: PdfColors.grey300)),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        'FluxGen Expense Tracker',
                        style: const pw.TextStyle(
                            fontSize: 8, color: PdfColors.grey500),
                      ),
                      pw.Text(
                        'Receipt ${i + 1} of ${expenses.length}',
                        style: const pw.TextStyle(
                            fontSize: 8, color: PdfColors.grey500),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      );
    }

    // ── Save and return ─────────────────────────────────────────────────
    final pdfBytes = Uint8List.fromList(await pdf.save());
    final yyyymm =
        '${now.year}${now.month.toString().padLeft(2, '0')}';
    final totalRounded = grandTotal.round();
    final filename =
        'Reimbursement_${yyyymm}_${totalRounded}INR_${expenses.length}bills.pdf';

    return ReimbursementPacketResult(bytes: pdfBytes, filename: filename);
  }

  // ── Receipt image fetching ──────────────────────────────────────────────

  /// Fetches receipt images for all expenses in parallel.
  ///
  /// Returns a map of expense ID → image bytes. Expenses without images are
  /// not included in the map.
  Future<Map<String, Uint8List>> _fetchAllReceiptImages(
      List<Map<String, dynamic>> expenses) async {
    final Map<String, Uint8List> result = {};

    // Collect expense IDs that have images
    final futures = <Future<MapEntry<String, Uint8List>?>>[];

    for (final e in expenses) {
      final expenseId = e['id'] as String?;
      if (expenseId == null) continue;

      // Check if expense_images are already nested in the expense row
      final images = e['expense_images'];
      String? imageUrl;

      if (images is List && images.isNotEmpty) {
        imageUrl = images[0]['public_url'] as String?;
      }

      if (imageUrl == null || imageUrl.isEmpty) {
        // Try fetching from the expense_images table
        futures.add(_fetchReceiptImage(expenseId));
      } else {
        futures.add(_downloadImage(expenseId, imageUrl));
      }
    }

    final results = await Future.wait(futures);
    for (final entry in results) {
      if (entry != null) {
        result[entry.key] = entry.value;
      }
    }

    return result;
  }

  /// Fetches the first receipt image URL from `expense_images` table and
  /// downloads it.
  Future<MapEntry<String, Uint8List>?> _fetchReceiptImage(
      String expenseId) async {
    try {
      final rows = await Supabase.instance.client
          .from('expense_images')
          .select('public_url')
          .eq('expense_id', expenseId)
          .limit(1);

      if (rows.isNotEmpty) {
        final url = rows[0]['public_url'] as String?;
        if (url != null && url.isNotEmpty) {
          return _downloadImage(expenseId, url);
        }
      }
    } catch (e) {
      debugPrint('Error fetching receipt for $expenseId: $e');
    }
    return null;
  }

  /// Downloads an image from a URL and returns it as a map entry.
  Future<MapEntry<String, Uint8List>?> _downloadImage(
      String expenseId, String url) async {
    try {
      final response = await http.get(Uri.parse(url)).timeout(
        const Duration(seconds: 15),
      );
      if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        return MapEntry(expenseId, response.bodyBytes);
      }
    } catch (e) {
      debugPrint('Error downloading image for $expenseId: $e');
    }
    return null;
  }

  // ── Packet-specific helpers ─────────────────────────────────────────────

  /// Parses an amount from a dynamic value (num or String).
  static double _parseAmount(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '0') ?? 0.0;
  }

  /// Cover page info row helper.
  static pw.Widget _coverInfoRow(
    String label,
    String value, {
    bool valueBold = false,
    PdfColor? valueColor,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 6),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 100,
            child: pw.Text(
              label,
              style: const pw.TextStyle(
                  fontSize: 9, color: PdfColors.grey500),
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              value,
              style: pw.TextStyle(
                fontSize: 10,
                fontWeight:
                    valueBold ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: valueColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Packet page header (used on index and receipt pages).
  static pw.Widget _packetPageHeader(String title) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'FluxGen Technologies',
              style: pw.TextStyle(
                fontSize: 16,
                fontWeight: pw.FontWeight.bold,
                color: _primary,
              ),
            ),
            pw.Text(
              title.toUpperCase(),
              style: pw.TextStyle(
                fontSize: 11,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.grey600,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
        pw.Divider(color: _primary, thickness: 1.5),
      ],
    );
  }

  /// Builds the page header with company name and employee info.
  static pw.Widget _buildHeader(
    String employeeName,
    String employeeId,
    String period,
  ) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        // Company title
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'FluxGen Technologies',
              style: pw.TextStyle(
                fontSize: 18,
                fontWeight: pw.FontWeight.bold,
                color: _primary,
              ),
            ),
            pw.Text(
              'REIMBURSEMENT CLAIM',
              style: pw.TextStyle(
                fontSize: 12,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.grey600,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
        pw.Divider(color: _primary, thickness: 2),
        pw.SizedBox(height: 8),

        // Employee info
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(
            color: _headerBg,
            borderRadius: pw.BorderRadius.circular(4),
          ),
          child: pw.Row(
            children: [
              _infoItem('Employee', employeeName),
              pw.SizedBox(width: 40),
              _infoItem('ID', employeeId),
              pw.SizedBox(width: 40),
              _infoItem('Period', period),
              pw.SizedBox(width: 40),
              _infoItem(
                'Generated',
                DateFormat('dd MMM yyyy').format(DateTime.now()),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Builds the page footer with page numbers and generation timestamp.
  static pw.Widget _buildFooter(pw.Context context) {
    return pw.Container(
      padding: const pw.EdgeInsets.only(top: 8),
      decoration: const pw.BoxDecoration(
        border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300)),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            'Generated by FluxGen Expense Tracker',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey500),
          ),
          pw.Text(
            'Page ${context.pageNumber} of ${context.pagesCount}',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey500),
          ),
        ],
      ),
    );
  }

  /// Helper: a labelled info pair for the header.
  static pw.Widget _infoItem(String label, String value) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          label,
          style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey500),
        ),
        pw.SizedBox(height: 2),
        pw.Text(
          value,
          style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
        ),
      ],
    );
  }

  /// Helper: signature line block.
  static pw.Widget _signatureBlock(String label) {
    return pw.Column(
      children: [
        pw.Container(
          width: 130,
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              bottom: pw.BorderSide(color: PdfColors.grey400),
            ),
          ),
          child: pw.SizedBox(height: 40),
        ),
        pw.SizedBox(height: 4),
        pw.Text(
          label,
          style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey500),
        ),
      ],
    );
  }
}
