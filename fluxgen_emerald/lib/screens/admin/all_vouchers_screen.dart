import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/theme/app_colors.dart';
import 'package:emerald/models/voucher.dart';
import '../../services/activity_log_service.dart';
import 'package:emerald/widgets/notification_bell.dart';

/// Admin screen listing all vouchers across the organization.
///
/// Features:
/// - Status filter chips (All, Pending, Approved, Rejected, Reimbursed)
/// - Search by voucher number or submitter name
/// - Tap to view full voucher detail in a bottom sheet
/// - Mark Paid action for approved vouchers
class AllVouchersScreen extends StatefulWidget {
  /// Optional initial status filter. Must be one of:
  /// 'all', 'pending', 'approved', 'rejected', 'reimbursed'.
  /// Defaults to 'all'.
  final String initialFilter;

  const AllVouchersScreen({super.key, this.initialFilter = 'all'});

  @override
  State<AllVouchersScreen> createState() => _AllVouchersScreenState();
}

class _AllVouchersScreenState extends State<AllVouchersScreen> {
  bool _loading = true;
  String? _error;
  List<Voucher> _allVouchers = [];
  late String _selectedFilter;
  bool _searching = false;
  final _searchController = TextEditingController();

  static const _filterLabels = {
    'all': 'All',
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'reimbursed': 'Reimbursed',
  };

