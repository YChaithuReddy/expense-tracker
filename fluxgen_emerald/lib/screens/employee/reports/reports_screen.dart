import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import 'package:emerald/widgets/notification_bell.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _expenses = [];
  DateTime? _dateFrom, _dateTo;

  // Computed analytics
  Map<String, _CatData> _categories = {};
  Map<String, _CatData> _vendors = {};
  Map<String, _CatData> _months = {};
  Map<String, _CatData> _payModes = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      var query = Supabase.instance.client
          .from('expenses')
          .select()
          .eq('user_id', userId)
          .order('date', ascending: false);

      final data = await query;
      List<Map<String, dynamic>> expenses = List<Map<String, dynamic>>.from(data);

      // Apply date filter client-side
      if (_dateFrom != null) {
        expenses = expenses.where((e) {
          final d = DateTime.tryParse(e['date'] ?? '');
          return d != null && !d.isBefore(_dateFrom!);
        }).toList();
      }
      if (_dateTo != null) {
        expenses = expenses.where((e) {
          final d = DateTime.tryParse(e['date'] ?? '');
          return d != null && !d.isAfter(_dateTo!);
        }).toList();
      }

      _computeAnalytics(expenses);
      if (mounted) setState(() { _expenses = expenses; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _computeAnalytics(List<Map<String, dynamic>> expenses) {
    final cats = <String, _CatData>{};
    final vends = <String, _CatData>{};
    final mons = <String, _CatData>{};
    final pays = <String, _CatData>{};
    final monthFmt = DateFormat('MMM yyyy');

    for (final e in expenses) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      final cat = e['category'] as String? ?? 'Other';
      final vendor = e['vendor'] as String? ?? 'N/A';
      final date = DateTime.tryParse(e['date'] ?? '');
      final monthKey = date != null ? monthFmt.format(date) : 'Unknown';
      final pay = e['paymentMode'] as String? ?? e['payment_mode'] as String? ?? 'Cash';
      final payLabel = pay == 'bank_transfer' ? 'Bank' : pay == 'upi' ? 'UPI' : 'Cash';

      cats.update(cat, (v) => _CatData(v.amount + amt, v.count + 1), ifAbsent: () => _CatData(amt, 1));
      vends.update(vendor, (v) => _CatData(v.amount + amt, v.count + 1), ifAbsent: () => _CatData(amt, 1));
      mons.update(monthKey, (v) => _CatData(v.amount + amt, v.count + 1), ifAbsent: () => _CatData(amt, 1));
      pays.update(payLabel, (v) => _CatData(v.amount + amt, v.count + 1), ifAbsent: () => _CatData(amt, 1));
    }

    _categories = Map.fromEntries(cats.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
    _vendors = Map.fromEntries(vends.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
    _months = mons;
    _payModes = Map.fromEntries(pays.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
  }

  String _fmtAmt(double a) => '₹${NumberFormat('#,##,###', 'en_IN').format(a.round())}';

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _dateFrom : _dateTo) ?? DateTime.now(),
      firstDate: DateTime(2020), lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() { if (isFrom) { _dateFrom = picked; } else { _dateTo = picked; } });
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _expenses.fold<double>(0, (s, e) => s + ((e['amount'] as num?)?.toDouble() ?? 0));

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true, snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              title: Row(children: [
                const Icon(Icons.bar_chart, size: 18, color: Color(0xFF006699)),
                const SizedBox(width: 8),
                const Text('Analytics', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
              ]),
              actions: const [
                NotificationBell(),
              ],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(delegate: SliverChildListDelegate([
                // Date filter
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    Expanded(child: GestureDetector(
                      onTap: () => _pickDate(true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(8)),
                        child: Text(_dateFrom != null ? DateFormat('dd MMM yyyy').format(_dateFrom!) : 'From', style: TextStyle(fontSize: 13, color: _dateFrom != null ? const Color(0xFF191C1E) : const Color(0xFF9CA3AF))),
                      ),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: GestureDetector(
                      onTap: () => _pickDate(false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(8)),
                        child: Text(_dateTo != null ? DateFormat('dd MMM yyyy').format(_dateTo!) : 'To', style: TextStyle(fontSize: 13, color: _dateTo != null ? const Color(0xFF191C1E) : const Color(0xFF9CA3AF))),
                      ),
                    )),
                    const SizedBox(width: 8),
                    TextButton(onPressed: () { setState(() { _dateFrom = null; _dateTo = null; }); _loadData(); }, child: const Text('Clear', style: TextStyle(fontSize: 13, color: Color(0xFF006699)))),
                  ]),
                ),
                const SizedBox(height: 16),

                if (_loading)
                  const Center(child: Padding(padding: EdgeInsets.all(60), child: CircularProgressIndicator()))
                else ...[
                  // 2-column grid
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: _analyticsCard('Spend by Category', _categories, total, showPercent: true)),
                    const SizedBox(width: 12),
                    Expanded(child: _analyticsCard('Top Vendors', _vendors, total)),
                  ]),
                  const SizedBox(height: 12),
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: _analyticsCard('Monthly Trend', _months, total, showBar: true)),
                    const SizedBox(width: 12),
                    Expanded(child: _analyticsCard('Payment Modes', _payModes, total, showPercent: true)),
                  ]),
                ],
                const SizedBox(height: 24),
              ])),
            ),
          ],
        ),
      ),
    );
  }

  Widget _analyticsCard(String title, Map<String, _CatData> data, double total, {bool showPercent = false, bool showBar = false}) {
    final maxAmt = data.values.fold<double>(0, (m, d) => d.amount > m ? d.amount : m);
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
        ),
        Container(height: 1, color: const Color(0xFFF3F4F6)),
        if (data.isEmpty)
          const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No data', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12))))
        else
          ...data.entries.take(6).map((e) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(children: [
              Expanded(flex: 3, child: Text(e.key, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF374151)), overflow: TextOverflow.ellipsis)),
              Expanded(flex: 2, child: Text(_fmtAmt(e.value.amount), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF191C1E)), textAlign: TextAlign.right)),
              if (showPercent && total > 0)
                SizedBox(width: 36, child: Text('${(e.value.amount / total * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)), textAlign: TextAlign.right)),
              if (showBar && maxAmt > 0)
                SizedBox(width: 40, child: Padding(padding: const EdgeInsets.only(left: 6),
                  child: ClipRRect(borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(value: e.value.amount / maxAmt, minHeight: 6, backgroundColor: const Color(0xFFE0E7FF), valueColor: const AlwaysStoppedAnimation(Color(0xFF6366F1)))),
                )),
              if (!showPercent && !showBar)
                SizedBox(width: 24, child: Text('${e.value.count}', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)), textAlign: TextAlign.right)),
            ]),
          )),
        const SizedBox(height: 8),
      ]),
    );
  }
}

class _CatData {
  final double amount;
  final int count;
  _CatData(this.amount, this.count);
}
