import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:emerald/services/excel_export_service.dart';
import 'package:emerald/services/pdf_service.dart';
import 'package:emerald/services/email_service.dart';
import 'package:emerald/screens/employee/export/sheets_export_screen.dart';

/// Export Hub screen — provides Excel export, Google Sheets link,
/// PDF reimbursement generation, and email-to-accounts functionality.
class ExportScreen extends StatefulWidget {
  const ExportScreen({super.key});

  @override
  State<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends State<ExportScreen> {
  final _excelService = ExcelExportService();
  final _pdfService = PdfService();
  final _emailService = EmailService();

  bool _isExporting = false;
  String? _googleSheetUrl;
  String _userName = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final profile = await Supabase.instance.client
          .from('profiles')
          .select('name, email, google_sheet_url')
          .eq('id', user.id)
          .maybeSingle();

      if (mounted && profile != null) {
        setState(() {
          _userName = (profile['name'] as String?) ?? '';
          _googleSheetUrl = profile['google_sheet_url'] as String?;
        });
      }
    } catch (_) {
      // Non-critical — continue without profile data
    }
  }

  /// Fetches all expenses for the current user from Supabase.
  Future<List<Map<String, dynamic>>> _fetchAllExpenses() async {
    final userId = Supabase.instance.client.auth.currentUser!.id;
    final data = await Supabase.instance.client
        .from('expenses')
        .select()
        .eq('user_id', userId)
        .order('date', ascending: false)
        .limit(1000);
    return List<Map<String, dynamic>>.from(data);
  }

  // ── Export to Excel ──────────────────────────────────────────────────────

  Future<void> _exportToExcel() async {
    setState(() => _isExporting = true);
    try {
      final expenses = await _fetchAllExpenses();
      if (expenses.isEmpty) {
        _showSnackBar('No expenses to export');
        return;
      }

      final filePath = await _excelService.exportToExcel(expenses);

      await Share.shareXFiles(
        [XFile(filePath)],
        subject: 'Expense Report',
      );
    } catch (e) {
      _showSnackBar('Export failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  // ── Export & Open Google Sheets ──────────────────────────────────────────

  Future<void> _openGoogleSheets() async {
    if (_googleSheetUrl == null || _googleSheetUrl!.isEmpty) {
      _showSnackBar('No Google Sheet linked to your profile');
      return;
    }

    // Navigate to the sheets export screen where user selects expenses
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SheetsExportScreen()),
    );
  }

  // ── Generate PDF ─────────────────────────────────────────────────────────

  Future<void> _generatePdf() async {
    final result = await _showPdfDialog();
    if (result == null) return;

    setState(() => _isExporting = true);
    try {
      final expenses = await _fetchAllExpenses();
      if (expenses.isEmpty) {
        _showSnackBar('No expenses to include in PDF');
        return;
      }

      // Fetch receipt images for each expense
      for (final expense in expenses) {
        try {
          final images = await Supabase.instance.client
              .from('expense_images')
              .select('public_url, filename')
              .eq('expense_id', expense['id']);
          expense['expense_images'] = images;
        } catch (_) {
          expense['expense_images'] = [];
        }
      }

      // Use the full packet method (table + receipt images like web)
      final packet = await _pdfService.generateReimbursementPacket(
        expenses: expenses,
        employeeInfo: {
          'name': result['name'],
          'employee_id': result['id'],
        },
      );

      // Save and share
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${packet.filename}');
      await file.writeAsBytes(packet.bytes);

      await Share.shareXFiles(
        [XFile(file.path)],
        subject: 'Reimbursement Claim - ${result['name']}',
      );
    } catch (e) {
      _showSnackBar('PDF generation failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  /// Shows a dialog to collect employee name, ID, and period for the PDF.
  Future<Map<String, String>?> _showPdfDialog() async {
    final nameController = TextEditingController(text: _userName);
    final idController = TextEditingController();

    // Default date range: first to last day of current month
    final now = DateTime.now();
    DateTime fromDate = DateTime(now.year, now.month, 1);
    DateTime toDate = DateTime(now.year, now.month + 1, 0);

    String formatDate(DateTime d) =>
        '${d.day.toString().padLeft(2, '0')} ${_shortMonthName(d.month)} ${d.year}';

    return showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final periodText = '${formatDate(fromDate)} - ${formatDate(toDate)}';

          return AlertDialog(
            title: const Text(
              'Reimbursement Details',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _dialogField(
                      nameController, 'Employee Name', Icons.person_outline),
                  const SizedBox(height: 16),
                  _dialogField(
                      idController, 'Employee ID', Icons.badge_outlined),
                  const SizedBox(height: 16),
                  // Period label
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: Text(
                        'Reimbursement Period',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ),
                  ),
                  // Date range row
                  Row(
                    children: [
                      // From date
                      Expanded(
                        child: _DatePickerField(
                          label: 'From',
                          date: fromDate,
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: ctx,
                              initialDate: fromDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2030),
                              builder: (context, child) => Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme:
                                      Theme.of(context).colorScheme.copyWith(
                                            primary: const Color(0xFF006699),
                                          ),
                                ),
                                child: child!,
                              ),
                            );
                            if (picked != null) {
                              setDialogState(() => fromDate = picked);
                            }
                          },
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Icon(Icons.arrow_forward,
                            size: 16, color: Color(0xFF9CA3AF)),
                      ),
                      // To date
                      Expanded(
                        child: _DatePickerField(
                          label: 'To',
                          date: toDate,
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: ctx,
                              initialDate: toDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2030),
                              builder: (context, child) => Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme:
                                      Theme.of(context).colorScheme.copyWith(
                                            primary: const Color(0xFF006699),
                                          ),
                                ),
                                child: child!,
                              ),
                            );
                            if (picked != null) {
                              setDialogState(() => toDate = picked);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel',
                    style: TextStyle(color: Color(0xFF9CA3AF))),
              ),
              ElevatedButton(
                onPressed: () {
                  if (nameController.text.trim().isEmpty ||
                      idController.text.trim().isEmpty) {
                    return; // Don't close — fields required
                  }
                  Navigator.pop(ctx, {
                    'name': nameController.text.trim(),
                    'id': idController.text.trim(),
                    'period': periodText,
                  });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006699),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Generate'),
              ),
            ],
          );
        },
      ),
    );
  }

  String _shortMonthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return months[month - 1];
  }

  // ── Email to Accounts ────────────────────────────────────────────────────

  Future<void> _emailToAccounts() async {
    final result = await _showEmailDialog();
    if (result == null) return;

    setState(() => _isExporting = true);
    try {
      final expenses = await _fetchAllExpenses();
      if (expenses.isEmpty) {
        _showSnackBar('No expenses to include');
        return;
      }

      // Generate PDF attachment
      final filePath = await _pdfService.generateReimbursementPdf(
        employeeName: _userName.isNotEmpty ? _userName : 'Employee',
        employeeId: result['employeeId'] ?? '',
        period: _defaultPeriod(),
        expenses: expenses,
      );

      await _emailService.sendReimbursementEmail(
        toEmail: result['email']!,
        subject: result['subject']!,
        body: result['body']!,
        attachmentPath: filePath,
      );
    } catch (e) {
      _showSnackBar('Email failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  /// Shows a dialog to collect email address, subject, and message.
  Future<Map<String, String>?> _showEmailDialog() async {
    final period = _defaultPeriod();
    final displayName = _userName.isNotEmpty ? _userName : 'Employee';
    final emailController =
        TextEditingController(text: 'accounts@fluxgentech.com');
    final subjectController = TextEditingController(
      text: 'Reimbursement Claim - $displayName - $period',
    );
    final bodyController = TextEditingController(
      text: 'Dear Accounts Team,\n\n'
          'Please find attached my reimbursement claim for the period of $period.\n\n'
          'Kindly process the same at the earliest.\n\n'
          'Regards,\n$displayName',
    );
    final idController = TextEditingController();

    return showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Title
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.email_outlined,
                          size: 18, color: Color(0xFF8B5CF6)),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Email Reimbursement',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.close,
                          size: 20, color: Color(0xFF9CA3AF)),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 16, color: Color(0xFFF3F4F6)),

              // Scrollable content
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _dialogField(
                          emailController, 'To Email', Icons.email_outlined),
                      const SizedBox(height: 16),
                      _dialogField(
                          idController, 'Employee ID', Icons.badge_outlined),
                      const SizedBox(height: 16),
                      _dialogField(
                          subjectController, 'Subject', Icons.subject),
                      const SizedBox(height: 16),
                      _dialogField(bodyController, 'Message',
                          Icons.message_outlined,
                          maxLines: 5),
                      const SizedBox(height: 8),
                      const Text(
                        'A PDF reimbursement claim will be generated and attached automatically.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Actions
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF6B7280),
                          side: const BorderSide(color: Color(0xFFE5E7EB)),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Cancel',
                            style: TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w500)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          if (emailController.text.trim().isEmpty) return;
                          Navigator.pop(ctx, {
                            'email': emailController.text.trim(),
                            'subject': subjectController.text.trim(),
                            'body': bodyController.text.trim(),
                            'employeeId': idController.text.trim(),
                          });
                        },
                        icon: const Icon(Icons.send, size: 16),
                        label: const Text('Send Email',
                            style: TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF006699),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  String _defaultPeriod() {
    final now = DateTime.now();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return '${months[now.month - 1]} ${now.year}';
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  Widget _dialogField(
    TextEditingController controller,
    String label,
    IconData icon, {
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20, color: const Color(0xFF9CA3AF)),
        filled: true,
        fillColor: const Color(0xFFF3F4F6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF006699), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text(
          'Export & Share',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
            letterSpacing: -0.02,
          ),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF191C1E)),
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Section: Export Expenses ──────────────────────────────
              _sectionHeader('Export Expenses'),
              const SizedBox(height: 10),

              _ExportCard(
                icon: Icons.grid_on_rounded,
                iconColor: const Color(0xFF0EA5E9),
                title: 'Export to Google Sheets',
                subtitle: _googleSheetUrl != null
                    ? 'Select expenses & sync to your Sheet'
                    : 'No Google Sheet linked yet',
                onTap: _openGoogleSheets,
                enabled: _googleSheetUrl != null,
              ),

              const SizedBox(height: 28),

              // ── Section: Reimbursement ────────────────────────────────
              _sectionHeader('Reimbursement'),
              const SizedBox(height: 10),

              _ExportCard(
                icon: Icons.picture_as_pdf_outlined,
                iconColor: const Color(0xFFEF4444),
                title: 'Generate PDF Package',
                subtitle: 'Create a professional reimbursement claim PDF',
                onTap: _generatePdf,
              ),
              const SizedBox(height: 10),

              _ExportCard(
                icon: Icons.email_outlined,
                iconColor: const Color(0xFF8B5CF6),
                title: 'Email to Accounts',
                subtitle: 'Generate PDF and email it to your accounts team',
                onTap: _emailToAccounts,
              ),
            ],
          ),

          // Full-screen loading overlay
          if (_isExporting)
            Container(
              color: Colors.black26,
              child: const Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(
                          color: Color(0xFF006699),
                        ),
                        SizedBox(height: 16),
                        Text(
                          'Generating...',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF191C1E),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String text) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF6B7280),
      ),
    );
  }
}

// ── Export Card Widget ──────────────────────────────────────────────────────

class _ExportCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool enabled;

  const _ExportCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              // Icon circle
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Icon(icon, color: iconColor, size: 22),
                ),
              ),
              const SizedBox(width: 14),

              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF191C1E),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),

              // Arrow
              const Icon(
                Icons.arrow_forward_ios,
                size: 14,
                color: Color(0xFF9CA3AF),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Date Picker Field Widget ──────────────────────────────────────────────────

class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime date;
  final VoidCallback onTap;

  const _DatePickerField({
    required this.label,
    required this.date,
    required this.onTap,
  });

  String get _formatted {
    final d = date.day.toString().padLeft(2, '0');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '$d ${months[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined,
                    size: 14, color: Color(0xFF006699)),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    _formatted,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF191C1E),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