  @override
  void initState() {
    super.initState();
    // Validate initialFilter — fall back to 'all' if unknown
    _selectedFilter = _filterLabels.containsKey(widget.initialFilter)
        ? widget.initialFilter
        : 'all';
    _loadVouchers();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() => setState(() {});

  List<Voucher> get _filteredVouchers {
    var list = _allVouchers;

    // Status filter
    if (_selectedFilter != 'all') {
      switch (_selectedFilter) {
        case 'pending':
          list = list
              .where((v) =>
                  v.status == 'pending_manager' ||
                  v.status == 'pending_accountant' ||
                  v.status == 'manager_approved')
              .toList();
          break;
        case 'approved':
          list = list.where((v) => v.status == 'approved').toList();
          break;
        case 'rejected':
          list = list.where((v) => v.status == 'rejected').toList();
          break;
        case 'reimbursed':
          list = list.where((v) => v.status == 'reimbursed').toList();
          break;
      }
    }

    // Search filter
    final query = _searchController.text.trim().toLowerCase();
    if (query.isNotEmpty) {
      list = list.where((v) {
        final number = v.voucherNumber.toLowerCase();
        final name = (v.submitter?.displayName ?? '').toLowerCase();
        return number.contains(query) || name.contains(query);
      }).toList();
    }

    return list;
  }

  Future<void> _loadVouchers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Get org id from profile
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;

      var query = Supabase.instance.client.from('vouchers').select('''
        *,
        submitter:submitted_by(id, name, email, employee_id)
      ''');

      if (orgId != null && orgId.isNotEmpty) {
        query = query.eq('organization_id', orgId);
      }

      final data = await query.order('submitted_at', ascending: false);

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

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredVouchers;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadVouchers,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // AppBar
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              title: _searching
                  ? TextField(
                      controller: _searchController,
                      autofocus: true,
                      decoration: const InputDecoration(
                        hintText: 'Search vouchers...',
                        hintStyle:
                            TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                      ),
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF191C1E)),
                    )
                  : const Text(
                      'All Vouchers',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF191C1E),
                      ),
                    ),
              actions: [
                IconButton(
                  icon: Icon(
                    _searching ? Icons.close : Icons.search,
                    color: const Color(0xFF9CA3AF),
                  ),
                  onPressed: () {
                    setState(() {
                      _searching = !_searching;
                      if (!_searching) _searchController.clear();
                    });
                  },
                ),
                const NotificationBell(),
              ],
            ),

            // Filter chips + content
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
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
                    'SHOWING ${filtered.length} VOUCHERS',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Content
                  if (_loading)
                    _buildShimmer()
                  else if (_error != null)
                    _buildError()
                  else if (filtered.isEmpty)
                    _buildEmpty()
                  else
                    ...filtered.map((v) => _VoucherCard(
                          voucher: v,
                          onTap: () => _showVoucherDetail(v),
                        )),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Voucher Detail Bottom Sheet ──────────────────────────────────────

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
        onMarkPaid: () {
          Navigator.pop(context);
          _showMarkPaidDialog(voucher);
        },
      ),
    );
  }

  // ── Mark Paid Dialog ─────────────────────────────────────────────────

  void _showMarkPaidDialog(Voucher voucher) {
    String paymentMethod = 'NEFT';
    final refController = TextEditingController();
    bool submitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text(
            'Mark as Paid',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${voucher.voucherNumber} - ${_fmtAmt(voucher.totalAmount)}',
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF006699)),
              ),
              const SizedBox(height: 20),
              const Text('Payment Method',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF444653))),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: paymentMethod,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'NEFT', child: Text('NEFT')),
                      DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                      DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'Cheque', child: Text('Cheque')),
                    ],
                    onChanged: (v) {
                      if (v != null) setDialogState(() => paymentMethod = v);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Reference Number',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF444653))),
              const SizedBox(height: 8),
              TextField(
                controller: refController,
                decoration: InputDecoration(
                  hintText: 'e.g. TXN123456',
                  hintStyle:
                      const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                  filled: true,
                  fillColor: const Color(0xFFF3F4F6),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel',
                  style: TextStyle(color: Color(0xFF9CA3AF))),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      try {
                        await _markVoucherPaid(
                          voucher,
                          paymentMethod.toLowerCase(),
                          refController.text.trim(),
                        );
                        // Log activity
                        await ActivityLogService.log('voucher_paid', 'Marked voucher ${voucher.voucherNumber} as paid');
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Voucher marked as paid'),
                              backgroundColor: Color(0xFF059669),
                            ),
                          );
                        }
                        _loadVouchers();
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(
                              content: Text('Error: $e'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                minimumSize: const Size(0, 42),
              ),
              child: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Confirm Payment',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _markVoucherPaid(
    Voucher voucher,
    String method,
    String reference,
  ) async {
    final userId = Supabase.instance.client.auth.currentUser!.id;

    // Update voucher status
    await Supabase.instance.client
        .from('vouchers')
        .update({
          'status': 'reimbursed',
          'payment_date': DateTime.now().toIso8601String().split('T').first,
          'payment_method': method,
          'payment_reference': reference,
          'paid_by': userId,
        })
        .eq('id', voucher.id);

    // Insert voucher_history
    await Supabase.instance.client.from('voucher_history').insert({
      'voucher_id': voucher.id,
      'action': 'reimbursed',
      'acted_by': userId,
      'comments':
          'Paid via ${method.toUpperCase()}${reference.isNotEmpty ? ' (Ref: $reference)' : ''}',
      'previous_status': voucher.status,
      'new_status': 'reimbursed',
    });

    // Insert payment_transactions
    // NOTE: payment_transactions has advance_id (not voucher_id) — store
    // the voucher reference in notes instead.
    await Supabase.instance.client.from('payment_transactions').insert({
      'amount': voucher.totalAmount,
      'payment_method': method,
      'payment_reference': reference.isNotEmpty ? reference : null,
      'status': 'completed',
      'user_id': voucher.submittedBy,
      'organization_id': voucher.organizationId,
      'initiated_by': userId,
      'completed_at': DateTime.now().toIso8601String(),
      'notes': 'Voucher ${voucher.voucherNumber} (${voucher.id})',
    });

    // Create notification for the voucher submitter
    try {
      final amt =
          '\u20B9${NumberFormat('#,##,###', 'en_IN').format(voucher.totalAmount.round())}';
      await Supabase.instance.client.from('notifications').insert({
        'user_id': voucher.submittedBy,
        'organization_id': voucher.organizationId,
        'type': 'system',
        'title': 'Payment completed!',
        'message':
            'Your voucher ${voucher.voucherNumber} ($amt) has been reimbursed via ${method.toUpperCase()}.${reference.isNotEmpty ? ' Reference: $reference' : ''}',
        'is_read': false,
        'reference_id': voucher.id,
        'reference_type': 'voucher',
      });
    } catch (e) {
      // Non-blocking — don't fail the payment if notification fails
      debugPrint('Failed to create voucher payment notification: $e');
    }
  }

  // ── State Widgets ────────────────────────────────────────────────────

  Widget _buildShimmer() {
    return Column(
      children: List.generate(
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
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
          const SizedBox(height: 12),
          const Text('Failed to load vouchers',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E))),
          const SizedBox(height: 8),
          Text(_error!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
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
    );
  }

  Widget _buildEmpty() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey[300]),
          const SizedBox(height: 12),
          const Text('No vouchers found',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          Text(
            _selectedFilter != 'all'
                ? 'No vouchers match the selected filter'
                : 'Vouchers will appear here',
            style: const TextStyle(fontSize: 12, color: Color(0xFFBBBBBB)),
          ),
        ],
      ),
    );
  }

  String _fmtAmt(double a) =>
      '\u20B9${NumberFormat('#,##,###', 'en_IN').format(a.round())}';
}

