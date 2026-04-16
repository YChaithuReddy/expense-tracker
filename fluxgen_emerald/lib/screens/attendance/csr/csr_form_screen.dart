import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing/printing.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/csr_report.dart';
import '../../../services/csr_pdf_service.dart';
import 'signature_pad.dart';

/// Full-screen Customer Service Report form.
///
/// Collects all 27 CSR fields, two signature pads, a seal image, and
/// offers a "Preview & Share" action that generates a PDF and opens
/// the native print/share dialog via the `printing` package.
class CsrFormScreen extends StatefulWidget {
  const CsrFormScreen({super.key, this.prefillCsrNo});

  /// Optional pre-filled CSR number. If omitted, one is auto-generated.
  final String? prefillCsrNo;

  @override
  State<CsrFormScreen> createState() => _CsrFormScreenState();
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────────────────

class _CsrFormScreenState extends State<CsrFormScreen> {
  // ── Report Info ───────────────────────────────────────────────────────────
  late final TextEditingController _csrNoCtrl;
  late String _csrDate;
  final _callByCtrl = TextEditingController();

  // ── Customer Details ──────────────────────────────────────────────────────
  final _customerNameCtrl  = TextEditingController();
  final _addressCtrl       = TextEditingController();
  final _cityCtrl          = TextEditingController();
  final _stateCtrl         = TextEditingController();
  final _zipCtrl           = TextEditingController();

  // ── Engineer Details ──────────────────────────────────────────────────────
  final _instructionFromCtrl = TextEditingController();
  final _inspectedByCtrl     = TextEditingController();

  // ── Work Details ──────────────────────────────────────────────────────────
  final _natureOfWorkCtrl = TextEditingController();
  final _workDetailsCtrl  = TextEditingController();
  final _locationCtrl     = TextEditingController();
  String _statusAfterWork = CsrReport.statusOptions.first;
  final _defectsCtrl      = TextEditingController();
  final _engineerRemarksCtrl = TextEditingController();

  // ── Service Timings ───────────────────────────────────────────────────────
  String _eventDate  = '';
  String _eventTime  = '';
  String _startTime  = '';
  String _endTime    = '';

  // ── Customer Satisfaction ─────────────────────────────────────────────────
  String _rating = '';

  // ── Customer Feedback ─────────────────────────────────────────────────────
  final _feedbackRemarksCtrl     = TextEditingController();
  final _feedbackNameCtrl        = TextEditingController();
  final _feedbackDesignationCtrl = TextEditingController();
  final _feedbackPhoneCtrl       = TextEditingController();
  final _feedbackEmailCtrl       = TextEditingController();
  String _feedbackDate = '';

  // ── Signatures / Seal ─────────────────────────────────────────────────────
  final _customerSigKey = GlobalKey<SignaturePadState>();
  final _engineerSigKey  = GlobalKey<SignaturePadState>();
  Uint8List? _sealImageBytes;

  // ── UI State ──────────────────────────────────────────────────────────────
  bool _isGenerating = false;
  String? _validationError;

  // ── Validation scroll support ─────────────────────────────────────────────
  final _scrollController = ScrollController();

