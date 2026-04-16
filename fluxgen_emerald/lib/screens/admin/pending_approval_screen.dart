import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../../services/activity_log_service.dart';
import 'package:emerald/widgets/notification_bell.dart';

/// Pending Approval screen for Admin/Accountant dashboard.
///
/// Shows two sections:
/// - ADVANCE REQUESTS: fetched from `advances` table where status is pending.
///   Since advances has NO FK to profiles, profiles are fetched separately
///   by user_id and attached manually.
/// - VOUCHERS: fetched from `vouchers` table where status is pending,
///   with embedded join on `submitted_by` for submitter profile.
///
/// Each card supports View, Approve, and Reject actions with real
/// Supabase mutations and history inserts.
class PendingApprovalScreen extends StatefulWidget {
  const PendingApprovalScreen({super.key});

  @override
  State<PendingApprovalScreen> createState() => _PendingApprovalScreenState();
}

class _PendingApprovalScreenState extends State<PendingApprovalScreen> {
  bool _loading = true;
  String? _error;
  String? _orgId;
  String _userRole = '';

  // Voucher data
  List<Map<String, dynamic>> _pendingVouchers = [];

  // Advance data (with manually attached profiles)
  List<Map<String, dynamic>> _pendingAdvances = [];

  final _supabase = Supabase.instance.client;
  final _dateFormat = DateFormat('dd MMM yyyy');

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Get organization_id and role
      final profile = await _supabase
          .from('profiles')
          .select('organization_id, role')
          .eq('id', user.id)
          .maybeSingle();

      _orgId = profile?['organization_id'] as String?;
      _userRole = (profile?['role'] as String?) ?? '';
      if (_orgId == null || _orgId!.isEmpty) {
        throw Exception('No organization found');
      }

      await Future.wait([
        _loadPendingVouchers(),
        _loadPendingAdvances(),
      ]);

      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadPendingVouchers() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      // Role-based filtering
      List<String> statuses;
      String? filterField;
      String? filterValue;

      if (_userRole == 'manager') {
        statuses = ['pending_manager'];
        filterField = 'manager_id';
        filterValue = user.id;
      } else if (_userRole == 'accountant') {
        statuses = ['manager_approved', 'pending_accountant'];
        filterField = 'accountant_id';
        filterValue = user.id;
      } else {
        // admin: see all pending
        statuses = ['pending_manager', 'manager_approved', 'pending_accountant'];
        filterField = null;
        filterValue = null;
      }

      // Fetch vouchers with pending statuses, join submitter profile
      var query = _supabase
          .from('vouchers')
          .select(
              'id, voucher_number, status, total_amount, expense_count, purpose, submitted_by, created_at, submitted_at, submitter:submitted_by(id, name, email, employee_id)')
          .eq('organization_id', _orgId!)
          .inFilter('status', statuses);

      if (filterField != null && filterValue != null) {
        query = query.eq(filterField, filterValue);
      }

      final data = await query.order('created_at', ascending: false);

