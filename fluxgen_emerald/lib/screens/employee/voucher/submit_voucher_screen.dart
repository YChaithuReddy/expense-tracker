import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../services/activity_log_service.dart';

/// Multi-step voucher submission screen (3 steps).
///
/// Step 1: Select expenses to bundle
/// Step 2: Choose manager & accountant, set period & notes
/// Step 3: Review & submit
class SubmitVoucherScreen extends StatefulWidget {
  const SubmitVoucherScreen({super.key});

  @override
  State<SubmitVoucherScreen> createState() => _SubmitVoucherScreenState();
}

class _SubmitVoucherScreenState extends State<SubmitVoucherScreen> {
  // ── State ──────────────────────────────────────────────────────────────
  int _currentStep = 0;
  bool _loading = true;
  bool _submitting = false;

  // Step 1 — Expenses
  List<Map<String, dynamic>> _expenses = [];
  final Set<String> _selectedExpenseIds = {};

  // Step 2 — Manager & Accountant
  List<Map<String, dynamic>> _managers = [];
  List<Map<String, dynamic>> _accountants = [];
  String? _selectedManagerId;
  String? _selectedAccountantId;
  DateTime? _periodFrom;
  DateTime? _periodTo;
  final _notesController = TextEditingController();

  // Step 3 — Confirmation
  bool _declarationChecked = false;

  // User context
  String? _userId;
  String? _organizationId;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  // ── Data Loading ───────────────────────────────────────────────────────

  Future<void> _loadInitialData() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;
      _userId = user.id;

      // Fetch profile to get organization_id
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      _organizationId = profile?['organization_id'] as String?;

