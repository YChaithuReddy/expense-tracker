import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/categories.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/activity_log_service.dart';
import '../../../services/distance_service.dart';

/// Full expense entry form screen.
///
/// Supports both creating a new expense and editing an existing one.
/// Pass [existingExpense] as a Supabase row map to pre-fill the form
/// for editing.
class AddExpenseScreen extends StatefulWidget {
  /// When non-null the form is in edit mode with pre-filled data.
  final Map<String, dynamic>? existingExpense;

  const AddExpenseScreen({super.key, this.existingExpense});

  @override
  State<AddExpenseScreen> createState() => _AddExpenseScreenState();
}

class _AddExpenseScreenState extends State<AddExpenseScreen> {
  final _formKey = GlobalKey<FormState>();
  final _supabase = Supabase.instance.client;

  // ── Controllers ──────────────────────────────────────────────────────
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  final _vendorController = TextEditingController();
  final _fromLocationController = TextEditingController();
  final _toLocationController = TextEditingController();
  final _kilometersController = TextEditingController();
  final _modeOfExpenseController = TextEditingController();
  final _customCategoryController = TextEditingController();

  // ── Form state ───────────────────────────────────────────────────────
  late DateTime _selectedDate;
  String? _selectedCategory;
  String? _selectedSubcategory;
  int _visitTypeIndex = 0; // 0=Project, 1=Service, 2=Survey
  int _paymentModeIndex = 0; // 0=Cash, 1=Bank Transfer, 2=UPI
  bool _billAttached = false;
  File? _selectedImage;
  String? _existingImageUrl;
  bool _isSaving = false;
  bool _calculatingDistance = false;