      if (mounted) {
        _pendingVouchers = List<Map<String, dynamic>>.from(data);
      }
    } catch (e) {
      // If the join fails (RLS, missing FK, etc.), try without join
      try {
        final user = _supabase.auth.currentUser;
        List<String> statuses;
        String? filterField;
        String? filterValue;

        if (_userRole == 'manager') {
          statuses = ['pending_manager'];
          filterField = 'manager_id';
          filterValue = user?.id;
        } else if (_userRole == 'accountant') {
          statuses = ['manager_approved', 'pending_accountant'];
          filterField = 'accountant_id';
          filterValue = user?.id;
        } else {
          statuses = ['pending_manager', 'manager_approved', 'pending_accountant'];
          filterField = null;
          filterValue = null;
        }

        var query = _supabase
            .from('vouchers')
            .select()
            .eq('organization_id', _orgId!)
            .inFilter('status', statuses);

        if (filterField != null && filterValue != null) {
          query = query.eq(filterField, filterValue);
        }

        final data = await query.order('created_at', ascending: false);

        if (mounted) {
          _pendingVouchers = List<Map<String, dynamic>>.from(data);
        }
      } catch (_) {
        _pendingVouchers = [];
      }
    }
  }

  /// Loads pending advances and manually attaches submitter profiles.
  ///
  /// CRITICAL: The `advances` table has NO foreign key to `profiles`.
  /// We fetch advances first, collect unique user_ids, batch-fetch profiles,
  /// then attach them manually to each advance record.
  Future<void> _loadPendingAdvances() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      // Role-based filtering
      List<String> statuses;
      String? filterField;
      String? filterValue;

      if (_userRole == 'manager') {
        statuses = ['pending_manager'];
        filterField = 'manager_id';
        filterValue = user.id;
      } else if (_userRole == 'accountant') {
        statuses = ['pending_accountant'];
        filterField = 'accountant_id';
        filterValue = user.id;
      } else {
        // admin: see all pending
        statuses = ['pending_manager', 'pending_accountant'];
        filterField = null;
        filterValue = null;
      }

      // Step 1: Fetch advances with pending statuses
      var query = _supabase
          .from('advances')
          .select()
          .eq('organization_id', _orgId!)
          .inFilter('status', statuses);

      if (filterField != null && filterValue != null) {
        query = query.eq(filterField, filterValue);
      }

      final advancesData = await query.order('created_at', ascending: false);

      final advances = List<Map<String, dynamic>>.from(advancesData);

      if (advances.isEmpty) {
        if (mounted) _pendingAdvances = [];
        return;
      }

      // Step 2: Collect unique user_ids from advances
      final userIds = advances
          .map((a) => a['user_id'] as String?)
          .where((id) => id != null && id.isNotEmpty)
          .toSet()
          .toList();

      // Step 3: Batch-fetch profiles for those user_ids
      Map<String, Map<String, dynamic>> profileMap = {};
      if (userIds.isNotEmpty) {
        try {
          final profiles = await _supabase
              .from('profiles')
              .select('id, name, email, employee_id')
              .inFilter('id', userIds);

          for (final p in profiles) {
            final pid = p['id'] as String?;
            if (pid != null) {
              profileMap[pid] = Map<String, dynamic>.from(p);
            }
          }
        } catch (_) {
          // If profiles fetch fails, we proceed without submitter names
        }
      }

      // Step 4: Attach profiles manually to each advance
      for (final adv in advances) {
        final userId = adv['user_id'] as String?;
        if (userId != null && profileMap.containsKey(userId)) {
          adv['_submitter'] = profileMap[userId];
        }
      }

      if (mounted) _pendingAdvances = advances;
    } catch (_) {
      _pendingAdvances = [];
    }
  }

  // ── Voucher Actions ──────────────────────────────────────────────────

  Future<void> _approveVoucher(Map<String, dynamic> voucher) async {
    final currentStatus = voucher['status'] as String? ?? '';
    final voucherId = voucher['id'] as String;

    String newStatus;
    String action;
    if (currentStatus == 'pending_manager') {
      newStatus = 'pending_accountant';
      action = 'manager_approved';
    } else {
      // pending_accountant or manager_approved -> approved
      newStatus = 'approved';
      action = 'accountant_approved';
    }

    try {
      final userId = _supabase.auth.currentUser!.id;

      // Update voucher status
      final updateData = <String, dynamic>{'status': newStatus};
      if (currentStatus == 'pending_manager') {
        updateData['manager_action_at'] = DateTime.now().toIso8601String();
      } else {
        updateData['accountant_action_at'] = DateTime.now().toIso8601String();
      }

      await _supabase
          .from('vouchers')
          .update(updateData)
          .eq('id', voucherId);

      // Update linked expenses when fully approved
      if (newStatus == 'approved') {
        try {
          final links = await _supabase.from('voucher_expenses').select('expense_id').eq('voucher_id', voucherId);
          final expenseIds = (links as List).map((l) => l['expense_id']).toList();
          if (expenseIds.isNotEmpty) {
            await _supabase.from('expenses').update({'voucher_status': 'approved'}).inFilter('id', expenseIds);
          }
        } catch (_) {}
      }

      // Insert voucher_history row
      await _supabase.from('voucher_history').insert({
        'voucher_id': voucherId,
        'action': action,
        'acted_by': userId,
        'comments':
            'Voucher ${voucher['voucher_number'] ?? voucherId.substring(0, 8)} approved',
        'organization_id': _orgId,
      });

      // Notify the submitter
      try {
        await _supabase.from('notifications').insert({
          'user_id': voucher['submitted_by'] ?? voucher['submitter']?['id'],
          'type': 'voucher_approved',
          'title': 'Voucher approved!',
          'message': 'Your voucher ${voucher['voucher_number'] ?? ''} has been approved.',
          'is_read': false,
        });
      } catch (_) {}

      // Log activity
      await ActivityLogService.log('voucher_approved', 'Approved voucher ${voucher['voucher_number']}');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Voucher ${voucher['voucher_number'] ?? ''} approved',
            ),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to approve: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _rejectVoucher(Map<String, dynamic> voucher) async {
    final reason = await _showRejectDialog('voucher');
    if (reason == null) return; // User cancelled

    final voucherId = voucher['id'] as String;

    try {
      final userId = _supabase.auth.currentUser!.id;

      await _supabase.from('vouchers').update({
        'status': 'rejected',
        'rejection_reason': reason,
      }).eq('id', voucherId);

      // Update linked expenses to rejected
      try {
        final links = await _supabase.from('voucher_expenses').select('expense_id').eq('voucher_id', voucherId);
        final expenseIds = (links as List).map((l) => l['expense_id']).toList();
        if (expenseIds.isNotEmpty) {
          await _supabase.from('expenses').update({'voucher_status': 'rejected'}).inFilter('id', expenseIds);
        }
      } catch (_) {}

      await _supabase.from('voucher_history').insert({
        'voucher_id': voucherId,
        'action': 'rejected',
        'acted_by': userId,
        'comments':
            'Voucher ${voucher['voucher_number'] ?? voucherId.substring(0, 8)} rejected: $reason',
        'organization_id': _orgId,
      });

      // Notify the submitter
      try {
        await _supabase.from('notifications').insert({
          'user_id': voucher['submitted_by'] ?? voucher['submitter']?['id'],
          'type': 'voucher_rejected',
          'title': 'Voucher rejected',
          'message': 'Your voucher ${voucher['voucher_number'] ?? ''} has been rejected.${reason.isNotEmpty ? ' Reason: $reason' : ''}',
          'is_read': false,
        });
      } catch (_) {}

      // Log activity
      await ActivityLogService.log('voucher_rejected', 'Rejected voucher ${voucher['voucher_number']}: $reason');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Voucher ${voucher['voucher_number'] ?? ''} rejected',
            ),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reject: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  // ── Advance Actions ──────────────────────────────────────────────────

  Future<void> _approveAdvance(Map<String, dynamic> advance) async {
    final currentStatus = advance['status'] as String? ?? '';
    final advanceId = advance['id'] as String;

    String newStatus;
    if (currentStatus == 'pending_manager') {
      newStatus = 'pending_accountant';
    } else {
      // pending_accountant -> active
      newStatus = 'active';
    }

    try {
      final userId = _supabase.auth.currentUser!.id;

      await _supabase
          .from('advances')
          .update({'status': newStatus})
          .eq('id', advanceId);

      // Insert advance_history row
      await _supabase.from('advance_history').insert({
        'advance_id': advanceId,
        'action': newStatus == 'pending_accountant'
            ? 'manager_approved'
            : 'approved',
        'acted_by': userId,
        'comments':
            'Advance for ${advance['project_name'] ?? 'project'} approved',
        'organization_id': _orgId,
      });

      // Notify the submitter
      try {
        await _supabase.from('notifications').insert({
          'user_id': advance['user_id'],
          'type': 'advance_approved',
          'title': 'Advance approved!',
          'message': 'Your advance request for ${advance['project_name'] ?? 'project'} has been approved.',
          'is_read': false,
        });
      } catch (_) {}

      // Check if submitter has bank details, notify if missing
      try {
        final bankCheck = await _supabase.from('employee_bank_details').select('id').eq('user_id', advance['user_id']).maybeSingle();
        if (bankCheck == null) {
          await _supabase.from('notifications').insert({
            'user_id': advance['user_id'],
            'type': 'system',
            'title': 'Add bank details',
            'message': 'Please add your bank details in Profile settings to receive payments.',
            'is_read': false,
          });
        }
      } catch (_) {}

      // Log activity
      await ActivityLogService.log('advance_approved', 'Approved advance for ${advance['project_name']}');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Advance for ${advance['project_name'] ?? 'project'} approved',
            ),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to approve advance: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _rejectAdvance(Map<String, dynamic> advance) async {
    final reason = await _showRejectDialog('advance');
    if (reason == null) return;

    final advanceId = advance['id'] as String;

    try {
      final userId = _supabase.auth.currentUser!.id;

      await _supabase.from('advances').update({
        'status': 'rejected',
        'rejection_reason': reason,
      }).eq('id', advanceId);

      await _supabase.from('advance_history').insert({
        'advance_id': advanceId,
        'action': 'rejected',
        'acted_by': userId,
        'comments':
            'Advance for ${advance['project_name'] ?? 'project'} rejected: $reason',
        'organization_id': _orgId,
      });

      // Notify the submitter
      try {
        await _supabase.from('notifications').insert({
          'user_id': advance['user_id'],
          'type': 'advance_rejected',
          'title': 'Advance rejected',
          'message': 'Your advance request for ${advance['project_name'] ?? 'project'} has been rejected.${reason.isNotEmpty ? ' Reason: $reason' : ''}',
          'is_read': false,
        });
      } catch (_) {}

      // Log activity
      await ActivityLogService.log('advance_rejected', 'Rejected advance for ${advance['project_name']}: $reason');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Advance for ${advance['project_name'] ?? 'project'} rejected',
            ),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reject advance: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  // ── Rejection Reason Dialog ──────────────────────────────────────────

  Future<String?> _showRejectDialog(String itemType) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            const Icon(Icons.cancel_outlined, color: Color(0xFFEF4444), size: 24),
            const SizedBox(width: 8),
            Text(
              'Reject ${itemType[0].toUpperCase()}${itemType.substring(1)}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Please provide a reason for rejection:',
              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Enter reason...',
                hintStyle: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF9CA3AF),
                ),
                filled: true,
                fillColor: const Color(0xFFF3F4F6),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(
                    color: Color(0xFFEF4444),
                    width: 2,
                  ),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Color(0xFF6B7280)),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter a reason'),
                    backgroundColor: Color(0xFFF59E0B),
                  ),
                );
                return;
              }
              Navigator.pop(ctx, text);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  // ── Voucher Detail Bottom Sheet ───────────────────────────────────────

  void _showVoucherDetail(Map<String, dynamic> voucher) {
    final voucherId = voucher['id'] as String;
    final voucherNumber = voucher['voucher_number'] as String? ?? 'No number';
    final status = voucher['status'] as String? ?? 'pending';
    final totalAmount = (voucher['total_amount'] is num)
        ? (voucher['total_amount'] as num).toDouble()
        : double.tryParse(voucher['total_amount']?.toString() ?? '0') ?? 0.0;
    final createdAt =
        voucher['submitted_at'] as String? ?? voucher['created_at'] as String?;
    final submitter = voucher['submitter'] as Map<String, dynamic>?;
    final employeeName = submitter?['name'] as String? ??
        submitter?['email'] as String? ??
        'Unknown Employee';
    final employeeEmail = submitter?['email'] as String? ?? '';
    final employeeId = submitter?['employee_id'] as String? ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _PendingVoucherDetailSheet(
        voucherId: voucherId,
        voucherNumber: voucherNumber,
        status: status,
        totalAmount: totalAmount,
        submittedDate: createdAt,
        employeeName: employeeName,
        employeeEmail: employeeEmail,
        employeeId: employeeId,
        statusLabel: _statusLabel,
        statusColor: _statusColor,
        statusBg: _statusBg,
        formatDate: _formatDate,
      ),
    );
  }

  // ── Advance Detail Bottom Sheet ─────────────────────────────────────

  void _showAdvanceDetail(Map<String, dynamic> advance) {
    final advanceId = advance['id'] as String;
    final projectName = advance['project_name'] as String? ?? 'Unknown Project';
    final amount = (advance['amount'] is num)
        ? (advance['amount'] as num).toDouble()
        : double.tryParse(advance['amount']?.toString() ?? '0') ?? 0.0;
    final status = advance['status'] as String? ?? 'pending';
    final visitType = advance['visit_type'] as String? ?? 'project';
    final notes = advance['notes'] as String?;
    final createdAt = advance['created_at'] as String?;
    final submitter = advance['_submitter'] as Map<String, dynamic>?;
    final employeeName = submitter?['name'] as String? ??
        submitter?['email'] as String? ??
        'Unknown Employee';
    final employeeEmail = submitter?['email'] as String? ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _AdvanceDetailSheet(
        advanceId: advanceId,
        projectName: projectName,
        amount: amount,
        status: status,
        visitType: visitType,
        notes: notes,
        submittedDate: createdAt,
        employeeName: employeeName,
        employeeEmail: employeeEmail,
        statusLabel: _statusLabel,
        statusColor: _statusColor,
        statusBg: _statusBg,
        typeColor: _typeColor,
        formatDate: _formatDate,
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  String _statusLabel(String status) {
    switch (status) {
      case 'pending_manager':
        return 'PENDING MGR';
      case 'manager_approved':
        return 'MGR APPROVED';
      case 'pending_accountant':
        return 'PENDING ACCT';
      case 'approved':
        return 'APPROVED';
      case 'rejected':
        return 'REJECTED';
      case 'active':
        return 'ACTIVE';
      default:
        return status.toUpperCase();
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFF59E0B);
      case 'manager_approved':
        return const Color(0xFF0EA5E9);
      case 'approved':
      case 'active':
        return const Color(0xFF059669);
      case 'rejected':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF6B7280);
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFFFFBEB);
      case 'manager_approved':
        return const Color(0xFFF0F9FF);
      case 'approved':
      case 'active':
        return const Color(0xFFECFDF5);
      case 'rejected':
        return const Color(0xFFFEF2F2);
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  Color _typeColor(String? type) {
    switch (type) {
      case 'project':
        return const Color(0xFF0EA5E9);
      case 'service':
        return const Color(0xFF0D9488);
      case 'survey':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF6B7280);
    }
  }

  String _formatDate(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '';
    try {
      return _dateFormat.format(DateTime.parse(isoDate));
    } catch (_) {
      return '';
    }
  }

  int get _totalPendingCount =>
      _pendingVouchers.length + _pendingAdvances.length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: CustomScrollView(
          slivers: [
            // ── AppBar ────────────────────────────────────────────
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              title: Row(
                children: [
                  const Text(
                    'Pending Approval',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (!_loading && _totalPendingCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$_totalPendingCount',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFF59E0B),
                        ),
                      ),
                    ),
                ],
              ),
              actions: const [
                NotificationBell(),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Loading State ────────────────────────────────
                  if (_loading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(60),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF006699),
                        ),
                      ),
                    )

                  // ── Error State ──────────────────────────────────
                  else if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 48,
                            color: Color(0xFFBA1A1A),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Failed to load approvals',
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
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: _loadData,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF006699),
                              side: const BorderSide(
                                color: Color(0xFF006699),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    )

                  // ── Content ──────────────────────────────────────
                  else ...[
                    // ── ADVANCE REQUESTS section ───────────────────
                    _buildSectionHeader(
                      'ADVANCE REQUESTS',
                      _pendingAdvances.length,
                    ),
                    const SizedBox(height: 10),

                    if (_pendingAdvances.isEmpty)
                      _buildEmptySection(
                        Icons.account_balance_wallet_outlined,
                        'No pending advance requests',
                      )
                    else
                      ...List.generate(_pendingAdvances.length, (i) {
                        final adv = _pendingAdvances[i];
                        return Padding(
                          padding: EdgeInsets.only(
                            bottom:
                                i < _pendingAdvances.length - 1 ? 10 : 0,
                          ),
                          child: _buildAdvanceCard(adv),
                        );
                      }),

                    const SizedBox(height: 24),

                    // ── VOUCHERS section ───────────────────────────
                    _buildSectionHeader(
                      'VOUCHERS',
                      _pendingVouchers.length,
                    ),
                    const SizedBox(height: 10),

                    if (_pendingVouchers.isEmpty)
                      _buildEmptySection(
                        Icons.receipt_long_outlined,
                        'No pending vouchers',
                      )
                    else
                      ...List.generate(_pendingVouchers.length, (i) {
                        final v = _pendingVouchers[i];
                        return Padding(
                          padding: EdgeInsets.only(
                            bottom:
                                i < _pendingVouchers.length - 1 ? 10 : 0,
                          ),
                          child: _buildVoucherCard(v),
                        );
                      }),

                    const SizedBox(height: 32),
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Section Header ────────────────────────────────────────────────────

  Widget _buildSectionHeader(String title, int count) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.08,
            color: Color(0xFF6B7280),
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7280),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildEmptySection(IconData icon, String message) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, size: 28, color: const Color(0xFF9CA3AF)),
          const SizedBox(width: 12),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }

  // ── Advance Card ──────────────────────────────────────────────────────

  Widget _buildAdvanceCard(Map<String, dynamic> advance) {
    final projectName =
        advance['project_name'] as String? ?? 'Unknown Project';
    final amount = (advance['amount'] is num)
        ? (advance['amount'] as num).toDouble()
        : double.tryParse(advance['amount']?.toString() ?? '0') ?? 0.0;
    final status = advance['status'] as String? ?? 'pending';
    final type = advance['visit_type'] as String? ?? 'project';
    final createdAt = advance['created_at'] as String?;

    // Manually attached profile (via _submitter key)
    final submitter = advance['_submitter'] as Map<String, dynamic>?;
    final employeeName =
        submitter?['name'] as String? ??
        submitter?['email'] as String? ??
        'Unknown Employee';
    final employeeId = submitter?['employee_id'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
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
          // Row 1: Project name + amount
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      projectName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF191C1E),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.person_outline,
                          size: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            employeeName,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (employeeId.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Text(
                            '($employeeId)',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Text(
                '\u20B9${amount.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Row 2: Type badge + status badge + date
          Row(
            children: [
              // Type badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: _typeColor(type).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  type.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: _typeColor(type),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: _statusBg(status),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _statusColor(status),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _statusLabel(status),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: _statusColor(status),
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              if (createdAt != null)
                Text(
                  _formatDate(createdAt),
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 14),

          // Row 3: Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showAdvanceDetail(advance),
                  icon: const Icon(Icons.visibility_outlined, size: 16),
                  label: const Text('View'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF006699),
                    side: const BorderSide(color: Color(0xFFE5E7EB)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _approveAdvance(advance),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Approve'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _rejectAdvance(advance),
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('Reject'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Voucher Card ──────────────────────────────────────────────────────

  Widget _buildVoucherCard(Map<String, dynamic> voucher) {
    final voucherNumber =
        voucher['voucher_number'] as String? ?? 'No number';
    final status = voucher['status'] as String? ?? 'pending';
    final totalAmount = (voucher['total_amount'] is num)
        ? (voucher['total_amount'] as num).toDouble()
        : double.tryParse(voucher['total_amount']?.toString() ?? '0') ?? 0.0;
    final expenseCount = (voucher['expense_count'] is num)
        ? (voucher['expense_count'] as num).toInt()
        : int.tryParse(voucher['expense_count']?.toString() ?? '0') ?? 0;
    final purpose = voucher['purpose'] as String?;
    final createdAt =
        voucher['submitted_at'] as String? ?? voucher['created_at'] as String?;

    // Submitter from embedded join
    final submitter = voucher['submitter'] as Map<String, dynamic>?;
    final employeeName =
        submitter?['name'] as String? ??
        submitter?['email'] as String? ??
        'Unknown Employee';
    final employeeId = submitter?['employee_id'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
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
          // Row 1: Voucher number + amount
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      voucherNumber,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF191C1E),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.person_outline,
                          size: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            employeeName,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (employeeId.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Text(
                            '($employeeId)',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (purpose != null && purpose.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        purpose,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\u20B9${totalAmount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$expenseCount expense${expenseCount != 1 ? 's' : ''}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Row 2: Status badge + date
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: _statusBg(status),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _statusColor(status),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _statusLabel(status),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: _statusColor(status),
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              if (createdAt != null)
                Text(
                  _formatDate(createdAt),
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 14),

          // Row 3: Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showVoucherDetail(voucher),
                  icon: const Icon(Icons.visibility_outlined, size: 16),
                  label: const Text('View'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF006699),
                    side: const BorderSide(color: Color(0xFFE5E7EB)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _approveVoucher(voucher),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Approve'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _rejectVoucher(voucher),
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('Reject'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pending Voucher Detail Bottom Sheet
// ════════════════════════════════════════════════════════════════════════════

class _PendingVoucherDetailSheet extends StatefulWidget {
  final String voucherId;
  final String voucherNumber;
  final String status;
  final double totalAmount;
  final String? submittedDate;
  final String employeeName;
  final String employeeEmail;
  final String employeeId;
  final String Function(String) statusLabel;
  final Color Function(String) statusColor;
  final Color Function(String) statusBg;
  final String Function(String?) formatDate;

  const _PendingVoucherDetailSheet({
    required this.voucherId,
    required this.voucherNumber,
    required this.status,
    required this.totalAmount,
    this.submittedDate,
    required this.employeeName,
    required this.employeeEmail,
    required this.employeeId,
    required this.statusLabel,
    required this.statusColor,
    required this.statusBg,
    required this.formatDate,
  });

  @override
  State<_PendingVoucherDetailSheet> createState() =>
      _PendingVoucherDetailSheetState();
}

class _PendingVoucherDetailSheetState
    extends State<_PendingVoucherDetailSheet> {
  bool _loadingDetail = true;
  List<Map<String, dynamic>> _expenses = [];
  List<Map<String, dynamic>> _history = [];
  final _fmtTime = DateFormat('dd MMM, hh:mm a');

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    try {
      final supabase = Supabase.instance.client;

      // Fetch expenses via voucher_expenses junction
      final expLinks = await supabase
          .from('voucher_expenses')
          .select('expense_id')
          .eq('voucher_id', widget.voucherId);

      final expenseIds = (expLinks as List<dynamic>)
          .map((r) => r['expense_id'] as String)
          .toList();

      if (expenseIds.isNotEmpty) {
        final expData = await supabase
            .from('expenses')
            .select()
            .inFilter('id', expenseIds)
            .order('date', ascending: false);
        _expenses = List<Map<String, dynamic>>.from(expData);
      }

      // Fetch approval timeline
      try {
        final histData = await supabase
            .from('voucher_history')
            .select('*, actor:performed_by(id, name)')
            .eq('voucher_id', widget.voucherId)
            .order('created_at', ascending: true);
        _history = List<Map<String, dynamic>>.from(histData);
      } catch (_) {
        // Try alternative column name
        try {
          final histData = await supabase
              .from('voucher_history')
              .select('*, actor:acted_by(id, name)')
              .eq('voucher_id', widget.voucherId)
              .order('created_at', ascending: true);
          _history = List<Map<String, dynamic>>.from(histData);
        } catch (_) {
          _history = [];
        }
      }

      if (mounted) setState(() => _loadingDetail = false);
    } catch (e) {
      if (mounted) setState(() => _loadingDetail = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                // Header: voucher number + status
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.voucherNumber,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.formatDate(widget.submittedDate),
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
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: widget.statusBg(widget.status),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        widget.statusLabel(widget.status),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: widget.statusColor(widget.status),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Total amount card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006699).withValues(alpha: 0.05),
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
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '\u20B9${NumberFormat('#,##,###.00', 'en_IN').format(widget.totalAmount)}',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
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
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_expenses.length}',
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

                // Submitter info
                _buildSectionTitle('SUBMITTER'),
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
                          color: const Color(0xFF006699).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Center(
                          child: Text(
                            widget.employeeName[0].toUpperCase(),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.employeeName,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF191C1E),
                              ),
                            ),
                            if (widget.employeeEmail.isNotEmpty)
                              Text(
                                widget.employeeEmail,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (widget.employeeId.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            widget.employeeId,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Expenses list
                _buildSectionTitle('EXPENSES'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (_expenses.isEmpty)
                  _buildEmptyBox('No expenses linked')
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
                              height: 1,
                              indent: 14,
                              endIndent: 14,
                            ),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
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
                _buildSectionTitle('APPROVAL TIMELINE'),
                const SizedBox(height: 8),
                if (_loadingDetail)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (_history.isEmpty)
                  _buildEmptyBox('No history available')
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
                                          ? const Color(0xFF006699)
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
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _formatAction(
                                        _history[i]['action'] as String? ?? '',
                                      ),
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
                                    if (_history[i]['description'] != null &&
                                        (_history[i]['description'] as String)
                                            .isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          _history[i]['description'] as String,
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF9CA3AF),
      ),
    );
  }

  Widget _buildEmptyBox(String message) {
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

  String _formatAction(String action) {
    return switch (action) {
      'submitted' => 'Submitted',
      'manager_approved' => 'Manager Approved',
      'approved' => 'Approved',
      'rejected' => 'Rejected',
      'reimbursed' => 'Reimbursed',
      _ => action.replaceAll('_', ' ').toUpperCase(),
    };
  }

  String _historyMeta(Map<String, dynamic> h) {
    final actor = h['actor'];
    final name =
        actor is Map ? (actor['name'] as String? ?? 'System') : 'System';
    final date = h['created_at'] != null
        ? _fmtTime.format(DateTime.parse(h['created_at'] as String))
        : '';
    return 'by $name \u2022 $date';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Advance Detail Bottom Sheet
// ════════════════════════════════════════════════════════════════════════════

class _AdvanceDetailSheet extends StatefulWidget {
  final String advanceId;
  final String projectName;
  final double amount;
  final String status;
  final String visitType;
  final String? notes;
  final String? submittedDate;
  final String employeeName;
  final String employeeEmail;
  final String Function(String) statusLabel;
  final Color Function(String) statusColor;
  final Color Function(String) statusBg;
  final Color Function(String?) typeColor;
  final String Function(String?) formatDate;

  const _AdvanceDetailSheet({
    required this.advanceId,
    required this.projectName,
    required this.amount,
    required this.status,
    required this.visitType,
    this.notes,
    this.submittedDate,
    required this.employeeName,
    required this.employeeEmail,
    required this.statusLabel,
    required this.statusColor,
    required this.statusBg,
    required this.typeColor,
    required this.formatDate,
  });

  @override
  State<_AdvanceDetailSheet> createState() => _AdvanceDetailSheetState();
}

class _AdvanceDetailSheetState extends State<_AdvanceDetailSheet> {
  bool _loadingHistory = true;
  List<Map<String, dynamic>> _history = [];
  final _fmtTime = DateFormat('dd MMM, hh:mm a');

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final supabase = Supabase.instance.client;

      try {
        final histData = await supabase
            .from('advance_history')
            .select('*, actor:performed_by(id, name)')
            .eq('advance_id', widget.advanceId)
            .order('created_at', ascending: true);
        _history = List<Map<String, dynamic>>.from(histData);
      } catch (_) {
        _history = [];
      }

      if (mounted) setState(() => _loadingHistory = false);
    } catch (e) {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
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
                // Header: project name + status
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.projectName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.formatDate(widget.submittedDate),
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
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: widget.statusBg(widget.status),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        widget.statusLabel(widget.status),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: widget.statusColor(widget.status),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Amount + type card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006699).withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Amount',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '\u20B9${NumberFormat('#,##,###.00', 'en_IN').format(widget.amount)}',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: widget.typeColor(widget.visitType)
                              .withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          widget.visitType.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: widget.typeColor(widget.visitType),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Submitter info
                _buildSectionTitle('SUBMITTER'),
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
                          color: const Color(0xFF006699).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Center(
                          child: Text(
                            widget.employeeName[0].toUpperCase(),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.employeeName,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF191C1E),
                              ),
                            ),
                            if (widget.employeeEmail.isNotEmpty)
                              Text(
                                widget.employeeEmail,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Notes
                if (widget.notes != null && widget.notes!.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _buildSectionTitle('NOTES'),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Text(
                      widget.notes!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF444653),
                        height: 1.5,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 20),

                // Timeline
                _buildSectionTitle('APPROVAL TIMELINE'),
                const SizedBox(height: 8),
                if (_loadingHistory)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (_history.isEmpty)
                  _buildEmptyBox('No history available')
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
                                          ? const Color(0xFF006699)
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
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _formatAction(
                                        _history[i]['action'] as String? ?? '',
                                      ),
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
                                    if (_history[i]['description'] != null &&
                                        (_history[i]['description'] as String)
                                            .isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          _history[i]['description'] as String,
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF9CA3AF),
      ),
    );
  }

  Widget _buildEmptyBox(String message) {
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

  String _formatAction(String action) {
    return switch (action) {
      'submitted' => 'Submitted',
      'manager_approved' => 'Manager Approved',
      'approved' => 'Approved',
      'active' => 'Activated',
      'rejected' => 'Rejected',
      _ => action.replaceAll('_', ' ').toUpperCase(),
    };
  }

  String _historyMeta(Map<String, dynamic> h) {
    final actor = h['actor'];
    final name =
        actor is Map ? (actor['name'] as String? ?? 'System') : 'System';
    final date = h['created_at'] != null
        ? _fmtTime.format(DateTime.parse(h['created_at'] as String))
        : '';
    return 'by $name \u2022 $date';
  }
}
