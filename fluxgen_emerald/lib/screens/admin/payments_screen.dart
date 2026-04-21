import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/theme/app_colors.dart';
import '../../services/activity_log_service.dart';

/// Admin Payments screen showing pending and completed payments.
///
/// Features:
/// - Stats pills: Pending / Completed / Failed counts with amounts
/// - Pending payments section with "Mark Paid" action
/// - Payment history section with method, reference, and status badge
/// - Pull-to-refresh
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  bool _loading = true;
  String? _error;

  // Stats
  int _pendingCount = 0;
  double _pendingAmount = 0;
  int _completedCount = 0;
  double _completedAmount = 0;
  int _failedCount = 0;
  double _failedAmount = 0;

  // Payment lists
  List<Map<String, dynamic>> _pendingPayments = [];
  List<Map<String, dynamic>> _historyPayments = [];

  String? _orgId;

  @override
  void initState() {
    super.initState();
    _loadPayments();
  }

  Future<void> _loadPayments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Get org id
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
      _orgId = profile?['organization_id'] as String?;

      // Fetch all payment_transactions for this org
      var query = Supabase.instance.client
          .from('payment_transactions')
          .select('*, profile:user_id(id, name, email, employee_id, department)');

      if (_orgId != null && _orgId!.isNotEmpty) {
        query = query.eq('organization_id', _orgId!);
      }

      final data = await query.order('created_at', ascending: false);
      final allPayments = List<Map<String, dynamic>>.from(data);

      // Compute stats
      int pCount = 0, cCount = 0, fCount = 0;
      double pAmt = 0, cAmt = 0, fAmt = 0;

      final pending = <Map<String, dynamic>>[];
      final history = <Map<String, dynamic>>[];

      for (final p in allPayments) {
        final status = p['status'] as String? ?? 'pending';
        final amt = (p['amount'] as num?)?.toDouble() ?? 0;

        switch (status) {
          case 'pending':
            pCount++;
            pAmt += amt;
            pending.add(p);
            break;
          case 'completed':
            cCount++;
            cAmt += amt;
            history.add(p);
            break;
          case 'failed':
            fCount++;
            fAmt += amt;
            history.add(p);
            break;
          default:
            history.add(p);
        }
      }

      if (!mounted) return;
      setState(() {
        _pendingCount = pCount;
        _pendingAmount = pAmt;
        _completedCount = cCount;
        _completedAmount = cAmt;
        _failedCount = fCount;
        _failedAmount = fAmt;
        _pendingPayments = pending;
        _historyPayments = history;
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
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadPayments,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // AppBar
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Payments',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  Text(
                    'Finance > Payments',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ),
              toolbarHeight: 64,
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (_loading)
                    _buildLoadingState()
                  else if (_error != null)
                    _buildError()
                  else ...[
                    // Stats pills row
                    Row(
                      children: [
                        Expanded(
                          child: _StatPill(
                            label: 'Pending',
                            count: _pendingCount,
                            amount: _pendingAmount,
                            color: const Color(0xFFF59E0B),
                            bgColor: const Color(0xFFFFFBEB),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _StatPill(
                            label: 'Completed',
                            count: _completedCount,
                            amount: _completedAmount,
                            color: const Color(0xFF059669),
                            bgColor: const Color(0xFFECFDF5),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _StatPill(
                            label: 'Failed',
                            count: _failedCount,
                            amount: _failedAmount,
                            color: const Color(0xFFEF4444),
                            bgColor: const Color(0xFFFEF2F2),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Pending Payments section
                    _sectionTitle('PENDING PAYMENTS'),
                    const SizedBox(height: 10),
                    if (_pendingPayments.isEmpty)
                      _emptyCard('No pending payments')
                    else
                      ..._pendingPayments.map((p) => _PendingPaymentCard(
                            payment: p,
                            onMarkPaid: () => _handleMarkPaid(p),
                          )),
                    const SizedBox(height: 24),

                    // Payment History section
                    _sectionTitle('PAYMENT HISTORY'),
                    const SizedBox(height: 10),
                    if (_historyPayments.isEmpty)
                      _emptyCard('No payment history')
                    else
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          children: [
                            for (int i = 0; i < _historyPayments.length; i++) ...[
                              if (i > 0)
                                const Divider(
                                    height: 1, indent: 14, endIndent: 14),
                              _HistoryPaymentRow(payment: _historyPayments[i]),
                            ],
                          ],
                        ),
                      ),
                    const SizedBox(height: 24),
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Mark Paid Flow ───────────────────────────────────────────────────

  void _handleMarkPaid(Map<String, dynamic> payment) {
    String method = 'NEFT';
    final refController = TextEditingController();
    bool submitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Complete Payment',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _fmtAmt((payment['amount'] as num?)?.toDouble() ?? 0),
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary),
              ),
              const SizedBox(height: 16),
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
                    value: method,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'NEFT', child: Text('NEFT')),
                      DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                      DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'Cheque', child: Text('Cheque')),
                    ],
                    onChanged: (v) {
                      if (v != null) setDialogState(() => method = v);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Reference',
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
                        final userId =
                            Supabase.instance.client.auth.currentUser!.id;
                        final paymentRef =
                            refController.text.trim().isNotEmpty
                                ? refController.text.trim()
                                : null;
                        final paymentUserId =
                            payment['user_id'] as String?;

                        await Supabase.instance.client
                            .from('payment_transactions')
                            .update({
                              'status': 'completed',
                              'payment_method': method.toLowerCase(),
                              'payment_reference': paymentRef,
                              'completed_at':
                                  DateTime.now().toIso8601String(),
                              'initiated_by': userId,
                            })
                            .eq('id', payment['id'] as String);

                        // Also update voucher if linked
                        final voucherId = payment['voucher_id'] as String?;
                        if (voucherId != null && voucherId.isNotEmpty) {
                          await Supabase.instance.client
                              .from('vouchers')
                              .update({
                                'status': 'reimbursed',
                                'payment_method': method.toLowerCase(),
                                'payment_reference': paymentRef,
                                'payment_date': DateTime.now()
                                    .toIso8601String()
                                    .split('T')
                                    .first,
                                'paid_by': userId,
                              })
                              .eq('id', voucherId);
                        }

                        // Also update linked advance if exists
                        final advanceId =
                            payment['advance_id'] as String?;
                        if (advanceId != null &&
                            advanceId.isNotEmpty) {
                          await Supabase.instance.client
                              .from('advances')
                              .update({
                                'payment_status': 'completed',
                                'payment_transaction_id':
                                    payment['id'] as String,
                              })
                              .eq('id', advanceId);

                          // Insert advance_history
                          await Supabase.instance.client
                              .from('advance_history')
                              .insert({
                            'advance_id': advanceId,
                            'action': 'payment_completed',
                            'acted_by': userId,
                            'comments':
                                'Paid via ${method.toUpperCase()}${paymentRef != null ? ' (Ref: $paymentRef)' : ''}',
                            'previous_status': 'approved',
                            'new_status': 'completed',
                          });

                          // Get advance details for notification message
                          final advanceData = await Supabase
                              .instance.client
                              .from('advances')
                              .select(
                                  'user_id, amount, project_name')
                              .eq('id', advanceId)
                              .maybeSingle();

                          if (advanceData != null) {
                            final advUserId = advanceData['user_id']
                                as String?;
                            final advAmt =
                                (advanceData['amount'] as num?)
                                        ?.toDouble() ??
                                    0;
                            final projName =
                                advanceData['project_name']
                                        as String? ??
                                    '';
                            if (advUserId != null) {
                              await _createPaymentNotification(
                                advUserId,
                                'Payment completed!',
                                'Your advance of \u20B9${advAmt.round()} for $projName has been paid.${paymentRef != null ? ' Reference: $paymentRef' : ''}',
                                advanceId,
                                'advance',
                              );
                            }
                          }
                        }

                        // Create notification for the payment recipient
                        if (paymentUserId != null &&
                            paymentUserId.isNotEmpty &&
                            (advanceId == null ||
                                advanceId.isEmpty)) {
                          final amt = (payment['amount'] as num?)
                                  ?.toDouble() ??
                              0;
                          await _createPaymentNotification(
                            paymentUserId,
                            'Payment completed!',
                            'Your advance/voucher payment of \u20B9${amt.round()} has been processed.${paymentRef != null ? ' Reference: $paymentRef' : ''}',
                            payment['id'] as String,
                            'voucher',
                          );
                        }

                        // Log activity
                        final logAmt = (payment['amount'] as num?)?.toDouble() ?? 0;
                        await ActivityLogService.log('payment_completed', 'Completed payment of \u20B9${logAmt.round()}');

                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Payment completed'),
                              backgroundColor: Color(0xFF059669),
                            ),
                          );
                        }
                        _loadPayments();
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
                  : const Text('Confirm',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  /// Creates a notification for the payment recipient.
  Future<void> _createPaymentNotification(
    String recipientUserId,
    String title,
    String message,
    String referenceId,
    String referenceType,
  ) async {
    try {
      await Supabase.instance.client.from('notifications').insert({
        'user_id': recipientUserId,
        'organization_id': _orgId,
        'type': 'system',
        'title': title,
        'message': message,
        'is_read': false,
        'reference_id': referenceId,
        'reference_type': referenceType,
      });
    } catch (e) {
      // Non-blocking — don't fail the payment if notification fails
      debugPrint('Failed to create payment notification: $e');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  Widget _sectionTitle(String title) {
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

  Widget _emptyCard(String message) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.payment_outlined, size: 36, color: Colors.grey[300]),
            const SizedBox(height: 8),
            Text(message,
                style:
                    const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Column(
      children: [
        // Stats shimmer
        Row(
          children: List.generate(
            3,
            (_) => Expanded(
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        // Card shimmer
        ...List.generate(
          4,
          (_) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ],
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
          const Text('Failed to load payments',
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
            onPressed: _loadPayments,
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

  String _fmtAmt(double a) =>
      '\u20B9${NumberFormat('#,##,###', 'en_IN').format(a.round())}';
}

// ════════════════════════════════════════════════════════════════════════
// Stat Pill
// ════════════════════════════════════════════════════════════════════════

class _StatPill extends StatelessWidget {
  final String label;
  final int count;
  final double amount;
  final Color color;
  final Color bgColor;

  const _StatPill({
    required this.label,
    required this.count,
    required this.amount,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: color)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '$count',
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w700, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            '\u20B9${NumberFormat('#,##,###', 'en_IN').format(amount.round())}',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: color.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Pending Payment Card
// ════════════════════════════════════════════════════════════════════════

class _PendingPaymentCard extends StatelessWidget {
  final Map<String, dynamic> payment;
  final VoidCallback onMarkPaid;

  const _PendingPaymentCard({required this.payment, required this.onMarkPaid});

  @override
  Widget build(BuildContext context) {
    final profile = payment['profile'];
    final name = profile is Map
        ? (profile['name'] as String? ?? 'Unknown')
        : 'Unknown';
    final department = profile is Map
        ? (profile['department'] as String? ?? '')
        : '';
    final amount = (payment['amount'] as num?)?.toDouble() ?? 0;
    final date = payment['created_at'] != null
        ? DateFormat('dd MMM yyyy')
            .format(DateTime.parse(payment['created_at'] as String))
        : 'N/A';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  name[0].toUpperCase(),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFF59E0B),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF191C1E))),
                  const SizedBox(height: 2),
                  Text(
                    '${department.isNotEmpty ? '$department \u2022 ' : ''}$date',
                    style:
                        const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                  ),
                ],
              ),
            ),
            // Amount + action
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\u20B9${NumberFormat('#,##,###', 'en_IN').format(amount.round())}',
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E)),
                ),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: onMarkPaid,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Mark Paid',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
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

// ════════════════════════════════════════════════════════════════════════
// History Payment Row
// ════════════════════════════════════════════════════════════════════════

class _HistoryPaymentRow extends StatelessWidget {
  final Map<String, dynamic> payment;
  const _HistoryPaymentRow({required this.payment});

  @override
  Widget build(BuildContext context) {
    final profile = payment['profile'];
    final name = profile is Map
        ? (profile['name'] as String? ?? 'Unknown')
        : 'Unknown';
    final amount = (payment['amount'] as num?)?.toDouble() ?? 0;
    final method = (payment['payment_method'] as String? ?? '').toUpperCase();
    final reference = payment['payment_reference'] as String? ?? '';
    final status = payment['status'] as String? ?? '';
    final date = payment['completed_at'] != null
        ? DateFormat('dd MMM yyyy')
            .format(DateTime.parse(payment['completed_at'] as String))
        : payment['created_at'] != null
            ? DateFormat('dd MMM yyyy')
                .format(DateTime.parse(payment['created_at'] as String))
            : '';

    final isCompleted = status == 'completed';
    final statusColor =
        isCompleted ? const Color(0xFF059669) : const Color(0xFFEF4444);
    final statusBg =
        isCompleted ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                name[0].toUpperCase(),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF444653),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF191C1E))),
                const SizedBox(height: 2),
                Text(
                  '${method.isNotEmpty ? method : ''}${reference.isNotEmpty ? ' \u2022 $reference' : ''} \u2022 $date',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Amount + status
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\u20B9${NumberFormat('#,##,###', 'en_IN').format(amount.round())}',
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF191C1E)),
              ),
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isCompleted ? 'Completed' : 'Failed',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
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
