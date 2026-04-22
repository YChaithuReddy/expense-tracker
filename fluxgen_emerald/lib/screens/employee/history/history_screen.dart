import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/models/expense.dart';
import 'package:emerald/models/project.dart';
import 'package:emerald/core/constants/categories.dart';
import 'package:emerald/screens/employee/expenses/expense_detail_screen.dart';
import 'package:emerald/services/excel_export_service.dart';
import 'package:emerald/services/google_sheets_service.dart';
import 'package:emerald/widgets/notification_bell.dart';

/// Expense History screen — matches the Stitch "History" design.
///
/// Loads real expenses from Supabase, supports search filtering,
/// category/visit-type/project filters, and navigates to expense detail on tap.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _searchController = TextEditingController();
  int _selectedFilterIndex = 0;
  int _currentPage = 1;
  bool _selectAll = false;
  final Set<String> _selectedIds = {};
  bool _isDeleting = false;

  // Real data
  List<Expense> _allExpenses = [];
  bool _isLoading = true;
  String? _error;
  int _totalCount = 0;
  double _totalAmount = 0;
  double _thisMonthTotal = 0;

  // Filter state
  String? _selectedCategory;
  String? _selectedVisitType;
  String? _selectedProjectId;
  String? _selectedPaymentMode;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  List<Project> _projects = [];

  // Filter labels
  static const _filters = ['All Filters', 'Category', 'Visit Type', 'Project', 'Date Range', 'Payment'];
  static const _visitTypes = ['Project', 'Service', 'Survey'];
  static const _paymentModes = ['Cash', 'UPI', 'Bank'];

  @override
  void initState() {
    super.initState();
    _loadExpenses();
    _loadProjects();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {}); // Rebuild with filtered list
  }

  List<Expense> get _filteredExpenses {
    var result = List<Expense>.from(_allExpenses);

    // Text search
    final query = _searchController.text.trim().toLowerCase();
    if (query.isNotEmpty) {
      result = result.where((e) {
        final vendor = (e.vendor ?? '').toLowerCase();
        final category = e.category.toLowerCase();
        final description = (e.description ?? '').toLowerCase();
        return vendor.contains(query) ||
            category.contains(query) ||
            description.contains(query);
      }).toList();
    }

    // Category filter
    if (_selectedCategory != null) {
      result = result
          .where((e) =>
              e.category.toLowerCase() == _selectedCategory!.toLowerCase())
          .toList();
    }

    // Visit type filter
    if (_selectedVisitType != null) {
      result = result
          .where((e) =>
              (e.visitType ?? '').toLowerCase() ==
              _selectedVisitType!.toLowerCase())
          .toList();
    }

    // Project filter
    if (_selectedProjectId != null) {
      result =
          result.where((e) => e.projectId == _selectedProjectId).toList();
    }

    // Date range filter
    if (_dateFrom != null) {
      result = result.where((e) => !e.date.isBefore(_dateFrom!)).toList();
    }
    if (_dateTo != null) {
      result = result.where((e) => !e.date.isAfter(_dateTo!)).toList();
    }

    // Payment mode filter
    if (_selectedPaymentMode != null) {
      result = result.where((e) {
        final pay = e.paymentMode.toLowerCase();
        final mode = _selectedPaymentMode!.toLowerCase();
        if (mode == 'bank') return pay == 'bank_transfer' || pay == 'bank';
        return pay == mode;
      }).toList();
    }

    return result;
  }

  Future<void> _loadProjects() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return;

      // First get user's org
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .maybeSingle();

      if (profile == null || profile['organization_id'] == null) return;

      final orgId = profile['organization_id'] as String;
      final data = await Supabase.instance.client
          .from('projects')
          .select()
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .order('project_name');

      if (!mounted) return;

      setState(() {
        _projects = (data as List)
            .map((row) => Project.fromJson(row as Map<String, dynamic>))
            .toList();
      });
    } catch (_) {
      // Non-critical, silently ignore
    }
  }

  Future<void> _loadExpenses() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;

      // Fetch expenses
      final data = await Supabase.instance.client
          .from('expenses')
          .select()
          .eq('user_id', userId)
          .order('date', ascending: false)
          .order('created_at', ascending: false)
          .limit(50);

      final expenses = (data as List<dynamic>)
          .map((row) => Expense.fromJson(row as Map<String, dynamic>))
          .toList();

      // Calculate totals
      double total = 0;
      for (final e in expenses) {
        total += e.amount;
      }

      // Calculate this month total
      final now = DateTime.now();
      double monthTotal = 0;
      for (final e in expenses) {
        if (e.date.year == now.year && e.date.month == now.month) {
          monthTotal += e.amount;
        }
      }

      // Get full count
      final countResponse = await Supabase.instance.client
          .from('expenses')
          .select()
          .eq('user_id', userId)
          .count(CountOption.exact);

      if (!mounted) return;

      setState(() {
        _allExpenses = expenses;
        _totalCount = countResponse.count;
        _totalAmount = total;
        _thisMonthTotal = monthTotal;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  bool _isExportingExcel = false;
  bool _isExportingToSheets = false;

  Future<void> _exportSelectedToSheets() async {
    if (_selectedIds.isEmpty || _isExportingToSheets) return;
    setState(() => _isExportingToSheets = true);

    try {
      final selected = _allExpenses
          .where((e) => _selectedIds.contains(e.id))
          .map((e) => e.toJson())
          .toList();

      if (selected.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No expenses selected')),
          );
        }
        return;
      }

      await GoogleSheetsService.exportToSheet(selected);

      // Best-effort project-sheet sync using the linked sheet URL
      final sheetUrl = await GoogleSheetsService.getSheetUrl();
      if (sheetUrl != null) {
        final sheetId = sheetUrl.split('/d/').last.split('/').first;
        GoogleSheetsService.syncProjectSheets(sheetId, selected)
            .catchError((_) {});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${selected.length} expenses synced to Google Sheets!'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        setState(() => _selectedIds.clear());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sheets export failed: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isExportingToSheets = false);
    }
  }

  Future<void> _exportFilteredToExcel() async {
    if (_isExportingExcel) return;
    setState(() => _isExportingExcel = true);

    try {
      final filtered = _filteredExpenses;
      if (filtered.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No expenses to export')),
          );
        }
        return;
      }

      // Convert Expense objects to JSON maps for the export service
      final expenseMaps = filtered.map((e) => e.toJson()).toList();

      final excelService = ExcelExportService();
      final filePath = await excelService.exportToExcel(expenseMaps);

      await Share.shareXFiles(
        [XFile(filePath)],
        subject: 'Expense History Export',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isExportingExcel = false);
    }
  }

  // ── Bulk Delete ──────────────────────────────────────────────────────
  Future<void> _deleteSelected() async {
    if (_selectedIds.isEmpty || _isDeleting) return;

    final count = _selectedIds.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Delete Expenses?',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Are you sure you want to delete $count expense${count == 1 ? '' : 's'}? This cannot be undone.',
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
            child: Text('Delete $count',
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isDeleting = true);

    try {
      final idsToDelete = _selectedIds.toList();

      // Batch delete from Supabase
      await Supabase.instance.client
          .from('expenses')
          .delete()
          .inFilter('id', idsToDelete);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$count expense${count == 1 ? '' : 's'} deleted'),
          backgroundColor: const Color(0xFF059669),
        ),
      );

      _selectedIds.clear();
      _selectAll = false;
      await _loadExpenses();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Delete failed: ${e.toString()}'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    } finally {
      if (mounted) setState(() => _isDeleting = false);
    }
  }

  void _clearFilters() {
    setState(() {
      _selectedFilterIndex = 0;
      _selectedCategory = null;
      _selectedVisitType = null;
      _selectedProjectId = null;
      _selectedPaymentMode = null;
      _dateFrom = null;
      _dateTo = null;
    });
  }

  void _onFilterChipSelected(int index) {
    if (index == 0) {
      _clearFilters();
      return;
    }

    setState(() => _selectedFilterIndex = index);

    switch (index) {
      case 1: // Category
        _showCategoryPicker();
        break;
      case 2: // Visit Type
        _showVisitTypePicker();
        break;
      case 3: // Project
        _showProjectPicker();
        break;
      case 4: // Date Range
        _showDateRangePicker();
        break;
      case 5: // Payment Mode
        _showPaymentModePicker();
        break;
    }
  }

  void _showCategoryPicker() {
    final categories = ExpenseCategories.names;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _FilterBottomSheet(
        title: 'Select Category',
        items: categories,
        selectedItem: _selectedCategory,
        onSelected: (value) {
          setState(() {
            _selectedCategory = value;
            _selectedVisitType = null;
            _selectedProjectId = null;
          });
          Navigator.pop(ctx);
        },
        onClear: () {
          setState(() => _selectedCategory = null);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  void _showVisitTypePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _FilterBottomSheet(
        title: 'Select Visit Type',
        items: _visitTypes,
        selectedItem: _selectedVisitType,
        onSelected: (value) {
          setState(() {
            _selectedVisitType = value;
            _selectedCategory = null;
            _selectedProjectId = null;
          });
          Navigator.pop(ctx);
        },
        onClear: () {
          setState(() => _selectedVisitType = null);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  void _showProjectPicker() {
    if (_projects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('No projects available'),
          backgroundColor: const Color(0xFFF59E0B),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _FilterBottomSheet(
        title: 'Select Project',
        items: _projects.map((p) => p.displayLabel).toList(),
        selectedItem: _selectedProjectId != null
            ? _projects
                .where((p) => p.id == _selectedProjectId)
                .map((p) => p.displayLabel)
                .firstOrNull
            : null,
        onSelected: (value) {
          final project = _projects.firstWhere((p) => p.displayLabel == value);
          setState(() {
            _selectedProjectId = project.id;
            _selectedCategory = null;
            _selectedVisitType = null;
          });
          Navigator.pop(ctx);
        },
        onClear: () {
          setState(() => _selectedProjectId = null);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  Future<void> _showDateRangePicker() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now,
      initialDateRange: (_dateFrom != null && _dateTo != null)
          ? DateTimeRange(start: _dateFrom!, end: _dateTo!)
          : DateTimeRange(start: DateTime(now.year, now.month, 1), end: now),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(primary: const Color(0xFF006699)),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        _dateFrom = picked.start;
        _dateTo = picked.end;
      });
    }
  }

  void _showPaymentModePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _FilterBottomSheet(
        title: 'Select Payment Mode',
        items: _paymentModes,
        selectedItem: _selectedPaymentMode,
        onSelected: (value) {
          setState(() {
            _selectedPaymentMode = value;
          });
          Navigator.pop(ctx);
        },
        onClear: () {
          setState(() => _selectedPaymentMode = null);
          Navigator.pop(ctx);
        },
      ),
    );
  }

  /// Returns the active filter label for display on the chip.
  String _activeFilterLabel(int index) {
    switch (index) {
      case 1:
        return _selectedCategory != null
            ? 'Category: $_selectedCategory'
            : 'Category';
      case 2:
        return _selectedVisitType != null
            ? 'Visit: $_selectedVisitType'
            : 'Visit Type';
      case 3:
        if (_selectedProjectId != null) {
          final project =
              _projects.where((p) => p.id == _selectedProjectId).firstOrNull;
          return project != null
              ? 'Project: ${project.projectCode}'
              : 'Project';
        }
        return 'Project';
      case 4:
        if (_dateFrom != null || _dateTo != null) {
          final from = _dateFrom != null ? '${_dateFrom!.day}/${_dateFrom!.month}' : '...';
          final to = _dateTo != null ? '${_dateTo!.day}/${_dateTo!.month}' : '...';
          return '$from — $to';
        }
        return 'Date Range';
      case 5:
        return _selectedPaymentMode != null
            ? 'Pay: $_selectedPaymentMode'
            : 'Payment';
      default:
        return _filters[index];
    }
  }

  bool get _hasActiveFilter =>
      _selectedCategory != null ||
      _selectedVisitType != null ||
      _selectedProjectId != null ||
      _selectedPaymentMode != null ||
      _dateFrom != null ||
      _dateTo != null;

  String _formatAmount(double amount) {
    if (amount >= 100000) {
      final lakhs = amount / 100000;
      return '${lakhs.toStringAsFixed(lakhs == lakhs.roundToDouble() ? 0 : 1)}L';
    }
    final intVal = amount.toInt();
    final str = intVal.toString();
    if (str.length <= 3) return str;

    final last3 = str.substring(str.length - 3);
    final remaining = str.substring(0, str.length - 3);
    String formatted = '';
    for (int i = 0; i < remaining.length; i++) {
      final posFromEnd = remaining.length - 1 - i;
      if (posFromEnd > 0 && posFromEnd % 2 == 0) {
        formatted += '${remaining[i]},';
      } else {
        formatted += remaining[i];
      }
    }
    return '$formatted,$last3';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredExpenses;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: CustomScrollView(
        slivers: [
          // ── AppBar ──────────────────────────────────────────────
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: Colors.white.withValues(alpha: 0.95),
            surfaceTintColor: Colors.transparent,
            automaticallyImplyLeading: false,
            title: const Text(
              'Expense History',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF191C1E),
                letterSpacing: -0.02,
              ),
            ),
            actions: [
              _isExportingExcel
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF006699),
                        ),
                      ),
                    )
                  : IconButton(
                      icon: const Icon(
                        Icons.file_download,
                        color: Color(0xFF006699),
                      ),
                      tooltip: 'Export to Excel',
                      onPressed: _exportFilteredToExcel,
                    ),
              const NotificationBell(),
            ],
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Stats Row ─────────────────────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color:
                            const Color(0xFF191C1E).withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 48,
                          child: Center(
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF006699),
                            ),
                          ),
                        )
                      : Row(
                          children: [
                            _StatColumn(
                              label: 'TOTAL COUNT',
                              value: '$_totalCount',
                              color: const Color(0xFF006699),
                            ),
                            _statDivider(),
                            _StatColumn(
                              label: 'TOTAL AMOUNT',
                              value:
                                  '\u20B9${_formatAmount(_totalAmount)}',
                              color: const Color(0xFF059669),
                            ),
                            _statDivider(),
                            _StatColumn(
                              label: 'THIS MONTH',
                              value:
                                  '\u20B9${_formatAmount(_thisMonthTotal)}',
                              color: const Color(0xFFF59E0B),
                            ),
                          ],
                        ),
                ),

                const SizedBox(height: 16),

                // ── Search ────────────────────────────────────────
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by vendor or category...',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF9CA3AF),
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: Color(0xFF9CA3AF),
                      size: 20,
                    ),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close,
                                size: 18, color: Color(0xFF9CA3AF)),
                            onPressed: () {
                              _searchController.clear();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Color(0xFF006699),
                        width: 2,
                      ),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // ── Filter Chips ──────────────────────────────────
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _filters.length + (_hasActiveFilter ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      // Show "Clear" chip at end when filters active
                      if (_hasActiveFilter && index == _filters.length) {
                        return ActionChip(
                          label: const Text(
                            'Clear',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFFBA1A1A),
                            ),
                          ),
                          onPressed: _clearFilters,
                          backgroundColor: const Color(0xFFFFDAD6),
                          side: BorderSide.none,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                        );
                      }

                      final isSelected = _selectedFilterIndex == index;
                      // Show active filter value in chip label
                      final label = index == 0
                          ? _filters[0]
                          : _activeFilterLabel(index);

                      return ChoiceChip(
                        label: Text(
                          label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF444653),
                          ),
                        ),
                        selected: isSelected,
                        onSelected: (_) => _onFilterChipSelected(index),
                        selectedColor: const Color(0xFF006699),
                        backgroundColor: Colors.white,
                        side: isSelected
                            ? BorderSide.none
                            : const BorderSide(color: Color(0xFFE5E7EB)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        showCheckmark: false,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 16),

                // ── Results Count + Select All ────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'SHOWING ${filtered.length} OF $_totalCount RESULTS',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                    Row(
                      children: [
                        const Text(
                          'Select All',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF444653),
                          ),
                        ),
                        SizedBox(
                          height: 24,
                          width: 32,
                          child: Checkbox(
                            value: _selectAll,
                            onChanged: (v) {
                              final checked = v ?? false;
                              setState(() {
                                _selectAll = checked;
                                if (checked) {
                                  _selectedIds.addAll(
                                    filtered.map((e) => e.id),
                                  );
                                } else {
                                  _selectedIds.clear();
                                }
                              });
                            },
                            activeColor: const Color(0xFF006699),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // ── Delete Selected Bar ─────────────────────────
                if (_selectedIds.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFFEF4444)
                              .withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${_selectedIds.length}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${_selectedIds.length} selected',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const Spacer(),
                          _isExportingToSheets
                              ? const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 8),
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF059669),
                                    ),
                                  ),
                                )
                              : TextButton.icon(
                                  onPressed: _isDeleting
                                      ? null
                                      : _exportSelectedToSheets,
                                  icon: const Icon(Icons.table_chart_outlined,
                                      size: 18, color: Color(0xFF059669)),
                                  label: const Text(
                                    'Export',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF059669),
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8),
                                  ),
                                ),
                          const SizedBox(width: 4),
                          _isDeleting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFFEF4444),
                                  ),
                                )
                              : TextButton.icon(
                                  onPressed: _isExportingToSheets
                                      ? null
                                      : _deleteSelected,
                                  icon: const Icon(Icons.delete_outline,
                                      size: 18, color: Color(0xFFEF4444)),
                                  label: const Text(
                                    'Delete',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFEF4444),
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8),
                                  ),
                                ),
                        ],
                      ),
                    ),
                  ),

                // ── Loading / Error / Expense Cards ──────────────
                if (_isLoading)
                  _buildShimmerList()
                else if (_error != null)
                  _buildErrorWidget()
                else if (filtered.isEmpty)
                  _buildEmptyWidget()
                else
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF191C1E)
                              .withValues(alpha: 0.04),
                          blurRadius: 20,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children:
                          List.generate(filtered.length, (index) {
                        final expense = filtered[index];
                        final isSelected =
                            _selectedIds.contains(expense.id);
                        return _ExpenseTile(
                          expense: expense,
                          showTopRadius: index == 0,
                          showBottomRadius:
                              index == filtered.length - 1,
                          isSelected: isSelected,
                          showCheckbox: _selectedIds.isNotEmpty ||
                              _selectAll,
                          onTap: () {
                            if (_selectedIds.isNotEmpty) {
                              // In selection mode: toggle selection
                              setState(() {
                                if (isSelected) {
                                  _selectedIds.remove(expense.id);
                                  _selectAll = false;
                                } else {
                                  _selectedIds.add(expense.id);
                                  if (_selectedIds.length ==
                                      filtered.length) {
                                    _selectAll = true;
                                  }
                                }
                              });
                            } else {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ExpenseDetailScreen(
                                          expense:
                                              expense.toJson()),
                                ),
                              );
                            }
                          },
                          onLongPress: () {
                            setState(() {
                              _selectedIds.add(expense.id);
                            });
                          },
                          onCheckChanged: (checked) {
                            setState(() {
                              if (checked) {
                                _selectedIds.add(expense.id);
                                if (_selectedIds.length ==
                                    filtered.length) {
                                  _selectAll = true;
                                }
                              } else {
                                _selectedIds.remove(expense.id);
                                _selectAll = false;
                              }
                            });
                          },
                        );
                      }),
                    ),
                  ),

                const SizedBox(height: 16),

                // ── Pagination ────────────────────────────────────
                if (!_isLoading && _error == null && filtered.isNotEmpty)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                        (_totalCount / 50).ceil().clamp(1, 5), (index) {
                      final page = index + 1;
                      final isSelected = _currentPage == page;
                      return Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 4),
                        child: GestureDetector(
                          onTap: () {
                            setState(() => _currentPage = page);
                          },
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF006699)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: isSelected
                                  ? null
                                  : Border.all(
                                      color: const Color(0xFFE5E7EB)),
                            ),
                            child: Center(
                              child: Text(
                                '$page',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected
                                      ? Colors.white
                                      : const Color(0xFF444653),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),

                const SizedBox(height: 24),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShimmerList() {
    return Column(
      children: List.generate(5, (index) {
        return Container(
          margin: EdgeInsets.only(bottom: index < 4 ? 8 : 0),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 120,
                      height: 12,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: 80,
                      height: 10,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 50,
                height: 14,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildErrorWidget() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline, size: 48, color: Color(0xFFBA1A1A)),
          const SizedBox(height: 12),
          const Text(
            'Failed to load expenses',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Color(0xFF191C1E),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: _loadExpenses,
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF006699),
              side: const BorderSide(color: Color(0xFF006699)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text(
            'No expenses found',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Color(0xFF9CA3AF),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _searchController.text.isNotEmpty || _hasActiveFilter
                ? 'Try a different search term or clear filters'
                : 'Your expenses will appear here',
            style: const TextStyle(fontSize: 12, color: Color(0xFFBBBBBB)),
          ),
        ],
      ),
    );
  }

  Widget _statDivider() {
    return Container(
      width: 1,
      height: 36,
      margin: const EdgeInsets.symmetric(horizontal: 12),
      color: const Color(0xFFE5E7EB),
    );
  }
}

// ── Filter Bottom Sheet ─────────────────────────────────────────────────
class _FilterBottomSheet extends StatelessWidget {
  final String title;
  final List<String> items;
  final String? selectedItem;
  final ValueChanged<String> onSelected;
  final VoidCallback onClear;

  const _FilterBottomSheet({
    required this.title,
    required this.items,
    required this.selectedItem,
    required this.onSelected,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Title + Clear
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF191C1E),
                  ),
                ),
                if (selectedItem != null)
                  TextButton(
                    onPressed: onClear,
                    child: const Text(
                      'Clear',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFBA1A1A),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Items
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.4,
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final isActive = selectedItem == item;
                return ListTile(
                  title: Text(
                    item,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                      color: isActive
                          ? const Color(0xFF006699)
                          : const Color(0xFF191C1E),
                    ),
                  ),
                  trailing: isActive
                      ? const Icon(Icons.check, color: Color(0xFF006699), size: 20)
                      : null,
                  onTap: () => onSelected(item),
                );
              },
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
        ],
      ),
    );
  }
}

