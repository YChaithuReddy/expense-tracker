import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/employee/expenses/expense_detail_screen.dart';

/// Detail view for a single advance — shows the advance meta plus every
/// expense (bill) linked to it via `expenses.advance_id`.
class AdvanceDetailScreen extends StatefulWidget {
  final Map<String, dynamic> advance;

  const AdvanceDetailScreen({super.key, required this.advance});

  @override
  State<AdvanceDetailScreen> createState() => _AdvanceDetailScreenState();
}

class _AdvanceDetailScreenState extends State<AdvanceDetailScreen> {
  List<Map<String, dynamic>> _bills = [];
  bool _loading = true;
  double _spent = 0;

  @override
  void initState() {
    super.initState();
    _loadBills();
  }

  Future<void> _loadBills() async {
    setState(() => _loading = true);
    try {
      final advanceId = widget.advance['id'];
      final data = await Supabase.instance.client
          .from('expenses')
          .select()
          .eq('advance_id', advanceId)
          .order('date', ascending: false);

      double spent = 0;
      for (final row in data) {
        spent += ((row as Map)['amount'] as num?)?.toDouble() ?? 0;
      }

      if (mounted) {
        setState(() {
          _bills = List<Map<String, dynamic>>.from(data);
          _spent = spent;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatINR(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final whole = parts[0];
    final decimal = parts[1];
    if (whole.length <= 3) return '₹$whole.$decimal';
    final lastThree = whole.substring(whole.length - 3);
    var remaining = whole.substring(0, whole.length - 3);
    final groups = <String>[];
    while (remaining.length > 2) {
      groups.insert(0, remaining.substring(remaining.length - 2));
      remaining = remaining.substring(0, remaining.length - 2);
    }
    if (remaining.isNotEmpty) groups.insert(0, remaining);
    return '₹${groups.join(',')},$lastThree.$decimal';
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'active':
      case 'approved':
        return const Color(0xFF059669);
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFF59E0B);
      case 'rejected':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF6B7280);
    }
  }

  Color _statusBg(String s) {
    switch (s) {
      case 'active':
      case 'approved':
        return const Color(0xFFECFDF5);
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFFFFBEB);
      case 'rejected':
        return const Color(0xFFFEF2F2);
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'active':
        return 'ACTIVE';
      case 'approved':
        return 'APPROVED';
      case 'pending_manager':
      case 'pending_accountant':
        return 'PENDING';
      case 'rejected':
        return 'REJECTED';
      case 'closed':
        return 'CLOSED';
      default:
        return s.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.advance;
    final status = a['status'] as String? ?? 'pending';
    final amount = (a['amount'] as num?)?.toDouble() ?? 0;
    final balance = amount - _spent;
    final projectName = a['project_name'] as String? ?? 'Unknown';
    final visitType = (a['visit_type'] as String? ?? '').toUpperCase();
    final purpose = a['purpose'] as String?;
    final fmt = DateFormat('dd MMM yyyy');

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text('Advance Details',
            style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Color(0xFF191C1E))),
        iconTheme: const IconThemeData(color: Color(0xFF191C1E)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadBills,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Advance summary card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                      color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                      blurRadius: 20,
                      offset: const Offset(0, 4)),
                ],
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                      child: Text(projectName,
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF191C1E)))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: _statusBg(status),
                        borderRadius: BorderRadius.circular(6)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                              color: _statusColor(status), shape: BoxShape.circle)),
                      const SizedBox(width: 4),
                      Text(_statusLabel(status),
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: _statusColor(status))),
                    ]),
                  ),
                ]),
                if (visitType.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(visitType,
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                          color: Color(0xFF0EA5E9))),
                ],
                if (purpose != null && purpose.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(purpose,
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF6B7280))),
                ],
                const SizedBox(height: 18),
                Row(children: [
                  _stat('ALLOCATED', _formatINR(amount), const Color(0xFF006699)),
                  Container(
                      width: 1,
                      height: 36,
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                      color: const Color(0xFFE5E7EB)),
                  _stat('SPENT', _formatINR(_spent), const Color(0xFF059669)),
                  Container(
                      width: 1,
                      height: 36,
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                      color: const Color(0xFFE5E7EB)),
                  _stat('BALANCE', _formatINR(balance), const Color(0xFFF59E0B)),
                ]),
              ]),
            ),
            const SizedBox(height: 20),

            // Bills header
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('BILLS UNDER THIS ADVANCE (${_bills.length})',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.08,
                      color: Color(0xFF6B7280))),
              TextButton(
                  onPressed: _loadBills,
                  child: const Text('Refresh',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF006699)))),
            ]),
            const SizedBox(height: 10),

            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator()))
            else if (_bills.isEmpty)
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                    color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: const Column(children: [
                  Icon(Icons.receipt_long_outlined,
                      size: 44, color: Color(0xFF9CA3AF)),
                  SizedBox(height: 10),
                  Text('No bills linked yet',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6B7280))),
                  SizedBox(height: 4),
                  Text('Bills you add against this advance will appear here',
                      style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                      textAlign: TextAlign.center),
                ]),
              )
            else
              Container(
                decoration: BoxDecoration(
                    color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    for (var i = 0; i < _bills.length; i++) ...[
                      if (i > 0)
                        const Divider(
                            height: 1,
                            thickness: 1,
                            color: Color(0xFFF3F4F6)),
                      _billRow(_bills[i], fmt),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _billRow(Map<String, dynamic> b, DateFormat fmt) {
    final vendor = b['vendor'] as String? ?? 'Unknown';
    final cat = b['category'] as String? ?? '';
    final amt = (b['amount'] as num?)?.toDouble() ?? 0;
    final dateStr = b['date'] as String?;
    DateTime? date;
    if (dateStr != null) {
      try {
        date = DateTime.parse(dateStr);
      } catch (_) {}
    }
    return InkWell(
      onTap: () async {
        await Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => ExpenseDetailScreen(expense: b)));
        _loadBills();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(vendor,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF191C1E))),
                const SizedBox(height: 3),
                Text(
                    '${cat.isNotEmpty ? cat : 'Uncategorised'}${date != null ? ' · ${fmt.format(date)}' : ''}',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF9CA3AF))),
              ])),
          const SizedBox(width: 8),
          Text(_formatINR(amt),
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E))),
          const SizedBox(width: 4),
          const Icon(Icons.arrow_forward_ios,
              size: 12, color: Color(0xFF9CA3AF)),
        ]),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(
        child: Column(children: [
      Text(label,
          style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Color(0xFF9CA3AF)),
          textAlign: TextAlign.center),
      const SizedBox(height: 6),
      Text(value,
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color),
          textAlign: TextAlign.center),
    ]));
  }
}