  Future<void> _calculateDistance() async {
    final from = _fromLocationController.text.trim();
    final to = _toLocationController.text.trim();
    if (from.isEmpty || to.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill both From and To locations first'),
            backgroundColor: Color(0xFFF59E0B)),
      );
      return;
    }
    setState(() => _calculatingDistance = true);
    final km = await DistanceService.calculateDistance(from, to);
    if (!mounted) return;
    setState(() => _calculatingDistance = false);
    if (km != null) {
      setState(() => _kilometersController.text = km.toString());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Distance: $km km'), backgroundColor: const Color(0xFF059669)),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not calculate distance. Please enter manually.'),
            backgroundColor: Color(0xFFBA1A1A)),
      );
    }
  }

  // Project dropdown (company mode only)
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

  bool get _isEditing => widget.existingExpense != null;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _loadProjects();

    if (_isEditing) {
      _prefillForm(widget.existingExpense!);
      _loadExistingImage(widget.existingExpense!['id'] as String);
    }
  }

  /// Loads the first image from the expense_images junction table.
  Future<void> _loadExistingImage(String expenseId) async {
    try {
      final rows = await _supabase
          .from('expense_images')
          .select('public_url')
          .eq('expense_id', expenseId)
          .limit(1);
      if (rows.isNotEmpty && mounted) {
        setState(() {
          _existingImageUrl = rows[0]['public_url'] as String?;
        });
      }
    } catch (e) {
      debugPrint('Failed to load existing image: $e');
    }
  }

  void _prefillForm(Map<String, dynamic> expense) {
    // Date
    _selectedDate =
        DateTime.tryParse(expense['date']?.toString() ?? '') ?? DateTime.now();

    // Category & subcategory — parse from combined string (e.g. "Transportation - Cab")
    final catStr = expense['category'] as String? ?? '';
    if (catStr.contains(' - ')) {
      final parts = catStr.split(' - ');
      final mainCat = parts[0].trim();
      // Check if the main category exists in our known categories
      if (ExpenseCategories.names.contains(mainCat)) {
        _selectedCategory = mainCat;
      } else {
        // Custom category — set to "Other" and pre-fill custom name
        _selectedCategory = 'Other';
        _customCategoryController.text = mainCat;
      }
      _selectedSubcategory = parts[1].trim();
    } else {
      if (catStr.isNotEmpty && ExpenseCategories.names.contains(catStr)) {
        _selectedCategory = catStr;
      } else if (catStr.isNotEmpty) {
        // Custom category — set to "Other" and pre-fill custom name
        _selectedCategory = 'Other';
        _customCategoryController.text = catStr;
      } else {
        _selectedCategory = null;
      }
      _selectedSubcategory = null;
    }

    // Text fields
    _descriptionController.text = (expense['description'] as String?) ?? '';
    _vendorController.text = (expense['vendor'] as String?) ?? '';
    _selectedProject = expense['vendor'] as String?;
    _fromLocationController.text = (expense['from_location'] as String?) ?? '';
    _toLocationController.text = (expense['to_location'] as String?) ?? '';
    _modeOfExpenseController.text = (expense['mode_of_expense'] as String?) ?? '';
    if (expense['kilometers'] != null) {
      _kilometersController.text = expense['kilometers'].toString();
    }

    // Amount — handle both num and String from Supabase
    if (expense['amount'] is num) {
      _amountController.text = (expense['amount'] as num).toString();
    } else if (expense['amount'] != null) {
      _amountController.text = expense['amount'].toString();
    }

    // Receipt — images are stored in expense_images table, not on expense row
    _billAttached = (expense['bill_attached'] as String?) == 'yes';

    // Visit type
    final visitType =
        (expense['visit_type'] as String?)?.toLowerCase() ?? 'project';
    _visitTypeIndex = switch (visitType) {
      'service' => 1,
      'survey' => 2,
      _ => 0,
    };

    // Payment mode
    final paymentMode =
        (expense['payment_mode'] as String?)?.toLowerCase() ?? 'cash';
    _paymentModeIndex = switch (paymentMode) {
      'bank_transfer' || 'bank transfer' => 1,
      'upi' => 2,
      _ => 0,
    };
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    _vendorController.dispose();
    _fromLocationController.dispose();
    _toLocationController.dispose();
    _kilometersController.dispose();
    _modeOfExpenseController.dispose();
    _customCategoryController.dispose();
    super.dispose();
  }

  // ── Date Picker ──────────────────────────────────────────────────────
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
      setState(() => _selectedDate = picked);
    }
  }

  // ── Image Picker ─────────────────────────────────────────────────────
  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Upload Receipt',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.camera_alt_rounded,
                      color: AppColors.primary),
                ),
                title: const Text('Camera',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text(
                  'Take a photo of your receipt',
                  style: TextStyle(
                      fontSize: 12, color: AppColors.onSurfaceVariant),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.statusReimbursed.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.photo_library_rounded,
                      color: AppColors.statusReimbursed),
                ),
                title: const Text('Gallery',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text(
                  'Choose an existing image',
                  style: TextStyle(
                      fontSize: 12, color: AppColors.onSurfaceVariant),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: source,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 85,
    );

    if (pickedFile != null) {
      setState(() {
        _selectedImage = File(pickedFile.path);
        _billAttached = true;
      });
    }
  }

  // ── Save / Update Expense ────────────────────────────────────────────
  Future<void> _saveExpense() async {
    if (!_formKey.currentState!.validate()) return;

    final user = _supabase.auth.currentUser;
    if (user == null) {
      _showError('You must be logged in to save an expense.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final amount = double.parse(_amountController.text.trim());
      final visitType = AppConstants.visitTypes[_visitTypeIndex].toLowerCase();
      final paymentMode = AppConstants.paymentModes[_paymentModeIndex]
          .toLowerCase()
          .replaceAll(' ', '_');

      // Combine category + subcategory like web app (e.g., "Transportation - Cab")
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
        'bill_attached': _billAttached ? 'yes' : 'no',
        // Travel fields (null for non-travel categories)
        if (_fromLocationController.text.trim().isNotEmpty) 'from_location': _fromLocationController.text.trim(),
        if (_toLocationController.text.trim().isNotEmpty) 'to_location': _toLocationController.text.trim(),
        if (_kilometersController.text.trim().isNotEmpty) 'kilometers': double.tryParse(_kilometersController.text.trim()),
        if (_modeOfExpenseController.text.trim().isNotEmpty) 'mode_of_expense': _modeOfExpenseController.text.trim(),
      };

      String? expenseId;

      if (_isEditing) {
        expenseId = widget.existingExpense!['id'] as String;
        data['updated_at'] = DateTime.now().toIso8601String();
        await _supabase.from('expenses').update(data).eq('id', expenseId);
      } else {
        final inserted = await _supabase
            .from('expenses')
            .insert(data)
            .select('id')
            .single();
        expenseId = inserted['id'] as String;
      }

      // Upload new image and save to expense_images junction table
      if (_selectedImage != null) {
        try {
          final ext = _selectedImage!.path.split('.').last.toLowerCase();
          final fileName =
              '${user.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';

          await _supabase.storage.from('expense-bills').upload(
                fileName,
                _selectedImage!,
                fileOptions: const FileOptions(
                  cacheControl: '3600',
                  upsert: false,
                ),
              );

          final publicUrl = _supabase.storage
              .from('expense-bills')
              .getPublicUrl(fileName);

          await _supabase.from('expense_images').insert({
            'expense_id': expenseId,
            'public_url': publicUrl,
            'storage_path': fileName,
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
      ActivityLogService.log(
        _isEditing ? 'expense_updated' : 'expense_added',
        _isEditing ? 'Updated expense manually' : 'Added expense manually',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(
                _isEditing
                    ? 'Expense updated successfully'
                    : 'Expense saved successfully',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ],
          ),
          backgroundColor: AppColors.statusActive,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );

      Navigator.pop(context, true); // true signals a successful save
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
            const Icon(Icons.error_outline_rounded,
                color: Colors.white, size: 20),
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

  // ── Build ────────────────────────────────────────────────────────────
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
        title: Text(
          _isEditing ? 'Edit Expense' : 'Add Expense',
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
            letterSpacing: -0.02,
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
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
                          DateFormat(AppConstants.dateFormat)
                              .format(_selectedDate),
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

            // ── Category & Subcategory ──────────────────────────
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

                // Subcategory — visible only when category has subcategories
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
                        return DropdownMenuItem(
                            value: sub, child: Text(sub));
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
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      hintText: 'Enter vendor name',
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // ── Travel Fields (only for Travel category) ────────
            if (AppConstants.isTravelCategory(_selectedCategory)) ...[
              _SectionCard(
                children: [
                  const _FieldLabel(icon: Icons.directions_car, label: 'Mode of Transport'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _modeOfExpenseController,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Rapido, Personal Car, Auto'),
                  ),
                  const SizedBox(height: 14),
                  const _FieldLabel(icon: Icons.my_location, label: 'From Location'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _fromLocationController,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Office, Home'),
                  ),
                  const SizedBox(height: 14),
                  const _FieldLabel(icon: Icons.location_on, label: 'To Location'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _toLocationController,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'e.g. Client site, Event venue'),
                  ),
                  const SizedBox(height: 14),
                  const _FieldLabel(icon: Icons.straighten, label: 'Kilometers'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _kilometersController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(hintText: 'Distance in KM', suffixText: 'km'),
                  ),
                  const SizedBox(height: 10),
                  // Auto-calculate button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _calculatingDistance ? null : _calculateDistance,
                      icon: _calculatingDistance
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.map_outlined, size: 18),
                      label: Text(_calculatingDistance ? 'Calculating...' : 'Auto-calculate from Map'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF006699),
                        side: const BorderSide(color: Color(0xFF006699)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],

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

            // ── Bill Attached + Image Upload ────────────────────
            _SectionCard(
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt_long_rounded,
                        size: 18, color: AppColors.primary),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Bill Attached',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onSurface,
                        ),
                      ),
                    ),
                    Switch.adaptive(
                      value: _billAttached,
                      activeColor: AppColors.primary,
                      onChanged: (val) =>
                          setState(() => _billAttached = val),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: _pickImage,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: double.infinity,
                    height: (_selectedImage != null ||
                            _existingImageUrl != null)
                        ? 200
                        : 100,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.outlineVariant.withAlpha(120),
                        width: 1.5,
                        strokeAlign: BorderSide.strokeAlignInside,
                      ),
                    ),
                    child: _buildImageContent(),
                  ),
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
                  color: _isSaving
                      ? AppColors.onSurface.withAlpha(31)
                      : null,
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
                  onPressed: _isSaving ? null : _saveExpense,
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
                      : Text(
                          _isEditing ? 'Update Expense' : 'Save Expense',
                          style: const TextStyle(
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
      ),
    );
  }

  // ── Helper: Image content builder ────────────────────────────────────
  Widget _buildImageContent() {
    if (_selectedImage != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.file(_selectedImage!, fit: BoxFit.cover),
            Positioned(
              top: 8,
              right: 8,
              child: GestureDetector(
                onTap: () => setState(() => _selectedImage = null),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(140),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: Colors.white, size: 18),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_existingImageUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(_existingImageUrl!, fit: BoxFit.cover),
            Positioned(
              bottom: 8,
              left: 8,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(140),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Tap to replace',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Empty state
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.cloud_upload_outlined,
            size: 32, color: AppColors.onSurfaceVariant.withAlpha(140)),
        const SizedBox(height: 8),
        const Text(
          'Tap to upload receipt',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'Camera or Gallery',
          style: TextStyle(
            fontSize: 11,
            color: AppColors.onSurfaceVariant.withAlpha(140),
          ),
        ),
      ],
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
// Private helper widgets
// ═══════════════════════════════════════════════════════════════════════════

/// White card wrapper for each form section.
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

/// Icon + label row displayed above each form field.
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

/// Three-segment toggle used for Visit Type and Payment Mode.
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
                  color:
                      isSelected ? AppColors.primary : Colors.transparent,
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
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.w500,
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