  // ─────────────────────────────────────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    final report = CsrReport(csrNo: widget.prefillCsrNo);
    _csrNoCtrl = TextEditingController(text: report.csrNo);
    _csrDate   = report.csrDate;
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _csrNoCtrl.dispose();
    _callByCtrl.dispose();
    _customerNameCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _zipCtrl.dispose();
    _instructionFromCtrl.dispose();
    _inspectedByCtrl.dispose();
    _natureOfWorkCtrl.dispose();
    _workDetailsCtrl.dispose();
    _locationCtrl.dispose();
    _defectsCtrl.dispose();
    _engineerRemarksCtrl.dispose();
    _feedbackRemarksCtrl.dispose();
    _feedbackNameCtrl.dispose();
    _feedbackDesignationCtrl.dispose();
    _feedbackPhoneCtrl.dispose();
    _feedbackEmailCtrl.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  Future<void> _pickDate({
    required String current,
    required ValueChanged<String> onPicked,
  }) async {
    DateTime initial = DateTime.now();
    if (current.isNotEmpty) {
      try {
        initial = DateTime.parse(current);
      } catch (_) {}
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: AppColors.primary,
              ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      onPicked(
        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> _pickTime({
    required String current,
    required ValueChanged<String> onPicked,
  }) async {
    TimeOfDay initial = TimeOfDay.now();
    if (current.isNotEmpty) {
      final parts = current.split(':');
      if (parts.length == 2) {
        final h = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        if (h != null && m != null) initial = TimeOfDay(hour: h, minute: m);
      }
    }
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: AppColors.primary,
              ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      onPicked(
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> _pickSealImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (mounted) setState(() => _sealImageBytes = bytes);
  }

  bool _validate() {
    final customerName  = _customerNameCtrl.text.trim();
    final inspectedBy   = _inspectedByCtrl.text.trim();
    final workDetails   = _workDetailsCtrl.text.trim();

    if (customerName.isEmpty) {
      setState(() => _validationError = 'Customer Name is required');
      return false;
    }
    if (inspectedBy.isEmpty) {
      setState(() => _validationError = 'Inspected By is required');
      return false;
    }
    if (workDetails.isEmpty) {
      setState(() => _validationError = 'Work Details / Performed is required');
      return false;
    }
    setState(() => _validationError = null);
    return true;
  }

  Future<void> _onPreviewAndShare() async {
    if (!_validate()) {
      // Scroll to top so the user sees the validation error banner
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOut,
      );
      return;
    }

    setState(() => _isGenerating = true);
    try {
      // Export signature images
      final customerSig = await _customerSigKey.currentState?.toImage();
      final engineerSig  = await _engineerSigKey.currentState?.toImage();

      // Build the model
      final report = CsrReport(csrNo: _csrNoCtrl.text.trim())
        ..csrDate         = _csrDate
        ..callBy          = _callByCtrl.text.trim()
        ..customerName    = _customerNameCtrl.text.trim()
        ..address         = _addressCtrl.text.trim()
        ..city            = _cityCtrl.text.trim()
        ..state           = _stateCtrl.text.trim()
        ..zip             = _zipCtrl.text.trim()
        ..instructionFrom = _instructionFromCtrl.text.trim()
        ..inspectedBy     = _inspectedByCtrl.text.trim()
        ..natureOfWork    = _natureOfWorkCtrl.text.trim()
        ..workDetails     = _workDetailsCtrl.text.trim()
        ..location        = _locationCtrl.text.trim()
        ..statusAfter     = _statusAfterWork
        ..defects         = _defectsCtrl.text.trim()
        ..remarks         = _engineerRemarksCtrl.text.trim()
        ..eventDate       = _eventDate
        ..eventTime       = _eventTime
        ..startTime       = _startTime
        ..endTime         = _endTime
        ..rating          = _rating
        ..feedbackRemarks     = _feedbackRemarksCtrl.text.trim()
        ..feedbackName        = _feedbackNameCtrl.text.trim()
        ..feedbackDesignation = _feedbackDesignationCtrl.text.trim()
        ..feedbackPhone       = _feedbackPhoneCtrl.text.trim()
        ..feedbackEmail       = _feedbackEmailCtrl.text.trim()
        ..feedbackDate        = _feedbackDate
        ..customerSignature   = customerSig
        ..engineerSignature   = engineerSig
        ..sealImage           = _sealImageBytes;

      final pdfBytes = await CsrPdfService.generate(report);

      if (!mounted) return;

      // Open native PDF viewer / share dialog
      await Printing.layoutPdf(
        onLayout: (_) async => pdfBytes,
        name: 'CSR-${report.csrNo}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text('PDF generation failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isGenerating = false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FB),
      body: Column(
        children: [
          // ── Gradient AppBar ─────────────────────────────────────────────
          _GradientAppBar(title: 'Service Report'),

          // ── Scrollable form ────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Validation banner
                  if (_validationError != null) ...[
                    _ValidationBanner(message: _validationError!),
                    const SizedBox(height: 12),
                  ],

                  _reportInfoCard(),
                  const SizedBox(height: 14),
                  _customerDetailsCard(),
                  const SizedBox(height: 14),
                  _engineerDetailsCard(),
                  const SizedBox(height: 14),
                  _workDetailsCard(),
                  const SizedBox(height: 14),
                  _serviceTimingsCard(),
                  const SizedBox(height: 14),
                  _satisfactionCard(),
                  const SizedBox(height: 14),
                  _customerFeedbackCard(),
                  const SizedBox(height: 14),
                  _signaturesCard(),
                  const SizedBox(height: 24),

                  // ── Preview & Share button ──────────────────────────────
                  _PreviewShareButton(
                    isGenerating: _isGenerating,
                    onTap: _onPreviewAndShare,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SECTION CARDS
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1. Report Info ────────────────────────────────────────────────────────
  Widget _reportInfoCard() {
    return _SectionCard(
      icon: Icons.assignment_outlined,
      iconColor: AppColors.primary,
      title: 'Report Info',
      children: [
        TextField(
          controller: _csrNoCtrl,
          readOnly: true,
          decoration: _inputDeco(
            label: 'CSR No',
            hint: 'Auto-generated',
            suffix: const Icon(Icons.lock_outline, size: 16,
                color: AppColors.outline),
          ),
        ),
        const SizedBox(height: 12),
        _DatePickerField(
          label: 'Date',
          value: _csrDate,
          onTap: () => _pickDate(
            current: _csrDate,
            onPicked: (v) => setState(() => _csrDate = v),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _callByCtrl,
          decoration: _inputDeco(label: 'Status of Call By'),
          textCapitalization: TextCapitalization.words,
        ),
      ],
    );
  }

  // ── 2. Customer Details ───────────────────────────────────────────────────
  Widget _customerDetailsCard() {
    return _SectionCard(
      icon: Icons.person_outline_rounded,
      iconColor: const Color(0xFF0EA5E9),
      title: 'Customer Details',
      children: [
        TextField(
          controller: _customerNameCtrl,
          decoration: _inputDeco(label: 'Customer Name *'),
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _addressCtrl,
          decoration: _inputDeco(label: 'Address'),
          maxLines: 2,
          textCapitalization: TextCapitalization.sentences,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _cityCtrl,
                decoration: _inputDeco(label: 'City'),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _stateCtrl,
                decoration: _inputDeco(label: 'State'),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 90,
              child: TextField(
                controller: _zipCtrl,
                decoration: _inputDeco(label: 'ZIP'),
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── 3. Engineer Details ───────────────────────────────────────────────────
  Widget _engineerDetailsCard() {
    return _SectionCard(
      icon: Icons.engineering_outlined,
      iconColor: const Color(0xFF8B5CF6),
      title: 'Engineer Details',
      children: [
        TextField(
          controller: _instructionFromCtrl,
          decoration: _inputDeco(label: 'Instruction From'),
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _inspectedByCtrl,
          decoration: _inputDeco(label: 'Inspected By *'),
          textCapitalization: TextCapitalization.words,
        ),
      ],
    );
  }

  // ── 4. Work Details ───────────────────────────────────────────────────────
  Widget _workDetailsCard() {
    return _SectionCard(
      icon: Icons.build_outlined,
      iconColor: const Color(0xFFF59E0B),
      title: 'Work Details',
      children: [
        TextField(
          controller: _natureOfWorkCtrl,
          decoration: _inputDeco(label: 'Nature of Work'),
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _workDetailsCtrl,
          decoration: _inputDeco(label: 'Work Details / Performed *'),
          maxLines: 4,
          textCapitalization: TextCapitalization.sentences,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _locationCtrl,
          decoration: _inputDeco(label: 'Location'),
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _statusAfterWork,
          decoration: _inputDeco(label: 'Status After Work'),
          items: [
            for (final s in CsrReport.statusOptions)
              DropdownMenuItem(value: s, child: Text(s)),
          ],
          onChanged: (v) {
            if (v != null) setState(() => _statusAfterWork = v);
          },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _defectsCtrl,
          decoration: _inputDeco(label: 'Defects Found'),
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _engineerRemarksCtrl,
          decoration: _inputDeco(label: "Engineer's Remarks"),
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
        ),
      ],
    );
  }

  // ── 5. Service Timings ────────────────────────────────────────────────────
  Widget _serviceTimingsCard() {
    return _SectionCard(
      icon: Icons.schedule_outlined,
      iconColor: const Color(0xFF10B981),
      title: 'Service Timings',
      children: [
        _DatePickerField(
          label: 'Event Date',
          value: _eventDate,
          onTap: () => _pickDate(
            current: _eventDate,
            onPicked: (v) => setState(() => _eventDate = v),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _TimePickerField(
                label: 'Event Time',
                value: _eventTime,
                onTap: () => _pickTime(
                  current: _eventTime,
                  onPicked: (v) => setState(() => _eventTime = v),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _TimePickerField(
                label: 'Start Time',
                value: _startTime,
                onTap: () => _pickTime(
                  current: _startTime,
                  onPicked: (v) => setState(() => _startTime = v),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _TimePickerField(
                label: 'End Time',
                value: _endTime,
                onTap: () => _pickTime(
                  current: _endTime,
                  onPicked: (v) => setState(() => _endTime = v),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── 6. Customer Satisfaction ──────────────────────────────────────────────
  Widget _satisfactionCard() {
    return _SectionCard(
      icon: Icons.sentiment_satisfied_alt_outlined,
      iconColor: const Color(0xFFEC4899),
      title: 'Customer Satisfaction',
      children: [
        Text(
          'Please Rate This Service',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.onSurfaceVariant,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final r in CsrReport.ratingOptions)
              ChoiceChip(
                label: Text(
                  r,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _rating == r ? Colors.white : AppColors.onSurfaceVariant,
                  ),
                ),
                selected: _rating == r,
                selectedColor: AppColors.primary,
                backgroundColor: AppColors.surfaceContainerLow,
                side: BorderSide(
                  color: _rating == r
                      ? AppColors.primary
                      : AppColors.outlineVariant,
                  width: 1,
                ),
                showCheckmark: false,
                onSelected: (selected) {
                  setState(() => _rating = selected ? r : '');
                },
              ),
          ],
        ),
      ],
    );
  }

  // ── 7. Customer Feedback ──────────────────────────────────────────────────
  Widget _customerFeedbackCard() {
    return _SectionCard(
      icon: Icons.rate_review_outlined,
      iconColor: const Color(0xFF0EA5E9),
      title: 'Customer Feedback',
      children: [
        TextField(
          controller: _feedbackRemarksCtrl,
          decoration: _inputDeco(label: 'Remarks'),
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: TextField(
                controller: _feedbackNameCtrl,
                decoration: _inputDeco(label: 'Name'),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: TextField(
                controller: _feedbackDesignationCtrl,
                decoration: _inputDeco(label: 'Designation'),
                textCapitalization: TextCapitalization.words,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _feedbackPhoneCtrl,
          decoration: _inputDeco(label: 'Phone'),
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _feedbackEmailCtrl,
          decoration: _inputDeco(label: 'Email'),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        _DatePickerField(
          label: 'Date',
          value: _feedbackDate,
          onTap: () => _pickDate(
            current: _feedbackDate,
            onPicked: (v) => setState(() => _feedbackDate = v),
          ),
        ),
      ],
    );
  }

  // ── 8. Signatures ─────────────────────────────────────────────────────────
  Widget _signaturesCard() {
    return _SectionCard(
      icon: Icons.draw_outlined,
      iconColor: AppColors.primary,
      title: 'Signatures & Seal',
      children: [
        // Two signature pads side-by-side on wide screens;
        // stacked on narrow screens via intrinsic layout.
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 480;
            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: SignaturePad(
                      key: _customerSigKey,
                      label: 'Customer Signature',
                      height: 120,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SignaturePad(
                      key: _engineerSigKey,
                      label: 'Engineer Signature',
                      height: 120,
                    ),
                  ),
                ],
              );
            }
            return Column(
              children: [
                SignaturePad(
                  key: _customerSigKey,
                  label: 'Customer Signature',
                  height: 120,
                ),
                const SizedBox(height: 16),
                SignaturePad(
                  key: _engineerSigKey,
                  label: 'Engineer Signature',
                  height: 120,
                ),
              ],
            );
          },
        ),

        const SizedBox(height: 20),

        // Seal image picker
        Text(
          'Company Seal / Stamp',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.onSurfaceVariant,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            // Thumbnail preview
            if (_sealImageBytes != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  _sealImageBytes!,
                  width: 72,
                  height: 72,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
            ],
            // Pick / change button
            OutlinedButton.icon(
              onPressed: _pickSealImage,
              icon: const Icon(Icons.upload_outlined, size: 18),
              label: Text(
                _sealImageBytes == null ? 'Upload Seal Image' : 'Change Image',
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
              ),
            ),
            if (_sealImageBytes != null) ...[
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => setState(() => _sealImageBytes = null),
                icon: const Icon(Icons.delete_outline, size: 20),
                color: AppColors.error,
                tooltip: 'Remove seal',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.errorContainer,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  InputDecoration _inputDeco({
    required String label,
    String? hint,
    Widget? suffix,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      suffixIcon: suffix,
      filled: true,
      fillColor: Colors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.8),
      ),
      labelStyle: const TextStyle(
        fontSize: 13,
        color: AppColors.onSurfaceVariant,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GRADIENT APP BAR
// ─────────────────────────────────────────────────────────────────────────────

class _GradientAppBar extends StatelessWidget {
  const _GradientAppBar({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF006699), Color(0xFF00456B)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 56,
          child: NavigationToolbar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: Colors.white, size: 20),
              onPressed: () => Navigator.maybePop(context),
              tooltip: 'Back',
            ),
            middle: Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION CARD
// ─────────────────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.children,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Section header
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 17, color: iconColor),
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1A1A2E),
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1, color: Color(0xFFEEEEEE)),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATE PICKER FIELD (InkWell + InputDecorator pattern)
// ─────────────────────────────────────────────────────────────────────────────

class _DatePickerField extends StatelessWidget {
  const _DatePickerField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  String _display(String v) {
    if (v.isEmpty) return '';
    try {
      final d = DateTime.parse(v);
      return '${d.day.toString().padLeft(2, '0')}/'
          '${d.month.toString().padLeft(2, '0')}/'
          '${d.year}';
    } catch (_) {
      return v;
    }
  }

  @override
  Widget build(BuildContext context) {
    final display = _display(value);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.outlineVariant),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.outlineVariant),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.primary, width: 1.8),
          ),
          suffixIcon: const Icon(Icons.calendar_today_outlined,
              size: 18, color: AppColors.outline),
          labelStyle: const TextStyle(
            fontSize: 13,
            color: AppColors.onSurfaceVariant,
          ),
        ),
        isEmpty: display.isEmpty,
        child: Text(
          display.isEmpty ? '' : display,
          style: const TextStyle(fontSize: 14, color: AppColors.onSurface),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TIME PICKER FIELD (InkWell + InputDecorator pattern)
// ─────────────────────────────────────────────────────────────────────────────

class _TimePickerField extends StatelessWidget {
  const _TimePickerField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  String _display(String v) {
    if (v.isEmpty) return '';
    try {
      final parts = v.split(':');
      if (parts.length < 2) return v;
      final hour   = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      final period = hour >= 12 ? 'PM' : 'AM';
      final h12    = hour == 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return '$h12:${minute.toString().padLeft(2, '0')} $period';
    } catch (_) {
      return v;
    }
  }

  @override
  Widget build(BuildContext context) {
    final display = _display(value);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.outlineVariant),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.outlineVariant),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.primary, width: 1.8),
          ),
          suffixIcon: const Icon(Icons.access_time_outlined,
              size: 18, color: AppColors.outline),
          labelStyle: const TextStyle(
            fontSize: 13,
            color: AppColors.onSurfaceVariant,
          ),
        ),
        isEmpty: display.isEmpty,
        child: Text(
          display.isEmpty ? '' : display,
          style: const TextStyle(fontSize: 14, color: AppColors.onSurface),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  VALIDATION BANNER
// ─────────────────────────────────────────────────────────────────────────────

class _ValidationBanner extends StatelessWidget {
  const _ValidationBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.errorContainer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 18, color: AppColors.error),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.error,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREVIEW & SHARE BUTTON
// ─────────────────────────────────────────────────────────────────────────────

class _PreviewShareButton extends StatelessWidget {
  const _PreviewShareButton({
    required this.isGenerating,
    required this.onTap,
  });

  final bool isGenerating;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          colors: [Color(0xFF006699), Color(0xFF00456B)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF006699).withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: FilledButton.icon(
        onPressed: isGenerating ? null : onTap,
        icon: isGenerating
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2.2, color: Colors.white),
              )
            : const Icon(Icons.picture_as_pdf_outlined, size: 20),
        label: Text(
          isGenerating ? 'Generating PDF…' : 'Preview & Share',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}
