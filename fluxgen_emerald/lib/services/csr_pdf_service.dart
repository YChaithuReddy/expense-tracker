import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/csr_report.dart';

/// Generates a PDF matching the Fluxgen website CSR HTML template.
///
/// Usage:
/// ```dart
/// final bytes = await CsrPdfService.generate(report, logoBytes: logo);
/// // Use `printing` package to preview/share the bytes.
/// ```
class CsrPdfService {
  CsrPdfService._();

  // ── Brand colours ──────────────────────────────────────────────────────
  static const _navy = PdfColor.fromInt(0xFF1A3A5C);
  static const _grey = PdfColor.fromInt(0xFF777777);
  static const _borderColor = PdfColor.fromInt(0xFFDDDDDD);
  static const _black = PdfColor.fromInt(0xFF000000);
  static const _white = PdfColor.fromInt(0xFFFFFFFF);

  // ── Typography ─────────────────────────────────────────────────────────
  static pw.TextStyle get _titleStyle => pw.TextStyle(
        fontSize: 18,
        fontWeight: pw.FontWeight.bold,
        color: _navy,
      );

  static pw.TextStyle get _sectionTitleStyle => pw.TextStyle(
        fontSize: 9,
        fontWeight: pw.FontWeight.bold,
        color: _white,
      );

  static pw.TextStyle get _labelStyle => pw.TextStyle(
        fontSize: 7,
        fontWeight: pw.FontWeight.bold,
        color: _grey,
      );

  static const pw.TextStyle _valueStyle = pw.TextStyle(
    fontSize: 9,
    color: _black,
  );

  static const pw.TextStyle _footerStyle = pw.TextStyle(
    fontSize: 7,
    color: _grey,
  );

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════════════════════════════