      if (_organizationId == null) {
        if (mounted) {
          setState(() => _loading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('You must be part of an organization to submit vouchers.'),
              backgroundColor: Color(0xFFBA1A1A),
            ),
          );
        }
        return;
      }

      // Fetch eligible expenses: user's expenses with null or rejected voucherStatus
      final expenses = await Supabase.instance.client
          .from('expenses')
          .select()
          .eq('user_id', user.id)
          .or('voucher_status.is.null,voucher_status.eq.rejected')
          .order('date', ascending: false);

      // Fetch managers in the same organization
      final managers = await Supabase.instance.client
          .from('profiles')
          .select('id, name, email, employee_id')
          .eq('organization_id', _organizationId!)
          .eq('role', 'manager');

      // Fetch accountants in the same organization
      final accountants = await Supabase.instance.client
          .from('profiles')
          .select('id, name, email, employee_id')
          .eq('organization_id', _organizationId!)
          .eq('role', 'accountant');

      if (mounted) {
        setState(() {
          _expenses = List<Map<String, dynamic>>.from(expenses);
          _managers = List<Map<String, dynamic>>.from(managers);
          _accountants = List<Map<String, dynamic>>.from(accountants);
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('SubmitVoucherScreen load error: $e');
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load data: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  // ── Computed Properties ────────────────────────────────────────────────

  double get _totalAmount {
    double total = 0;
    for (final e in _expenses) {
      if (_selectedExpenseIds.contains(e['id'])) {
        total += (e['amount'] as num?)?.toDouble() ?? 0;
      }
    }
    return total;
  }

  int get _selectedCount => _selectedExpenseIds.length;

  bool get _allSelected =>
      _expenses.isNotEmpty && _selectedExpenseIds.length == _expenses.length;

  String? get _selectedManagerName {
    if (_selectedManagerId == null) return null;
    final m = _managers.firstWhere(
      (m) => m['id'] == _selectedManagerId,
      orElse: () => <String, dynamic>{},
    );
    return m['name'] as String? ?? m['email'] as String? ?? 'Unknown';
  }

  String? get _selectedAccountantName {
    if (_selectedAccountantId == null) return null;
    final a = _accountants.firstWhere(
      (a) => a['id'] == _selectedAccountantId,
      orElse: () => <String, dynamic>{},
    );
    return a['name'] as String? ?? a['email'] as String? ?? 'Unknown';
  }

  // ── Actions ────────────────────────────────────────────────────────────

  void _toggleSelectAll() {
    setState(() {
      if (_allSelected) {
        _selectedExpenseIds.clear();
      } else {
        _selectedExpenseIds.addAll(_expenses.map((e) => e['id'] as String));
      }
    });
  }

  void _toggleExpense(String id) {
    setState(() {
      if (_selectedExpenseIds.contains(id)) {
        _selectedExpenseIds.remove(id);
      } else {
        _selectedExpenseIds.add(id);
      }
    });
  }

  bool _canProceedFromStep(int step) {
    switch (step) {
      case 0:
        return _selectedCount > 0;
      case 1:
        return _selectedManagerId != null && _selectedAccountantId != null;
      case 2:
        return _declarationChecked;
      default:
        return false;
    }
  }

  void _nextStep() {
    if (_currentStep < 2 && _canProceedFromStep(_currentStep)) {
      setState(() => _currentStep++);
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final initialDate = isFrom
        ? (_periodFrom ?? DateTime.now().subtract(const Duration(days: 30)))
        : (_periodTo ?? DateTime.now());

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: Color(0xFF006699)),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        if (isFrom) {
          _periodFrom = picked;
        } else {
          _periodTo = picked;
        }
      });
    }
  }

  Future<void> _submitVoucher() async {
    if (_submitting) return;
    if (_userId == null || _organizationId == null) return;

    setState(() => _submitting = true);

    try {
      final supabase = Supabase.instance.client;
      final voucherNumber = 'VCH-${DateTime.now().millisecondsSinceEpoch}';
      final expenseIds = _selectedExpenseIds.toList();
      final now = DateTime.now().toIso8601String();

      // a. Insert voucher
      final insertData = <String, dynamic>{
        'organization_id': _organizationId,
        'submitted_by': _userId,
        'voucher_number': voucherNumber,
        'status': 'pending_manager',
        'manager_id': _selectedManagerId,
        'accountant_id': _selectedAccountantId,
        'total_amount': _totalAmount,
        'expense_count': expenseIds.length,
        'submitted_at': now,
      };

      if (_notesController.text.trim().isNotEmpty) {
        insertData['notes'] = _notesController.text.trim();
      }

      // Build purpose from period dates
      if (_periodFrom != null || _periodTo != null) {
        final fromStr = _periodFrom != null
            ? DateFormat('dd MMM yyyy').format(_periodFrom!)
            : 'Start';
        final toStr = _periodTo != null
            ? DateFormat('dd MMM yyyy').format(_periodTo!)
            : 'Present';
        insertData['purpose'] = 'Expense period: $fromStr - $toStr';
      }

      final voucherRow = await supabase
          .from('vouchers')
          .insert(insertData)
          .select()
          .single();

      final voucherId = voucherRow['id'] as String;

      // b. Insert voucher_expenses junction rows
      final links = expenseIds
          .map((eid) => {'voucher_id': voucherId, 'expense_id': eid})
          .toList();

      try {
        await supabase.from('voucher_expenses').insert(links);
      } catch (e) {
        debugPrint('voucher_expenses link error (non-fatal): $e');
      }

      // c. Update each expense voucherStatus
      try {
        await supabase
            .from('expenses')
            .update({'voucher_status': 'submitted'})
            .inFilter('id', expenseIds)
            .eq('user_id', _userId!);
      } catch (e) {
        debugPrint('expense voucher_status update warning: $e');
      }

      // d. Insert voucher_history
      try {
        await supabase.from('voucher_history').insert({
          'voucher_id': voucherId,
          'action': 'submitted',
          'acted_by': _userId,
          'previous_status': 'draft',
          'new_status': 'pending_manager',
          'comments': _notesController.text.trim().isNotEmpty
              ? _notesController.text.trim()
              : 'Voucher submitted for approval',
        });
      } catch (e) {
        debugPrint('voucher_history insert warning: $e');
      }

      if (mounted) {
        // Log activity
        ActivityLogService.log('voucher_submitted', 'Submitted voucher $voucherNumber');

        // Notify the manager
        if (_selectedManagerId != null) {
          try {
            await Supabase.instance.client.from('notifications').insert({
              'user_id': _selectedManagerId,
              'type': 'voucher_submitted',
              'title': 'New voucher to approve',
              'message': 'A voucher of \u20B9${_totalAmount.toStringAsFixed(0)} needs your approval.',
              'is_read': false,
              'reference_id': voucherId,
              'reference_type': 'voucher',
            });
          } catch (_) {}
        }

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Voucher $voucherNumber submitted successfully!'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      debugPrint('submitVoucher error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit voucher: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────

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
          onPressed: () {
            if (_currentStep > 0) {
              _previousStep();
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
        title: const Text(
          'Submit Voucher',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
            letterSpacing: -0.02,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF006699)))
          : Column(
              children: [
                _buildStepIndicator(),
                Expanded(child: _buildCurrentStep()),
              ],
            ),
    );
  }

  // ── Step Indicator ─────────────────────────────────────────────────────

  Widget _buildStepIndicator() {
    final labels = ['Select', 'Assign', 'Review'];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
      child: Column(
        children: [
          Row(
            children: List.generate(3, (i) {
              final isActive = i == _currentStep;
              final isDone = i < _currentStep;
              return Expanded(
                child: Row(
                  children: [
                    if (i > 0)
                      Expanded(
                        child: Container(
                          height: 2,
                          color: isDone
                              ? const Color(0xFF006699)
                              : const Color(0xFFE5E7EB),
                        ),
                      ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDone
                            ? const Color(0xFF006699)
                            : isActive
                                ? const Color(0xFF006699)
                                : const Color(0xFFE5E7EB),
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check, color: Colors.white, size: 16)
                            : Text(
                                '${i + 1}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: isActive
                                      ? Colors.white
                                      : const Color(0xFF9CA3AF),
                                ),
                              ),
                      ),
                    ),
                    if (i < 2)
                      Expanded(
                        child: Container(
                          height: 2,
                          color: i < _currentStep
                              ? const Color(0xFF006699)
                              : const Color(0xFFE5E7EB),
                        ),
                      ),
                  ],
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(3, (i) {
              final isActive = i == _currentStep;
              return Expanded(
                child: Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive
                        ? const Color(0xFF006699)
                        : const Color(0xFF9CA3AF),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // ── Step Builders ──────────────────────────────────────────────────────

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case 0:
        return _buildStep1SelectExpenses();
      case 1:
        return _buildStep2ChooseApprovers();
      case 2:
        return _buildStep3ReviewSubmit();
      default:
        return const SizedBox.shrink();
    }
  }

  // ── Step 1: Select Expenses ────────────────────────────────────────────

  Widget _buildStep1SelectExpenses() {
    return Column(
      children: [
        Expanded(
          child: _expenses.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.receipt_long_outlined,
                            size: 56, color: Color(0xFF9CA3AF)),
                        const SizedBox(height: 12),
                        const Text(
                          'No eligible expenses',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'All expenses are already submitted or there are no expenses to submit.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  itemCount: _expenses.length + 1, // +1 for Select All
                  itemBuilder: (context, index) {
                    // Select All toggle
                    if (index == 0) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF006699).withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFF006699).withValues(alpha: 0.2),
                          ),
                        ),
                        child: CheckboxListTile(
                          value: _allSelected,
                          onChanged: (_) => _toggleSelectAll(),
                          title: Text(
                            'Select All (${_expenses.length} expenses)',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF006699),
                            ),
                          ),
                          activeColor: const Color(0xFF006699),
                          controlAffinity: ListTileControlAffinity.leading,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 0,
                          ),
                        ),
                      );
                    }

                    final expense = _expenses[index - 1];
                    final id = expense['id'] as String;
                    final isSelected = _selectedExpenseIds.contains(id);
                    final vendor = expense['vendor'] as String? ??
                        expense['description'] as String? ??
                        'N/A';
                    final amount =
                        (expense['amount'] as num?)?.toDouble() ?? 0;
                    final category = expense['category'] as String? ?? 'Other';
                    final date = expense['date'] as String? ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF006699).withValues(alpha: 0.4)
                              : const Color(0xFFE5E7EB),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: CheckboxListTile(
                        value: isSelected,
                        onChanged: (_) => _toggleExpense(id),
                        activeColor: const Color(0xFF006699),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        title: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    vendor,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF191C1E),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '$category  |  $date',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF9CA3AF),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '\u20B9${amount.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF191C1E),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        // Bottom bar
        _buildBottomBar(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$_selectedCount expense${_selectedCount == 1 ? '' : 's'} selected',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '\u20B9${_totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF191C1E),
                      ),
                    ),
                  ],
                ),
              ),
              _buildGradientButton(
                label: 'Next',
                icon: Icons.arrow_forward,
                enabled: _canProceedFromStep(0),
                onPressed: _nextStep,
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Step 2: Choose Manager & Accountant ────────────────────────────────

  Widget _buildStep2ChooseApprovers() {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Manager dropdown
                _buildSectionLabel('Reporting Manager *'),
                const SizedBox(height: 8),
                _buildDropdownCard(
                  hint: 'Select a manager',
                  value: _selectedManagerId,
                  items: _managers,
                  onChanged: (val) => setState(() => _selectedManagerId = val),
                  emptyMessage: 'No managers found in your organization',
                ),
                const SizedBox(height: 20),

                // Accountant dropdown
                _buildSectionLabel('Accountant *'),
                const SizedBox(height: 8),
                _buildDropdownCard(
                  hint: 'Select an accountant',
                  value: _selectedAccountantId,
                  items: _accountants,
                  onChanged: (val) =>
                      setState(() => _selectedAccountantId = val),
                  emptyMessage: 'No accountants found in your organization',
                ),
                const SizedBox(height: 20),

                // Expense Period
                _buildSectionLabel('Expense Period'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildDatePickerCard(
                        label: 'From',
                        date: _periodFrom,
                        onTap: () => _pickDate(isFrom: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildDatePickerCard(
                        label: 'To',
                        date: _periodTo,
                        onTap: () => _pickDate(isFrom: false),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Notes
                _buildSectionLabel('Notes (Optional)'),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: TextField(
                    controller: _notesController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Add any notes for the reviewer...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF9CA3AF),
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.all(16),
                    ),
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        _buildBottomBar(
          child: Row(
            children: [
              OutlinedButton(
                onPressed: _previousStep,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF444653),
                  side: const BorderSide(color: Color(0xFFE5E7EB)),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildGradientButton(
                  label: 'Next',
                  icon: Icons.arrow_forward,
                  enabled: _canProceedFromStep(1),
                  onPressed: _nextStep,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Step 3: Review & Submit ────────────────────────────────────────────

  Widget _buildStep3ReviewSubmit() {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Voucher Summary',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF191C1E),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildSummaryRow(
                        icon: Icons.receipt_long,
                        label: 'Expenses',
                        value:
                            '$_selectedCount expense${_selectedCount == 1 ? '' : 's'}',
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryRow(
                        icon: Icons.currency_rupee,
                        label: 'Total Amount',
                        value: '\u20B9${_totalAmount.toStringAsFixed(2)}',
                        valueStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF006699),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryRow(
                        icon: Icons.person,
                        label: 'Manager',
                        value: _selectedManagerName ?? 'Not selected',
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryRow(
                        icon: Icons.account_balance,
                        label: 'Accountant',
                        value: _selectedAccountantName ?? 'Not selected',
                      ),
                      if (_periodFrom != null || _periodTo != null) ...[
                        const SizedBox(height: 12),
                        _buildSummaryRow(
                          icon: Icons.date_range,
                          label: 'Period',
                          value:
                              '${_periodFrom != null ? DateFormat('dd MMM').format(_periodFrom!) : 'Start'} - ${_periodTo != null ? DateFormat('dd MMM').format(_periodTo!) : 'Present'}',
                        ),
                      ],
                      if (_notesController.text.trim().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _buildSummaryRow(
                          icon: Icons.notes,
                          label: 'Notes',
                          value: _notesController.text.trim(),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Declaration checkbox
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _declarationChecked
                          ? const Color(0xFF006699).withValues(alpha: 0.4)
                          : const Color(0xFFE5E7EB),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _declarationChecked,
                          onChanged: (val) =>
                              setState(() => _declarationChecked = val ?? false),
                          activeColor: const Color(0xFF006699),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'I confirm that all the expenses listed above are valid and incurred for official business purposes.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF444653),
                            height: 1.5,
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
        _buildBottomBar(
          child: Row(
            children: [
              OutlinedButton(
                onPressed: _previousStep,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF444653),
                  side: const BorderSide(color: Color(0xFFE5E7EB)),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildGradientButton(
                  label: _submitting ? 'Submitting...' : 'Submit Voucher',
                  icon: Icons.send,
                  enabled: _canProceedFromStep(2) && !_submitting,
                  onPressed: _submitVoucher,
                  showSpinner: _submitting,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Reusable Widgets ───────────────────────────────────────────────────

  Widget _buildBottomBar({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: Colors.grey.shade200, width: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(top: false, child: child),
    );
  }

  Widget _buildGradientButton({
    required String label,
    required IconData icon,
    required bool enabled,
    required VoidCallback onPressed,
    bool showSpinner = false,
  }) {
    return SizedBox(
      height: 48,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: enabled
              ? const LinearGradient(
                  colors: [Color(0xFF006699), Color(0xFF00288E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: enabled ? null : const Color(0xFFE5E7EB),
          borderRadius: BorderRadius.circular(12),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: const Color(0xFF006699).withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: ElevatedButton.icon(
          onPressed: enabled ? onPressed : null,
          icon: showSpinner
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(icon, size: 18),
          label: Text(
            label,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: enabled ? Colors.white : const Color(0xFF9CA3AF),
            disabledForegroundColor: const Color(0xFF9CA3AF),
            disabledBackgroundColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Color(0xFF444653),
      ),
    );
  }

  Widget _buildDropdownCard({
    required String hint,
    required String? value,
    required List<Map<String, dynamic>> items,
    required ValueChanged<String?> onChanged,
    required String emptyMessage,
  }) {
    if (items.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Text(
          emptyMessage,
          style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(
            hint,
            style: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
          ),
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF9CA3AF)),
          items: items.map((item) {
            final id = item['id'] as String;
            final name = item['name'] as String? ?? item['email'] as String? ?? 'Unknown';
            final employeeId = item['employee_id'] as String?;
            return DropdownMenuItem<String>(
              value: id,
              child: Text(
                employeeId != null && employeeId.isNotEmpty
                    ? '$name ($employeeId)'
                    : name,
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF191C1E),
                  fontWeight: FontWeight.w500,
                ),
              ),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildDatePickerCard({
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today, size: 18, color: Color(0xFF9CA3AF)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9CA3AF),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    date != null
                        ? DateFormat('dd MMM yyyy').format(date)
                        : 'Pick date',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: date != null
                          ? const Color(0xFF191C1E)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow({
    required IconData icon,
    required String label,
    required String value,
    TextStyle? valueStyle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF9CA3AF)),
        const SizedBox(width: 12),
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF9CA3AF),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: valueStyle ??
                const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
          ),
        ),
      ],
    );
  }
}
