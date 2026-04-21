import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/categories.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/ocr_service.dart';
import '../../../services/activity_log_service.dart';

/// Receipt scanner screen that captures or selects an image, runs OCR,
/// and lets the user review/edit the extracted fields before saving.
class ScanReceiptScreen extends StatefulWidget {
  /// Optional: pre-select the image source on launch.
  /// If null, the user chooses from Camera / Gallery buttons.
  final ImageSource? initialSource;

  /// Optional: path to an already-captured image (e.g. from camera).
  /// When provided, skips the source picker and immediately runs OCR.
  final String? capturedImagePath;

  const ScanReceiptScreen({super.key, this.initialSource, this.capturedImagePath});

  @override
  State<ScanReceiptScreen> createState() => _ScanReceiptScreenState();
}

class _ScanReceiptScreenState extends State<ScanReceiptScreen> {
  final _formKey = GlobalKey<FormState>();
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();

  // ── Controllers ──────────────────────────────────────────────────────
  final _amountController = TextEditingController();
  final _dateController = TextEditingController();
  final _vendorController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _customCategoryController = TextEditingController();

  // ── State ────────────────────────────────────────────────────────────
  File? _selectedImage;
  bool _isScanning = false;
  bool _isSaving = false;
  bool _scanComplete = false;
  String _rawText = '';

  String? _selectedCategory;
  String? _selectedSubcategory;
  int _paymentModeIndex = 0;
  int _visitTypeIndex = 0;
  DateTime _selectedDate = DateTime.now();

  // Project dropdown (company mode)
  List<Map<String, dynamic>> _projects = [];
  String? _selectedProject;
  bool _isCompanyMode = false;
  bool _projectsLoading = true;