// ════════════════════════════════════════════════════════════════════════
// Voucher Card
// ════════════════════════════════════════════════════════════════════════

class _VoucherCard extends StatelessWidget {
  final Voucher voucher;
  final VoidCallback onTap;

  const _VoucherCard({required this.voucher, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final dateStr = voucher.submittedAt != null
        ? DateFormat('dd MMM yyyy').format(voucher.submittedAt!)
        : 'N/A';
    final submitterName = voucher.submitter?.displayName ?? 'Unknown';

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
                    child:
                        Icon(Icons.receipt, size: 20, color: AppColors.primary),
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
                        '$submitterName  \u2022  $dateStr',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            '\u20B9${NumberFormat('#,##,###', 'en_IN').format(voucher.totalAmount.round())}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${voucher.expenseCount} expenses',
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
                _StatusBadge(status: voucher.status),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Status Badge
// ════════════════════════════════════════════════════════════════════════

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, fg, bg) = switch (status) {
      'pending_manager' => ('Pending', const Color(0xFFF59E0B), const Color(0xFFFFFBEB)),
      'pending_accountant' || 'manager_approved' => ('In Review', const Color(0xFF3B82F6), const Color(0xFFEFF6FF)),
      'approved' => ('Approved', const Color(0xFF059669), const Color(0xFFECFDF5)),
      'rejected' => ('Rejected', const Color(0xFFEF4444), const Color(0xFFFEF2F2)),
      'reimbursed' => ('Reimbursed', const Color(0xFF0EA5E9), const Color(0xFFF0F9FF)),
      _ => ('Unknown', const Color(0xFF6B7280), const Color(0xFFF3F4F6)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Voucher Detail Bottom Sheet
// ════════════════════════════════════════════════════════════════════════

class _VoucherDetailSheet extends StatefulWidget {
  final Voucher voucher;
  final VoidCallback onMarkPaid;

  const _VoucherDetailSheet({
    required this.voucher,
    required this.onMarkPaid,
  });

  @override
  State<_VoucherDetailSheet> createState() => _VoucherDetailSheetState();
}

class _VoucherDetailSheetState extends State<_VoucherDetailSheet> {
  bool _loadingDetail = true;
  List<Map<String, dynamic>> _expenses = [];
  List<Map<String, dynamic>> _history = [];

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    try {
      // Fetch expenses via voucher_expenses junction
      final expLinks = await Supabase.instance.client
          .from('voucher_expenses')
          .select('expense_id')
          .eq('voucher_id', widget.voucher.id);

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

      // Fetch history
      final histData = await Supabase.instance.client
          .from('voucher_history')
          .select('*, actor:acted_by(id, name)')
          .eq('voucher_id', widget.voucher.id)
          .order('created_at', ascending: true);
      _history = List<Map<String, dynamic>>.from(histData);

      if (mounted) setState(() => _loadingDetail = false);
    } catch (e) {
      if (mounted) setState(() => _loadingDetail = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.voucher;
    final dateStr = v.submittedAt != null
        ? DateFormat('dd MMM yyyy, hh:mm a').format(v.submittedAt!)
        : 'N/A';

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
                // Header
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(v.voucherNumber,
                              style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF191C1E))),
                          const SizedBox(height: 4),
                          Text(dateStr,
                              style: const TextStyle(
                                  fontSize: 12, color: Color(0xFF9CA3AF))),
                        ],
                      ),
                    ),
                    _StatusBadge(status: v.status),
                  ],
                ),
                const SizedBox(height: 20),

                // Amount card
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
                          const Text('Total Amount',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF6B7280))),
                          const SizedBox(height: 4),
                          Text(
                            '\u20B9${NumberFormat('#,##,###.00', 'en_IN').format(v.totalAmount)}',
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
                          const Text('Expenses',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF6B7280))),
                          const SizedBox(height: 4),
                          Text('${v.expenseCount}',
                              style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF191C1E))),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Submitter info
                _sectionHeader('Submitter'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Center(
                          child: Text(
                            (v.submitter?.displayName ?? 'U')[0].toUpperCase(),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(v.submitter?.displayName ?? 'Unknown',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF191C1E))),
                            if (v.submitter?.email != null)
                              Text(v.submitter!.email!,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF9CA3AF))),
                          ],
                        ),
                      ),
                      if (v.submitter?.employeeId != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(v.submitter!.employeeId!,
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF6B7280))),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Expenses
                _sectionHeader('Expenses'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(strokeWidth: 2),
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
                            const Divider(height: 1, indent: 14, endIndent: 14),
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
                                  '\u20B9${NumberFormat('#,##,###', 'en_IN').format((_expenses[i]['amount'] as num?)?.round() ?? 0)}',
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

                // Approval Timeline
                _sectionHeader('Approval Timeline'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(strokeWidth: 2),
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
                              Column(
                                children: [
                                  Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      color: i == _history.length - 1
                                          ? AppColors.primary
                                          : const Color(0xFFD1D5DB),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  if (i < _history.length - 1)
                                    Container(
                                      width: 2,
                                      height: 36,
                                      color: const Color(0xFFE5E7EB),
                                    ),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
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
                                        padding:
                                            const EdgeInsets.only(top: 4),
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

                // Mark Paid button (only for approved vouchers)
                if (v.status == 'approved')
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: widget.onMarkPaid,
                      icon: const Icon(Icons.payment, size: 18),
                      label: const Text('Mark Paid',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
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
        child: Text(message,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
      ),
    );
  }

  String _formatAction(String action) {
    return switch (action) {
      'submitted' => 'Submitted',
      'manager_approved' => 'Manager Approved',
      'accountant_approved' => 'Accountant Approved',
      'manager_rejected' => 'Manager Rejected',
      'accountant_rejected' => 'Accountant Rejected',
      'reimbursed' => 'Reimbursed',
      _ => action.replaceAll('_', ' ').toUpperCase(),
    };
  }

  String _historyMeta(Map<String, dynamic> h) {
    final actor = h['actor'];
    final name = actor is Map ? (actor['name'] as String? ?? 'System') : 'System';
    final date = h['created_at'] != null
        ? DateFormat('dd MMM, hh:mm a')
            .format(DateTime.parse(h['created_at'] as String))
        : '';
    return 'by $name \u2022 $date';
  }
}
