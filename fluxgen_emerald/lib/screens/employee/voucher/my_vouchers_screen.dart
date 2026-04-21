import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shimmer/shimmer.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/theme/app_colors.dart';
import 'package:emerald/core/utils/currency_formatter.dart';
import 'package:emerald/core/utils/date_formatter.dart';
import 'package:emerald/models/voucher.dart';
import 'package:emerald/services/google_sheets_service.dart';
import 'package:emerald/services/pdf_service.dart';

/// Employee screen showing their own submitted vouchers with status tracking.
///
/// Features:
/// - Stats row: Submitted | Approved | Rejected | Reimbursed counts
/// - Filter chips: All, Pending, Approved, Rejected, Reimbursed
/// - Voucher list cards with status badges
/// - Tap card to see detail bottom sheet with expenses, timeline, and actions
/// - Pull-to-refresh, loading shimmer, empty state
class MyVouchersScreen extends StatefulWidget {
  const MyVouchersScreen({super.key});

  @override
  State<MyVouchersScreen> createState() => _MyVouchersScreenState();
}

class _MyVouchersScreenState extends State<MyVouchersScreen> {
  // ── State ──────────────────────────────────────────────────────────────
  bool _loading = true;
  String? _error;
  List<Voucher> _allVouchers = [];
  String _selectedFilter = 'all';

  // ── Status badge styling ──────────────────────────────────────────────
  static const _statusColors = <String, (Color fg, Color bg, String label)>{
    'pending_manager': (Color(0xFFF59E0B), Color(0xFFFFFBEB), 'Pending Manager'),
    'pending_accountant': (Color(0xFFF59E0B), Color(0xFFFFFBEB), 'Pending Accountant'),
    'manager_approved': (Color(0xFF0EA5E9), Color(0xFFF0F9FF), 'Manager Approved'),
    'approved': (Color(0xFF059669), Color(0xFFECFDF5), 'Approved'),
    'rejected': (Color(0xFFEF4444), Color(0xFFFEF2F2), 'Rejected'),
    'reimbursed': (Color(0xFF0EA5E9), Color(0xFFF0F9FF), 'Reimbursed'),
  };

  static const _filterLabels = {
    'all': 'All',
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'reimbursed': 'Reimbursed',
  };

  // ── Stats (computed from _allVouchers) ────────────────────────────────
  int get _submittedCount => _allVouchers.length;

  int get _approvedCount => _allVouchers
      .where((v) => v.status == 'approved' || v.status == 'reimbursed')
      .length;

  int get _rejectedCount =>
      _allVouchers.where((v) => v.status == 'rejected').length;

  int get _reimbursedCount =>
      _allVouchers.where((v) => v.status == 'reimbursed').length;

