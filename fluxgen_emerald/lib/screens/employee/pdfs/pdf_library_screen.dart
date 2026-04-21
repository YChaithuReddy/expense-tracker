import 'dart:io';
import 'dart:math';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:path_provider/path_provider.dart';

import 'package:emerald/core/theme/app_colors.dart';
import 'package:emerald/core/utils/currency_formatter.dart';
import 'package:emerald/core/utils/date_formatter.dart';

/// PDF Library screen for browsing, uploading, viewing, and deleting
/// reimbursement PDFs stored in Supabase.
///
/// Displays a 2-column grid of PDF cards loaded from the `reimbursement_pdfs`
/// table, with upload to `reimbursement-pdfs` storage bucket.
class PdfLibraryScreen extends StatefulWidget {
  const PdfLibraryScreen({super.key});

  @override
  State<PdfLibraryScreen> createState() => _PdfLibraryScreenState();
}

class _PdfLibraryScreenState extends State<PdfLibraryScreen> {
  List<Map<String, dynamic>> _pdfs = [];
  bool _loading = true;
  bool _uploading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPdfs();
  }

  // ── Data Loading ──────────────────────────────────────────────────────

  Future<void> _loadPdfs() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final data = await Supabase.instance.client
          .from('reimbursement_pdfs')
          .select()
          .eq('user_id', user.id)
          .order('created_at', ascending: false);

      if (!mounted) return;
      setState(() {
        _pdfs = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────

  Future<void> _pickAndUploadPdf() async {
    if (_uploading) return;

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        allowMultiple: false,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      if (file.path == null) return;

      // Show metadata dialog before uploading
      if (!mounted) return;
      final metadata = await _showMetadataDialog(file.name);
      if (metadata == null) return; // User cancelled

      setState(() => _uploading = true);

      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Generate unique storage path
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final randomSuffix = Random().nextInt(99999).toString().padLeft(5, '0');
      final storagePath = '${user.id}/reimbursement-pdfs/${timestamp}_$randomSuffix.pdf';

      // Upload file to storage
      final fileBytes = await File(file.path!).readAsBytes();
      await Supabase.instance.client.storage
          .from('expense-bills')
          .uploadBinary(storagePath, fileBytes,
              fileOptions: const FileOptions(
                cacheControl: '3600',
                upsert: false,
              ));

      // Insert metadata record
      await Supabase.instance.client.from('reimbursement_pdfs').insert({
        'user_id': user.id,
        'storage_path': storagePath,
        'filename': file.name,
        'file_size': file.size,
        'total_amount': metadata['total_amount'],
        'period_from': metadata['period_from'],
        'period_to': metadata['period_to'],
        'page_count': metadata['page_count'] ?? 1,
        'purpose': metadata['purpose'],
        'source': 'uploaded',
      });

      if (!mounted) return;
      setState(() => _uploading = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('PDF uploaded successfully'),
          backgroundColor: Color(0xFF059669),
        ),
      );

      _loadPdfs();
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Upload failed: ${e.toString()}'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  /// Shows a dialog to collect metadata (amount, date range, purpose) before upload.
  Future<Map<String, dynamic>?> _showMetadataDialog(String filename) async {
    final amountController = TextEditingController();
    final purposeController = TextEditingController();
    DateTime? periodFrom;
    DateTime? periodTo;
    final formKey = GlobalKey<FormState>();

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text(
            'PDF Details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Filename display
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.picture_as_pdf,
                            size: 20, color: Color(0xFFEF4444)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            filename,
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Total Amount
                  TextFormField(
                    controller: amountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Total Amount *',
                      prefixText: '\u20B9 ',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Amount is required';
                      final parsed = double.tryParse(v);
                      if (parsed == null || parsed <= 0) {
                        return 'Enter a valid amount';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  // Period From
                  InkWell(
                    onTap: () async {
                      final date = await showDatePicker(
                        context: ctx,
                        initialDate: periodFrom ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (date != null) {
                        setDialogState(() => periodFrom = date);
                      }
                    },
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: 'Period From',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                        suffixIcon: const Icon(Icons.calendar_today, size: 18),
                      ),
                      child: Text(
                        periodFrom != null
                            ? DateFormat('dd MMM yyyy').format(periodFrom!)
                            : 'Select date',
                        style: TextStyle(
                          fontSize: 14,
                          color: periodFrom != null
                              ? const Color(0xFF191C1E)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Period To
                  InkWell(
                    onTap: () async {
                      final date = await showDatePicker(
                        context: ctx,
                        initialDate: periodTo ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (date != null) {
                        setDialogState(() => periodTo = date);
                      }
                    },
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: 'Period To',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                        suffixIcon: const Icon(Icons.calendar_today, size: 18),
                      ),
                      child: Text(
                        periodTo != null
                            ? DateFormat('dd MMM yyyy').format(periodTo!)
                            : 'Select date',
                        style: TextStyle(
                          fontSize: 14,
                          color: periodTo != null
                              ? const Color(0xFF191C1E)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Purpose
                  TextFormField(
                    controller: purposeController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Purpose',
                      hintText: 'e.g. Travel reimbursement',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                    ),
                  ),
                ],
              ),
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
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(ctx, {
                  'total_amount': double.parse(amountController.text),
                  'period_from': periodFrom?.toIso8601String().split('T').first,
                  'period_to': periodTo?.toIso8601String().split('T').first,
                  'purpose': purposeController.text.trim().isNotEmpty
                      ? purposeController.text.trim()
                      : null,
                  'page_count': 1,
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Upload',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  // ── View / Share PDF ──────────────────────────────────────────────────

  Future<void> _viewOrSharePdf(Map<String, dynamic> pdf) async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Downloading PDF...'),
          duration: Duration(seconds: 1),
        ),
      );

      final storagePath = pdf['storage_path'] as String;
      final filename = pdf['filename'] as String? ?? 'document.pdf';

      final bytes = await Supabase.instance.client.storage
          .from('expense-bills')
          .download(storagePath);

      // Save to temp directory
      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/$filename';
      final file = File(filePath);
      await file.writeAsBytes(bytes);

      if (!mounted) return;

      await Share.shareXFiles(
        [XFile(filePath)],
        subject: filename,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to open PDF: ${e.toString()}'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  // ── Delete PDF ────────────────────────────────────────────────────────

  Future<void> _confirmDeletePdf(Map<String, dynamic> pdf) async {
    final filename = pdf['filename'] as String? ?? 'this PDF';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Delete PDF?',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Are you sure you want to delete "$filename"? This cannot be undone.',
          style: const TextStyle(fontSize: 14, color: Color(0xFF444653)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel',
                style: TextStyle(color: Color(0xFF9CA3AF))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Delete',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final storagePath = pdf['storage_path'] as String;
      final pdfId = pdf['id'] as String;

      // Delete from storage
      await Supabase.instance.client.storage
          .from('expense-bills')
          .remove([storagePath]);

      // Delete from database
      await Supabase.instance.client
          .from('reimbursement_pdfs')
          .delete()
          .eq('id', pdfId);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('PDF deleted'),
          backgroundColor: Color(0xFF059669),
        ),
      );

      _loadPdfs();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Delete failed: ${e.toString()}'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF191C1E)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'PDF Library',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
          ),
        ),
        centerTitle: false,
        actions: [
          if (_uploading)
            const Padding(
              padding: EdgeInsets.all(12),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.upload_file, color: AppColors.primary),
              tooltip: 'Upload PDF',
              onPressed: _pickAndUploadPdf,
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadPdfs,
        color: AppColors.primary,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              )
            : _error != null
                ? _buildError()
                : _pdfs.isEmpty
                    ? _buildEmpty()
                    : _buildGrid(),
      ),
    );
  }

  Widget _buildGrid() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: GridView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.82,
        ),
        itemCount: _pdfs.length,
        itemBuilder: (context, index) {
          return _PdfCard(
            pdf: _pdfs[index],
            onTap: () => _viewOrSharePdf(_pdfs[index]),
            onLongPress: () => _confirmDeletePdf(_pdfs[index]),
          );
        },
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 100),
        Center(
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  Icons.picture_as_pdf,
                  size: 40,
                  color: Color(0xFFEF4444),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'No PDFs yet',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
              ),
              const SizedBox(height: 6),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 48),
                child: Text(
                  'Upload your reimbursement PDFs to view and share them anytime.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _pickAndUploadPdf,
                icon: const Icon(Icons.upload_file, size: 18),
                label: const Text(
                  'Upload PDF',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 100),
        Center(
          child: Column(
            children: [
              const Icon(Icons.error_outline,
                  size: 48, color: Color(0xFFEF4444)),
              const SizedBox(height: 12),
              const Text(
                'Failed to load PDFs',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: _loadPdfs,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PDF Card Widget
// ════════════════════════════════════════════════════════════════════════════

class _PdfCard extends StatelessWidget {
  final Map<String, dynamic> pdf;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _PdfCard({
    required this.pdf,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final filename = pdf['filename'] as String? ?? 'document.pdf';
    final totalAmount = (pdf['total_amount'] is num)
        ? (pdf['total_amount'] as num).toDouble()
        : null;
    final createdAt = pdf['created_at'] != null
        ? DateTime.tryParse(pdf['created_at'] as String)
        : null;
    final pageCount = (pdf['page_count'] is num)
        ? (pdf['page_count'] as num).toInt()
        : null;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // PDF icon thumbnail
              Expanded(
                child: Center(
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.picture_as_pdf,
                      size: 28,
                      color: Color(0xFFEF4444),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // Filename (truncated)
              Text(
                filename,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),

              // Date + Amount row
              Row(
                children: [
                  if (createdAt != null)
                    Expanded(
                      child: Text(
                        DateFormatter.format(createdAt),
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF9CA3AF),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if (totalAmount != null)
                    Text(
                      CurrencyFormatter.formatCompact(totalAmount),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),

              // Page count
              if (pageCount != null && pageCount > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '$pageCount page${pageCount == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFFBBBBBB),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