  Future<void> _loadProjects() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;
      final profile = await _supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
      final orgId = profile?['organization_id'];
      if (orgId != null) {
        _isCompanyMode = true;
        final projects = await _supabase
            .from('projects')
            .select('id, project_code, project_name, client_name')
            .eq('organization_id', orgId)
            .eq('status', 'active')
            .order('project_name');
        if (mounted) {
          setState(() {
            _projects = List<Map<String, dynamic>>.from(projects);
            _projectsLoading = false;
          });
        }
      } else {
        if (mounted) setState(() { _isCompanyMode = false; _projectsLoading = false; });
      }
    } catch (_) {
      if (mounted) setState(() => _projectsLoading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _dateController.text = DateFormat(AppConstants.dateFormat).format(_selectedDate);
    _loadProjects();

    // If launched with an already-captured image, use it directly
    if (widget.capturedImagePath != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        setState(() {
          _selectedImage = File(widget.capturedImagePath!);
          _scanComplete = false;
        });
        _runOcr(widget.capturedImagePath!);
      });
    }
    // If launched with a specific source, immediately pick
    else if (widget.initialSource != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _pickImage(widget.initialSource!);
      });
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _dateController.dispose();
    _vendorController.dispose();
    _descriptionController.dispose();
    _customCategoryController.dispose();
    super.dispose();
  }

  // ── Image picking ──────────────────────────────────────────────────

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await _picker.pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
    );

    if (pickedFile == null) return;

    setState(() {
      _selectedImage = File(pickedFile.path);
      _scanComplete = false;
    });

    await _runOcr(pickedFile.path);
  }

  // ── OCR processing ────────────────────────────────────────────────

  Future<void> _runOcr(String imagePath) async {
    setState(() => _isScanning = true);

    try {
      final result = await OcrService.scanReceipt(imagePath);

      if (!mounted) return;

      setState(() {
        _rawText = result['rawText'] ?? '';
        _scanComplete = true;
        _isScanning = false;
      });

      // Pre-fill fields with extracted data
      final amount = result['amount'] ?? '';
      if (amount.isNotEmpty) {
        _amountController.text = amount;
      }

      final date = result['date'] ?? '';
      if (date.isNotEmpty) {
        final parsed = DateTime.tryParse(date);
        if (parsed != null) {
          _selectedDate = parsed;
          _dateController.text = DateFormat(AppConstants.dateFormat).format(parsed);
        }
      }

      final vendor = result['vendor'] ?? '';
      if (vendor.isNotEmpty) {
        _vendorController.text = vendor;
      }

      // Auto-select category if detected by OCR
      final category = result['category'] ?? '';
      if (category.isNotEmpty && category != 'Other') {
        setState(() {
          _selectedCategory = category;
          _selectedSubcategory = null;
        });

        // Auto-select subcategory if detected
        final subcategory = result['subcategory'] ?? '';
        if (subcategory.isNotEmpty) {
          final subs = AppConstants.subcategoriesFor(category);
          if (subs.contains(subcategory)) {
            setState(() => _selectedSubcategory = subcategory);
          }
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isScanning = false;
        _scanComplete = true;
      });
      _showError('OCR failed: $e');
    }
  }

  // ── Date picker ───────────────────────────────────────────────────

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
                  primary: AppColors.primary,
                  onPrimary: Colors.white,
                  surface: Colors.white,
                ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _dateController.text = DateFormat(AppConstants.dateFormat).format(picked);
      });
    }
  }

  // ── Upload image to Supabase storage ──────────────────────────────

  /// Uploads receipt and returns both the public URL and the storage path.
  Future<({String publicUrl, String storagePath, String filename, int sizeBytes})?> _uploadReceipt(File imageFile) async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return null;

      final ext = imageFile.path.split('.').last.toLowerCase();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final randomId = timestamp.toRadixString(36).substring(0, 7);
      final storagePath = '${user.id}/$timestamp-$randomId.$ext';

      final bytes = await imageFile.readAsBytes();
      final mimeType = ext == 'png'
          ? 'image/png'
          : ext == 'webp'
              ? 'image/webp'
              : ext == 'pdf'
                  ? 'application/pdf'
                  : 'image/jpeg';

      await _supabase.storage.from('expense-bills').uploadBinary(
            storagePath,
            bytes,
            fileOptions: FileOptions(
              cacheControl: '3600',
              upsert: false,
              contentType: mimeType,
            ),
          );

      final publicUrl = _supabase.storage.from('expense-bills').getPublicUrl(storagePath);
      return (publicUrl: publicUrl, storagePath: storagePath, filename: imageFile.path.split('/').last, sizeBytes: bytes.length);
    } catch (e) {
      debugPrint('Receipt upload failed: $e');
      return null;
    }
  }

  // ── Save expense ──────────────────────────────────────────────────

  Future<void> _saveExpense() async {
    if (!_formKey.currentState!.validate()) return;

    final user = _supabase.auth.currentUser;
    if (user == null) {
      _showError('You must be logged in to save an expense.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      // Upload the receipt image if available
      ({String publicUrl, String storagePath, String filename, int sizeBytes})? uploadResult;
      if (_selectedImage != null) {
        uploadResult = await _uploadReceipt(_selectedImage!);
      }

      final amount = double.parse(_amountController.text.trim());
      final visitType = AppConstants.visitTypes[_visitTypeIndex].toLowerCase();
      final paymentMode = AppConstants.paymentModes[_paymentModeIndex]
          .toLowerCase()
          .replaceAll(' ', '_');

      // Combine category + subcategory like web app does (e.g., "Transportation - Cab")
      // When "Other" is selected and a custom name is provided, use the custom name
      final effectiveCategory = (_selectedCategory == 'Other' &&
              _customCategoryController.text.trim().isNotEmpty)
          ? _customCategoryController.text.trim()
          : _selectedCategory;
      final fullCategory = _selectedSubcategory != null && _selectedSubcategory!.isNotEmpty
          ? '$effectiveCategory - $_selectedSubcategory'
          : effectiveCategory;

      final data = <String, dynamic>{
        'user_id': user.id,
        'date': DateFormat('yyyy-MM-dd').format(_selectedDate),
        'category': fullCategory,
        'description': _descriptionController.text.trim().isEmpty
            ? 'N/A'
            : _descriptionController.text.trim(),
        'amount': amount,
        'vendor': _vendorController.text.trim().isEmpty
            ? 'N/A'
            : _vendorController.text.trim(),
        'visit_type': visitType,
        'payment_mode': paymentMode,
        'bill_attached': _selectedImage != null ? 'yes' : 'no',
      };

      final inserted = await _supabase.from('expenses').insert(data).select().single();

      // Save to expense_images junction table if receipt was uploaded
      if (uploadResult != null && inserted['id'] != null) {
        try {
          await _supabase.from('expense_images').insert({
            'expense_id': inserted['id'],
            'user_id': user.id,
            'storage_path': uploadResult.storagePath,
            'public_url': uploadResult.publicUrl,
            'filename': uploadResult.filename,
            'size_bytes': uploadResult.sizeBytes,
          });
        } catch (e) {
          debugPrint('Image upload failed: $e');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Note: Receipt saved but image upload failed'),
                backgroundColor: Color(0xFFF59E0B),
              ),
            );
          }
        }
      }

      if (!mounted) return;

      // Log activity
      final logAmount = _amountController.text.trim();
      final logVendor = _vendorController.text.trim().isNotEmpty
          ? _vendorController.text.trim()
          : (_selectedCategory ?? 'Unknown');
      ActivityLogService.log('expense_added', 'Added expense: \u20B9$logAmount for $logVendor');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Expense saved successfully',
                  style: TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
          backgroundColor: AppColors.statusActive,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );

      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      _showError('Failed to save expense: $e');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
            ),
          ],
        ),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: Colors.white.withAlpha(240),
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.onSurfaceVariant),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Scan Receipt',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
            letterSpacing: -0.02,
          ),
        ),
      ),
      body: _selectedImage == null ? _buildSourcePicker() : _buildScanResult(),
    );
  }

  // ── Source picker (initial state) ─────────────────────────────────

  Widget _buildSourcePicker() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Illustration
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(15),
                borderRadius: BorderRadius.circular(60),
              ),
              child: const Icon(
                Icons.document_scanner_outlined,
                size: 56,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 32),
            const Text(
              'Scan a Receipt',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurface,
                letterSpacing: -0.02,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Take a photo or choose from gallery.\nWe\'ll extract the details automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.onSurfaceVariant,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 40),

            // Camera button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withAlpha(64),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ElevatedButton.icon(
                  onPressed: () => _pickImage(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_rounded, size: 22),
                  label: const Text(
                    'Take Photo',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Gallery button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library_outlined, size: 22),
                label: const Text(
                  'Choose from Gallery',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.onSurface,
                  side: const BorderSide(color: AppColors.outlineVariant, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Scan result + editable form ───────────────────────────────────

  Widget _buildScanResult() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Image Preview ───────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.image_rounded, label: 'Receipt Image'),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 200,
                      child: Image.file(_selectedImage!, fit: BoxFit.cover),
                    ),
                    // Replace image button
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _miniButton(
                            icon: Icons.camera_alt_rounded,
                            onTap: () => _pickImage(ImageSource.camera),
                          ),
                          const SizedBox(width: 6),
                          _miniButton(
                            icon: Icons.photo_library_rounded,
                            onTap: () => _pickImage(ImageSource.gallery),
                          ),
                        ],
                      ),
                    ),
                    // Scanning overlay
                    if (_isScanning)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withAlpha(140),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 32,
                                height: 32,
                                child: CircularProgressIndicator(
                                  strokeWidth: 3,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Scanning...',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Extracting receipt details',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (_scanComplete && _rawText.isNotEmpty) ...[
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => _showRawText(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.statusActiveBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle_rounded,
                            size: 16, color: AppColors.statusActive),
                        SizedBox(width: 8),
                        Text(
                          'Scan complete  --  Tap to see raw text',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.statusActive,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (_scanComplete && _rawText.isEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.statusPendingBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline_rounded,
                          size: 16, color: AppColors.statusPending),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'No text detected. Please enter details manually.',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.statusPending,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),

          // ── Amount ──────────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.currency_rupee_rounded, label: 'Amount'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                      RegExp(r'^\d+\.?\d{0,2}')),
                ],
                decoration: InputDecoration(
                  hintText: '0.00',
                  prefixIcon: Container(
                    width: 44,
                    alignment: Alignment.center,
                    child: const Text(
                      '\u20B9',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Amount is required';
                  }
                  final parsed = double.tryParse(value.trim());
                  if (parsed == null || parsed <= 0) {
                    return 'Enter a valid amount';
                  }
                  if (parsed > AppConstants.maxExpenseAmount) {
                    return 'Amount exceeds maximum limit';
                  }
                  return null;
                },
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Date ────────────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.calendar_today_rounded, label: 'Date'),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickDate,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          size: 18, color: AppColors.primary),
                      const SizedBox(width: 12),
                      Text(
                        _dateController.text,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const Spacer(),
                      const Icon(Icons.arrow_drop_down_rounded,
                          color: AppColors.onSurfaceVariant),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Project (company mode) / Vendor (personal mode) ─
          _SectionCard(
            children: [
              _FieldLabel(
                  icon: Icons.store_rounded,
                  label: _isCompanyMode ? 'Project' : 'Vendor'),
              const SizedBox(height: 8),
              if (_isCompanyMode) ...[
                if (_projectsLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: LinearProgressIndicator(backgroundColor: Color(0xFFF3F4F6)),
                  )
                else
                  DropdownButtonFormField<String>(
                    value: _projects.any((p) => p['project_name'] == _selectedProject) ? _selectedProject : null,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      hintText: 'Select project',
                      prefixIcon: Icon(Icons.folder_outlined, color: Color(0xFF9CA3AF), size: 20),
                    ),
                    items: _projects.map((p) {
                      final name = p['project_name'] as String;
                      final code = p['project_code'] as String? ?? '';
                      return DropdownMenuItem<String>(
                        value: name,
                        child: Text(
                          code.isNotEmpty ? '$code — $name' : name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14),
                        ),
                      );
                    }).toList(),
                    onChanged: (value) => setState(() {
                      _selectedProject = value;
                      _vendorController.text = value ?? '';
                    }),
                    validator: (v) => (v == null || v.isEmpty) ? 'Please select a project' : null,
                  ),
              ] else
                TextFormField(
                  controller: _vendorController,
                  textInputAction: TextInputAction.done,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Uber, Swiggy, Amazon',
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Category ────────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.category_rounded, label: 'Category'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: _inputDeco('Select category'),
                isExpanded: true,
                items: ExpenseCategories.all.map((cat) {
                  return DropdownMenuItem(
                    value: cat.name,
                    child: Row(
                      children: [
                        Icon(cat.icon, size: 18, color: cat.color),
                        const SizedBox(width: 10),
                        Text(cat.name),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedCategory = value;
                    _selectedSubcategory = null;
                  });
                },
                validator: (value) =>
                    value == null ? 'Category is required' : null,
              ),
              // Subcategory
              if (_selectedCategory != null &&
                  ExpenseCategories.subcategoriesFor(_selectedCategory!)
                      .isNotEmpty) ...[
                const SizedBox(height: 16),
                const _FieldLabel(
                  icon: Icons.subdirectory_arrow_right_rounded,
                  label: 'Subcategory',
                ),
                const SizedBox(height: 8),
                Builder(builder: (context) {
                  final subcategories = ExpenseCategories
                      .subcategoriesFor(_selectedCategory!)
                      .toSet()
                      .toList();
                  // Reset selected value if it doesn't exist in the list
                  final effectiveValue =
                      subcategories.contains(_selectedSubcategory)
                          ? _selectedSubcategory
                          : null;
                  return DropdownButtonFormField<String>(
                    value: effectiveValue,
                    decoration: _inputDeco('Select subcategory'),
                    isExpanded: true,
                    items: subcategories.map((sub) {
                      return DropdownMenuItem(value: sub, child: Text(sub));
                    }).toList(),
                    onChanged: (value) =>
                        setState(() => _selectedSubcategory = value),
                  );
                }),
              ],

              // Custom category name — visible when "Other" is selected
              if (_selectedCategory == 'Other') ...[
                const SizedBox(height: 16),
                const _FieldLabel(
                  icon: Icons.edit_rounded,
                  label: 'Custom Category Name',
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _customCategoryController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'Enter custom category name',
                  ),
                  validator: (value) {
                    if (_selectedCategory == 'Other' &&
                        (value == null || value.trim().isEmpty)) {
                      return 'Please enter a custom category name';
                    }
                    return null;
                  },
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),

          // ── Description ─────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.notes_rounded, label: 'Description'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descriptionController,
                maxLines: 3,
                maxLength: AppConstants.maxDescriptionLength,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: 'What was this expense for?',
                  counterText: '',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Payment Mode ────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.payment_rounded, label: 'Payment Mode'),
              const SizedBox(height: 10),
              _SegmentToggle(
                labels: AppConstants.paymentModes,
                selectedIndex: _paymentModeIndex,
                onChanged: (i) => setState(() => _paymentModeIndex = i),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Visit Type ──────────────────────────────────────
          _SectionCard(
            children: [
              const _FieldLabel(
                  icon: Icons.work_outline_rounded, label: 'Visit Type'),
              const SizedBox(height: 10),
              _SegmentToggle(
                labels: AppConstants.visitTypes,
                selectedIndex: _visitTypeIndex,
                onChanged: (i) => setState(() => _visitTypeIndex = i),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // ── Save Button ─────────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 52,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: _isSaving
                    ? null
                    : const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                color:
                    _isSaving ? AppColors.onSurface.withAlpha(31) : null,
                borderRadius: BorderRadius.circular(12),
                boxShadow: _isSaving
                    ? null
                    : [
                        BoxShadow(
                          color: AppColors.primary.withAlpha(64),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
              ),
              child: ElevatedButton(
                onPressed: (_isSaving || _isScanning) ? null : _saveExpense,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Save Expense',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────

  Widget _miniButton({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.black.withAlpha(140),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  void _showRawText() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.85,
        expand: false,
        builder: (_, controller) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Extracted Text',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  controller: controller,
                  child: Text(
                    _rawText,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.onSurfaceVariant,
                      height: 1.6,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String hint) {
    return InputDecoration(
      hintText: hint,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Private helper widgets (same style as AddExpenseScreen)
// ═══════════════════════════════════════════════════════════════════════════

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow.withAlpha(10),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.onSurface,
          ),
        ),
      ],
    );
  }
}

class _SegmentToggle extends StatelessWidget {
  const _SegmentToggle({
    required this.labels,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: List.generate(labels.length, (i) {
          final isSelected = i == selectedIndex;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withAlpha(50),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    color: isSelected
                        ? Colors.white
                        : AppColors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