  // ── Filtered list ─────────────────────────────────────────────────────
  List<Voucher> get _filteredVouchers {
    if (_selectedFilter == 'all') return _allVouchers;

    return switch (_selectedFilter) {
      'pending' => _allVouchers
          .where((v) =>
              v.status == 'pending_manager' ||
              v.status == 'pending_accountant' ||
              v.status == 'manager_approved')
          .toList(),
      'approved' => _allVouchers
          .where((v) => v.status == 'approved')
          .toList(),
      'rejected' => _allVouchers
          .where((v) => v.status == 'rejected')
          .toList(),
      'reimbursed' => _allVouchers
          .where((v) => v.status == 'reimbursed')
          .toList(),
      _ => _allVouchers,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _loadVouchers();
  }

  // ── Data Loading ──────────────────────────────────────────────────────
  Future<void> _loadVouchers() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final data = await Supabase.instance.client
          .from('vouchers')
          .select()
          .eq('submitted_by', user.id)
          .order('submitted_at', ascending: false);

      final vouchers = (data as List<dynamic>)
          .map((row) => Voucher.fromJson(row as Map<String, dynamic>))
          .toList();

      if (!mounted) return;
      setState(() {
        _allVouchers = vouchers;
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

  // ── Build ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final filtered = _filteredVouchers;

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
          'My Vouchers',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
          ),
        ),
        centerTitle: false,
      ),
      body: RefreshIndicator(
        onRefresh: _loadVouchers,
        color: AppColors.primary,
        child: _loading
            ? _buildShimmer()
            : _error != null
                ? _buildError()
                : _buildContent(filtered),
      ),
    );
  }

  Widget _buildContent(List<Voucher> filtered) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Stats row
              _buildStatsRow(),
              const SizedBox(height: 16),

              // Filter chips
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _filterLabels.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final key = _filterLabels.keys.elementAt(index);
                    final label = _filterLabels[key]!;
                    final isSelected = _selectedFilter == key;
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
                      onSelected: (_) {
                        setState(() => _selectedFilter = key);
                      },
                      selectedColor: AppColors.primary,
                      backgroundColor: Colors.white,
                      side: isSelected
                          ? BorderSide.none
                          : const BorderSide(color: Color(0xFFE5E7EB)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      showCheckmark: false,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),

              // Count label
              Text(
                'SHOWING ${filtered.length} VOUCHER${filtered.length == 1 ? '' : 'S'}',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Color(0xFF9CA3AF),
                ),
              ),
              const SizedBox(height: 12),

              // Voucher list or empty state
              if (filtered.isEmpty)
                _buildEmpty()
              else
                ...filtered.map((v) => _MyVoucherCard(
                      voucher: v,
                      statusColors: _statusColors,
                      onTap: () => _showVoucherDetail(v),
                    )),
              const SizedBox(height: 24),
            ]),
          ),
        ),
      ],
    );
  }

  // ── Stats Row ─────────────────────────────────────────────────────────
  Widget _buildStatsRow() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          _statItem('Submitted', _submittedCount, AppColors.primary),
          _statDivider(),
          _statItem('Approved', _approvedCount, const Color(0xFF059669)),
          _statDivider(),
          _statItem('Rejected', _rejectedCount, const Color(0xFFEF4444)),
          _statDivider(),
          _statItem('Reimbursed', _reimbursedCount, const Color(0xFF0EA5E9)),
        ],
      ),
    );
  }

  Widget _statItem(String label, int count, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9CA3AF),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _statDivider() {
    return Container(
      width: 1,
      height: 32,
      color: const Color(0xFFE5E7EB),
    );
  }

  // ── Voucher Detail Bottom Sheet ───────────────────────────────────────
  void _showVoucherDetail(Voucher voucher) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _VoucherDetailSheet(
        voucher: voucher,
        statusColors: _statusColors,
        onResubmit: () {
          Navigator.pop(context);
          _resubmitVoucher(voucher);
        },
        onDownloadPdf: (v, expenses) {
          Navigator.pop(context);
          _downloadVoucherPdf(v, expenses);
        },
      ),
    );
  }

  // ── Download voucher as PDF ───────────────────────────────────────────
  Future<void> _downloadVoucherPdf(
    Voucher voucher,
    List<Map<String, dynamic>> expenses,
  ) async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Generating PDF...'),
          duration: Duration(seconds: 2),
        ),
      );

      // Get current user profile for employee info
      final user = Supabase.instance.client.auth.currentUser;
      String employeeName = 'Employee';
      String employeeId = '';
      if (user != null) {
        final profile = await Supabase.instance.client
            .from('profiles')
            .select('name, employee_id')
            .eq('id', user.id)
            .maybeSingle();
        if (profile != null) {
          employeeName = profile['name'] as String? ?? user.email ?? 'Employee';
          employeeId = profile['employee_id'] as String? ?? user.id.substring(0, 8);
        }
      }

      // Determine period string from voucher or expenses
      String period = voucher.purpose ?? '';
      if (period.isEmpty && voucher.submittedAt != null) {
        period = DateFormatter.formatShortMonthYear(voucher.submittedAt!);
      }

      final pdfService = PdfService();
      final filePath = await pdfService.generateReimbursementPdf(
        employeeName: employeeName,
        employeeId: employeeId,
        period: period,
        expenses: expenses,
      );

      if (!mounted) return;

      await Share.shareXFiles(
        [XFile(filePath)],
        subject: 'Voucher ${voucher.voucherNumber}',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('PDF generation failed: ${e.toString()}'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  // ── Resubmit rejected voucher ─────────────────────────────────────────
  Future<void> _resubmitVoucher(Voucher voucher) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Resubmit Voucher?',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'This will resubmit ${voucher.voucherNumber} for manager approval.',
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
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Resubmit',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;

      await Supabase.instance.client
          .from('vouchers')
          .update({
            'status': 'pending_manager',
            'submitted_at': DateTime.now().toIso8601String(),
          })
          .eq('id', voucher.id);

      // Add history entry
      await Supabase.instance.client.from('voucher_history').insert({
        'voucher_id': voucher.id,
        'action': 'resubmitted',
        'acted_by': userId,
        'comments': 'Voucher resubmitted after rejection',
        'previous_status': 'rejected',
        'new_status': 'pending_manager',
      });

      // Re-sync to Google Sheets (non-blocking)
      try {
        final voucherExpenses = await Supabase.instance.client
            .from('voucher_expenses')
            .select('expense_id')
            .eq('voucher_id', voucher.id);
        final expenseIds = (voucherExpenses as List).map((e) => e['expense_id'] as String).toList();
        if (expenseIds.isNotEmpty) {
          final expenses = await Supabase.instance.client
              .from('expenses')
              .select()
              .inFilter('id', expenseIds);
          GoogleSheetsService.exportToSheet(List<Map<String, dynamic>>.from(expenses)).catchError((e) {
            debugPrint('Sheets re-sync warning: $e');
          });
        }
      } catch (e) {
        debugPrint('Sheets re-sync warning: $e');
      }

      // Notify manager
      if (voucher.managerId != null) {
        try {
          await Supabase.instance.client.from('notifications').insert({
            'user_id': voucher.managerId,
            'type': 'voucher_submitted',
            'title': 'Voucher resubmitted',
            'message': 'Voucher ${voucher.voucherNumber} has been resubmitted for approval.',
            'is_read': false,
            'reference_id': voucher.id,
            'reference_type': 'voucher',
          });
        } catch (_) {}
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voucher resubmitted successfully'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }

      _loadVouchers();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error resubmitting: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  // ── Shimmer Loading ───────────────────────────────────────────────────
  Widget _buildShimmer() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Shimmer.fromColors(
        baseColor: const Color(0xFFE5E7EB),
        highlightColor: const Color(0xFFF9FAFB),
        child: Column(
          children: [
            // Stats shimmer
            Container(
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            const SizedBox(height: 16),

            // Filter chips shimmer
            Row(
              children: List.generate(
                4,
                (i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Container(
                    width: 72,
                    height: 32,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Card shimmers
            ...List.generate(
              5,
              (i) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
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
                            width: 140,
                            height: 12,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: 90,
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
                      width: 60,
                      height: 24,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Error State ───────────────────────────────────────────────────────
  Widget _buildError() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            const Text(
              'Failed to load vouchers',
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
              onPressed: _loadVouchers,
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
    );
  }

  // ── Empty State ───────────────────────────────────────────────────────
  Widget _buildEmpty() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.receipt_long_outlined,
              size: 32,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            _selectedFilter != 'all'
                ? 'No ${_filterLabels[_selectedFilter]} vouchers'
                : 'No vouchers submitted yet',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Color(0xFF191C1E),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _selectedFilter != 'all'
                ? 'Try a different filter'
                : 'Submit your first expense voucher to track it here',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Color(0xFFBBBBBB)),
          ),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// My Voucher Card
// ════════════════════════════════════════════════════════════════════════════

class _MyVoucherCard extends StatelessWidget {
  final Voucher voucher;
  final Map<String, (Color, Color, String)> statusColors;
  final VoidCallback onTap;

  const _MyVoucherCard({
    required this.voucher,
    required this.statusColors,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dateStr = voucher.submittedAt != null
        ? DateFormatter.format(voucher.submittedAt!)
        : 'N/A';

    final (fg, bg, label) = statusColors[voucher.status] ??
        (const Color(0xFF6B7280), const Color(0xFFF3F4F6), voucher.statusLabel);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Left icon
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: Icon(Icons.receipt, size: 20, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 12),

                // Middle content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        voucher.voucherNumber,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF191C1E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dateStr,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            CurrencyFormatter.formatCompact(voucher.totalAmount),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${voucher.expenseCount} expense${voucher.expenseCount == 1 ? '' : 's'}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Status badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Voucher Detail Bottom Sheet
// ════════════════════════════════════════════════════════════════════════════

class _VoucherDetailSheet extends StatefulWidget {
  final Voucher voucher;
  final Map<String, (Color, Color, String)> statusColors;
  final VoidCallback onResubmit;
  final void Function(Voucher voucher, List<Map<String, dynamic>> expenses) onDownloadPdf;

  const _VoucherDetailSheet({
    required this.voucher,
    required this.statusColors,
    required this.onResubmit,
    required this.onDownloadPdf,
  });

  @override
  State<_VoucherDetailSheet> createState() => _VoucherDetailSheetState();
}

class _VoucherDetailSheetState extends State<_VoucherDetailSheet> {
  bool _loadingDetail = true;
  List<Map<String, dynamic>> _expenses = [];
  List<Map<String, dynamic>> _history = [];
  String? _rejectionReason;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    try {
      final voucherId = widget.voucher.id;

      // Fetch linked expenses via voucher_expenses junction table
      final expLinks = await Supabase.instance.client
          .from('voucher_expenses')
          .select('expense_id')
          .eq('voucher_id', voucherId);

      final expenseIds = (expLinks as List<dynamic>)
          .map((r) => r['expense_id'] as String)
          .toList();

      if (expenseIds.isNotEmpty) {
        final expData = await Supabase.instance.client
            .from('expenses')
            .select()
            .inFilter('id', expenseIds)
            .order('date', ascending: false);
        _expenses = List<Map<String, dynamic>>.from(expData);
      }

      // Fetch voucher history with actor names
      final histData = await Supabase.instance.client
          .from('voucher_history')
          .select('*, actor:acted_by(id, name)')
          .eq('voucher_id', voucherId)
          .order('created_at', ascending: true);
      _history = List<Map<String, dynamic>>.from(histData);

      // Find rejection reason from latest rejection entry
      if (widget.voucher.isRejected) {
        for (int i = _history.length - 1; i >= 0; i--) {
          final action = _history[i]['action'] as String? ?? '';
          if (action.contains('rejected')) {
            _rejectionReason = _history[i]['comments'] as String?;
            break;
          }
        }
      }

      if (mounted) setState(() => _loadingDetail = false);
    } catch (e) {
      if (mounted) setState(() => _loadingDetail = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.voucher;
    final dateStr = v.submittedAt != null
        ? DateFormatter.formatWithTime(v.submittedAt!)
        : 'N/A';

    final (fg, bg, label) = widget.statusColors[v.status] ??
        (const Color(0xFF6B7280), const Color(0xFFF3F4F6), v.statusLabel);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (_, scrollController) => Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
              children: [
                // ── Header ──────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            v.voucherNumber,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            dateStr,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: bg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: fg,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // ── Amount card ─────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Total Amount',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            CurrencyFormatter.format(v.totalAmount),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'Expenses',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${v.expenseCount}',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Voucher Details ─────────────────────────────────
                _sectionHeader('Details'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    children: [
                      _detailRow('Voucher Number', v.voucherNumber),
                      _detailDivider(),
                      _detailRow('Status', label),
                      _detailDivider(),
                      _detailRow(
                        'Submitted',
                        v.submittedAt != null
                            ? DateFormatter.format(v.submittedAt!)
                            : 'N/A',
                      ),
                      if (v.managerActionAt != null) ...[
                        _detailDivider(),
                        _detailRow(
                          'Manager Action',
                          DateFormatter.format(v.managerActionAt!),
                        ),
                      ],
                      if (v.accountantActionAt != null) ...[
                        _detailDivider(),
                        _detailRow(
                          'Accountant Action',
                          DateFormatter.format(v.accountantActionAt!),
                        ),
                      ],
                      if (v.purpose != null && v.purpose!.isNotEmpty) ...[
                        _detailDivider(),
                        _detailRow('Purpose', v.purpose!),
                      ],
                      if (v.notes != null && v.notes!.isNotEmpty) ...[
                        _detailDivider(),
                        _detailRow('Notes', v.notes!),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Rejection reason ────────────────────────────────
                if (v.isRejected && _rejectionReason != null) ...[
                  _sectionHeader('Rejection Reason'),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline,
                            size: 18, color: Color(0xFFEF4444)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _rejectionReason!,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFFB91C1C),
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Linked Expenses ─────────────────────────────────
                _sectionHeader('Expenses'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.primary),
                    ),
                  )
                else if (_expenses.isEmpty)
                  _emptySection('No expenses linked')
                else
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      children: [
                        for (int i = 0; i < _expenses.length; i++) ...[
                          if (i > 0)
                            const Divider(
                                height: 1, indent: 14, endIndent: 14),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _expenses[i]['vendor'] as String? ??
                                            _expenses[i]['category']
                                                as String? ??
                                            'Expense',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF191C1E),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${_expenses[i]['category'] ?? ''} \u2022 ${_expenses[i]['date'] ?? ''}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  CurrencyFormatter.formatCompact(
                                    (_expenses[i]['amount'] as num?)
                                            ?.toDouble() ??
                                        0,
                                  ),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF191C1E),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                const SizedBox(height: 20),

                // ── Approval Timeline ───────────────────────────────
                _sectionHeader('Approval Timeline'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.primary),
                    ),
                  )
                else if (_history.isEmpty)
                  _emptySection('No history available')
                else
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        for (int i = 0; i < _history.length; i++) ...[
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Timeline dot & line
                              Column(
                                children: [
                                  Container(
                                    width: 24,
                                    height: 24,
                                    decoration: BoxDecoration(
                                      color: _timelineIconColor(
                                              _history[i]['action']
                                                  as String? ??
                                                  '')
                                          .withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Icon(
                                        _timelineIcon(
                                            _history[i]['action']
                                                as String? ??
                                                ''),
                                        size: 12,
                                        color: _timelineIconColor(
                                            _history[i]['action']
                                                as String? ??
                                                ''),
                                      ),
                                    ),
                                  ),
                                  if (i < _history.length - 1)
                                    Container(
                                      width: 2,
                                      height: 32,
                                      color: const Color(0xFFE5E7EB),
                                    ),
                                ],
                              ),
                              const SizedBox(width: 12),
                              // Timeline content
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _formatAction(
                                          _history[i]['action'] as String? ??
                                              ''),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF191C1E),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _historyMeta(_history[i]),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF9CA3AF),
                                      ),
                                    ),
                                    if (_history[i]['comments'] != null &&
                                        (_history[i]['comments'] as String)
                                            .isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          _history[i]['comments'] as String,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontStyle: FontStyle.italic,
                                            color: Color(0xFF6B7280),
                                          ),
                                        ),
                                      ),
                                    const SizedBox(height: 8),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                const SizedBox(height: 24),

                // ── Download PDF button ─────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => widget.onDownloadPdf(v, _expenses),
                    icon: const Icon(Icons.picture_as_pdf, size: 18),
                    label: const Text(
                      'Download PDF',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // ── Resubmit button (only for rejected) ─────────────
                if (v.isRejected)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: widget.onResubmit,
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text(
                        'Resubmit Voucher',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Detail helpers ────────────────────────────────────────────────────

  Widget _sectionHeader(String title) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF9CA3AF),
      ),
    );
  }

  Widget _emptySection(String message) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF9CA3AF),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF191C1E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailDivider() {
    return const Divider(height: 1, color: Color(0xFFF3F4F6));
  }

  String _formatAction(String action) {
    return switch (action) {
      'submitted' => 'Submitted',
      'resubmitted' => 'Resubmitted',
      'manager_approved' => 'Manager Approved',
      'accountant_approved' => 'Accountant Approved',
      'manager_rejected' => 'Manager Rejected',
      'accountant_rejected' => 'Accountant Rejected',
      'rejected' => 'Rejected',
      'approved' => 'Approved',
      'reimbursed' => 'Reimbursed',
      _ => action.replaceAll('_', ' ').split(' ').map((w) {
          if (w.isEmpty) return w;
          return '${w[0].toUpperCase()}${w.substring(1)}';
        }).join(' '),
    };
  }

  String _historyMeta(Map<String, dynamic> h) {
    final actor = h['actor'];
    final name =
        actor is Map ? (actor['name'] as String? ?? 'System') : 'System';
    final date = h['created_at'] != null
        ? DateFormat('dd MMM, hh:mm a')
            .format(DateTime.parse(h['created_at'] as String))
        : '';
    return 'by $name \u2022 $date';
  }

  IconData _timelineIcon(String action) {
    return switch (action) {
      'submitted' || 'resubmitted' => Icons.upload_outlined,
      'manager_approved' || 'accountant_approved' || 'approved' =>
        Icons.check_circle_outline,
      'manager_rejected' || 'accountant_rejected' || 'rejected' =>
        Icons.cancel_outlined,
      'reimbursed' => Icons.payments_outlined,
      _ => Icons.circle_outlined,
    };
  }

  Color _timelineIconColor(String action) {
    return switch (action) {
      'submitted' || 'resubmitted' => AppColors.primary,
      'manager_approved' || 'accountant_approved' || 'approved' =>
        const Color(0xFF059669),
      'manager_rejected' || 'accountant_rejected' || 'rejected' =>
        const Color(0xFFEF4444),
      'reimbursed' => const Color(0xFF0EA5E9),
      _ => const Color(0xFF6B7280),
    };
  }
}