// ── Stat Column Widget ───────────────────────────────────────────────────
class _StatColumn extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatColumn({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Color(0xFF9CA3AF),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Expense Tile Widget ──────────────────────────────────────────────────
class _ExpenseTile extends StatelessWidget {
  final Expense expense;
  final bool showTopRadius;
  final bool showBottomRadius;
  final bool isSelected;
  final bool showCheckbox;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final ValueChanged<bool>? onCheckChanged;

  const _ExpenseTile({
    required this.expense,
    this.showTopRadius = false,
    this.showBottomRadius = false,
    this.isSelected = false,
    this.showCheckbox = false,
    this.onTap,
    this.onLongPress,
    this.onCheckChanged,
  });

  @override
  Widget build(BuildContext context) {
    final catInfo = ExpenseCategories.byName(expense.category);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final dateStr =
        '${expense.date.day} ${months[expense.date.month - 1]} ${expense.date.year}';

    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF006699).withValues(alpha: 0.05)
              : null,
          borderRadius: BorderRadius.vertical(
            top: showTopRadius ? const Radius.circular(16) : Radius.zero,
            bottom:
                showBottomRadius ? const Radius.circular(16) : Radius.zero,
          ),
        ),
        child: Row(
          children: [
            // Checkbox (shown in selection mode)
            if (showCheckbox) ...[
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: isSelected,
                  onChanged: (v) => onCheckChanged?.call(v ?? false),
                  activeColor: const Color(0xFF006699),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
              ),
              const SizedBox(width: 8),
            ],

            // Category badge
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: catInfo.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Icon(catInfo.icon, size: 20, color: catInfo.color),
              ),
            ),
            const SizedBox(width: 12),

            // Vendor & details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    expense.vendor ?? 'No vendor',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${expense.category}  \u2022  $dateStr',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),

            // Amount
            Text(
              '\u20B9${expense.amount.toStringAsFixed(0)}',
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
  }
}