  /// Generates a CSR PDF and returns the raw bytes.
  ///
  /// [report] — populated [CsrReport] model.
  /// [logoBytes] — optional Fluxgen logo PNG bytes for the header.
  static Future<Uint8List> generate(
    CsrReport report, {
    Uint8List? logoBytes,
  }) async {
    final pdf = pw.Document(
      title: 'Customer Service Report — ${report.csrNo}',
      author: 'Fluxgen Sustainable Technologies',
      creator: 'FluxGen Emerald',
    );

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => [
          _buildHeader(report, logoBytes),
          pw.SizedBox(height: 14),
          _buildCustomerDetails(report),
          pw.SizedBox(height: 10),
          _buildNatureOfWork(report),
          pw.SizedBox(height: 10),
          _buildWorkDetails(report),
          pw.SizedBox(height: 10),
          _buildServiceTimings(report),
          pw.SizedBox(height: 10),
          _buildRatingSection(report),
          pw.SizedBox(height: 10),
          _buildCustomerFeedback(report),
          pw.SizedBox(height: 18),
          _buildSignatures(report),
          pw.SizedBox(height: 14),
          _buildFooter(),
        ],
      ),
    );

    return pdf.save();
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  1. HEADER
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildHeader(CsrReport report, Uint8List? logoBytes) {
    return pw.Column(
      children: [
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            // Left: Logo + company info
            pw.Expanded(
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  if (logoBytes != null)
                    pw.Padding(
                      padding: const pw.EdgeInsets.only(right: 8),
                      child: pw.Image(
                        pw.MemoryImage(logoBytes),
                        width: 48,
                        height: 48,
                      ),
                    ),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'Fluxgen Sustainable Technologies Private Limited',
                          style: pw.TextStyle(
                            fontSize: 11,
                            fontWeight: pw.FontWeight.bold,
                            color: _navy,
                          ),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          '1st floor, 1064, 18th Main Rd, BTM 2nd Stage, '
                          'Bengaluru, Karnataka 560076',
                          style: const pw.TextStyle(
                            fontSize: 7,
                            color: _grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: 12),
            // Right: Title + meta
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text('CUSTOMER SERVICE REPORT', style: _titleStyle),
                pw.SizedBox(height: 4),
                pw.Text(
                  'CSR NO: ${report.csrNo}',
                  style: pw.TextStyle(
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                    color: _navy,
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  'DATE: ${_formatDate(report.csrDate)}',
                  style: const pw.TextStyle(fontSize: 8, color: _grey),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  'Status of Call By: ${report.callBy}',
                  style: const pw.TextStyle(fontSize: 8, color: _grey),
                ),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 6),
        // Bottom border line
        pw.Container(
          height: 2,
          color: _navy,
        ),
      ],
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  2. CUSTOMER DETAILS
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildCustomerDetails(CsrReport report) {
    return _buildSection('CUSTOMER DETAILS', [
      _fieldRow([_field('Customer Name', report.customerName)]),
      _fieldRow([_field('Address', report.address)]),
      _fieldRow([
        _field('City', report.city),
        _field('State', report.state),
        _field('ZIP Code', report.zip),
      ]),
      _fieldRow([
        _field('Instruction From', report.instructionFrom),
        _field('Inspected By', report.inspectedBy),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  3. NATURE OF WORK
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildNatureOfWork(CsrReport report) {
    return _buildSection('NATURE OF WORK', [
      _fieldRow([_field('Nature of Work', report.natureOfWork)]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  4. WORK DETAILS
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildWorkDetails(CsrReport report) {
    return _buildSection('WORK DETAILS', [
      _fieldRow([_field('Work Performed', report.workDetails)]),
      _fieldRow([
        _field(
          'Defects Found on Inspection',
          report.defects.isEmpty ? 'Nil' : report.defects,
        ),
      ]),
      _fieldRow([
        _field(
          "Engineer's Remarks",
          report.remarks.isEmpty ? 'Nil' : report.remarks,
        ),
      ]),
      _fieldRow([_field('Status after Work', report.statusAfter)]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  5. SERVICE TIMINGS
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildServiceTimings(CsrReport report) {
    return _buildSection('SERVICE TIMINGS', [
      _fieldRow([
        _field('Event Date', _formatDate(report.eventDate)),
        _field('Event Time', _formatTime(report.eventTime)),
        _field('Start of Work', _formatTime(report.startTime)),
        _field('End of Service', _formatTime(report.endTime)),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  6. PLEASE RATE THIS SERVICE
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildRatingSection(CsrReport report) {
    return _buildSection('PLEASE RATE THIS SERVICE', [
      pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
          children: CsrReport.ratingOptions.map((option) {
            final selected = report.rating == option;
            return pw.Row(
              mainAxisSize: pw.MainAxisSize.min,
              children: [
                pw.Container(
                  width: 10,
                  height: 10,
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: _navy, width: 1),
                    borderRadius: pw.BorderRadius.circular(2),
                  ),
                  child: selected
                      ? pw.Center(
                          child: pw.Text(
                            '\u2713',
                            style: pw.TextStyle(
                              fontSize: 7,
                              fontWeight: pw.FontWeight.bold,
                              color: _navy,
                            ),
                          ),
                        )
                      : pw.SizedBox(),
                ),
                pw.SizedBox(width: 3),
                pw.Text(
                  option,
                  style: const pw.TextStyle(fontSize: 8, color: _black),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  7. CUSTOMER FEEDBACK
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildCustomerFeedback(CsrReport report) {
    return _buildSection('CUSTOMER FEEDBACK', [
      _fieldRow([_field('Remarks', report.feedbackRemarks)]),
      _fieldRow([
        _field('Name', report.feedbackName),
        _field('Designation', report.feedbackDesignation),
        _field('Phone', report.feedbackPhone),
      ]),
      _fieldRow([
        _field('Email', report.feedbackEmail),
        _field('Date', _formatDate(report.feedbackDate)),
      ]),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  8. SIGNATURES
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildSignatures(CsrReport report) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.end,
      children: [
        _signatureColumn('Customer Signature', report.customerSignature),
        pw.SizedBox(width: 12),
        _signatureColumn('Engineer Signature', report.engineerSignature),
        pw.SizedBox(width: 12),
        _signatureColumn('Authorized Signatory', report.sealImage),
      ],
    );
  }

  static pw.Widget _signatureColumn(String label, Uint8List? imageBytes) {
    return pw.Expanded(
      child: pw.Column(
        children: [
          // Signature image or empty placeholder box
          pw.Container(
            height: 60,
            alignment: pw.Alignment.center,
            child: imageBytes != null
                ? pw.Image(
                    pw.MemoryImage(imageBytes),
                    height: 56,
                    fit: pw.BoxFit.contain,
                  )
                : pw.Container(
                    height: 56,
                    alignment: pw.Alignment.center,
                    child: label == 'Authorized Signatory'
                        ? pw.Text(
                            'FLUXGEN / AUTHORIZED',
                            style: pw.TextStyle(
                              fontSize: 7,
                              fontWeight: pw.FontWeight.bold,
                              color: _grey,
                            ),
                          )
                        : pw.SizedBox(),
                  ),
          ),
          // Thin top border line
          pw.Container(
            height: 0.5,
            color: _black,
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            label,
            style: const pw.TextStyle(fontSize: 7, color: _grey),
            textAlign: pw.TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  9. FOOTER
  // ═════════════════════════════════════════════════════════════════════════

  static pw.Widget _buildFooter() {
    return pw.Center(
      child: pw.Text(
        'Fluxgen Sustainable Technologies Private Limited  |  '
        'BTM 2nd Stage, Bengaluru 560076  |  www.fluxgen.in',
        style: _footerStyle,
        textAlign: pw.TextAlign.center,
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  /// Builds a full section: navy header bar + field rows.
  static pw.Widget _buildSection(String title, List<pw.Widget> children) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        // Section header bar
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          color: _navy,
          child: pw.Text(title, style: _sectionTitleStyle),
        ),
        // Field rows
        ...children,
      ],
    );
  }

  /// A single labelled field: small uppercase grey label above, value below
  /// with a bottom border line.
  static pw.Widget _field(String label, String value) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.only(
          left: 4,
          right: 4,
          top: 4,
          bottom: 3,
        ),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(color: _borderColor, width: 0.5),
          ),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(label.toUpperCase(), style: _labelStyle),
            pw.SizedBox(height: 2),
            pw.Text(
              value.isEmpty ? ' ' : value,
              style: _valueStyle,
            ),
          ],
        ),
      ),
    );
  }

  /// A row of fields (each field is already [pw.Expanded]).
  static pw.Widget _fieldRow(List<pw.Widget> fields) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: fields,
    );
  }

  // ── Date / Time formatting ─────────────────────────────────────────────

  /// Converts `YYYY-MM-DD` to `DD/MM/YYYY`. Returns the original string if
  /// parsing fails or the input is empty.
  static String _formatDate(String input) {
    if (input.isEmpty) return '';
    try {
      final d = DateTime.parse(input);
      return '${d.day.toString().padLeft(2, '0')}/'
          '${d.month.toString().padLeft(2, '0')}/'
          '${d.year}';
    } catch (_) {
      return input;
    }
  }

  /// Converts `HH:MM` (24-hour) to `h:mm AM/PM`.
  /// Returns the original string if parsing fails or input is empty.
  static String _formatTime(String input) {
    if (input.isEmpty) return '';
    try {
      final parts = input.split(':');
      if (parts.length < 2) return input;
      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      final period = hour >= 12 ? 'PM' : 'AM';
      final h12 = hour == 0
          ? 12
          : hour > 12
              ? hour - 12
              : hour;
      return '$h12:${minute.toString().padLeft(2, '0')} $period';
    } catch (_) {
      return input;
    }
  }
}
