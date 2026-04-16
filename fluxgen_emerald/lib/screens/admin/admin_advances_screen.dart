import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

/// Admin Advances Dashboard — shows ALL advances in the organization
/// with stats, filters, and approve/reject actions.
class AdminAdvancesScreen extends StatefulWidget {
  const AdminAdvancesScreen({super.key});

  @override
  State<AdminAdvancesScreen> createState() => _AdminAdvancesScreenState();
}

class _AdminAdvancesScreenState extends State<AdminAdvancesScreen> {
  List<Map<String, dynamic>> _advances = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _loadAdvances();
  }

  Future<void> _loadAdvances() async {
    setState(() => _loading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser!;
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
      final orgId = profile?['organization_id'];
      if (orgId == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      // Fetch ALL advances in org
      final advances = await Supabase.instance.client
          .from('advances')
          .select()
          .eq('organization_id', orgId)
          .order('created_at', ascending: false);

      final list = List<Map<String, dynamic>>.from(advances);

      // Batch-fetch submitter profiles (NO FK to profiles)
      final userIds = list.map((a) => a['user_id']).whereType<String>().toSet().toList();
      if (userIds.isNotEmpty) {
        final profiles = await Supabase.instance.client
            .from('profiles')
            .select('id, name, email, employee_id')
            .inFilter('id', userIds);
        final profileMap = {for (var p in profiles) p['id']: p};
        for (var a in list) {
          a['_submitter'] = profileMap[a['user_id']];
        }
      }

      if (mounted) {
        setState(() {
          _advances = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'all') return _advances;
    if (_filter == 'pending') {
      return _advances.where((a) => a['status'] == 'pending_manager' || a['status'] == 'pending_accountant').toList();
    }
    return _advances.where((a) => a['status'] == _filter).toList();
  }

  Map<String, double> get _stats {
    double pending = 0, active = 0, closed = 0;
    for (var a in _advances) {
      final amt = (a['amount'] as num?)?.toDouble() ?? 0;
      final status = a['status'] as String?;
      if (status == 'pending_manager' || status == 'pending_accountant') { pending += amt; }
      else if (status == 'active' || status == 'approved') { active += amt; }
      else if (status == 'closed' || status == 'settled') { closed += amt; }
    }
    return {'pending': pending, 'active': active, 'closed': closed};
  }

  Future<void> _approve(String id) async {
    try {
      final user = Supabase.instance.client.auth.currentUser!;
      final advance = _advances.firstWhere((a) => a['id'] == id);
      final currentStatus = advance['status'] as String?;
      String newStatus = currentStatus == 'pending_manager' ? 'pending_accountant' : 'active';

      await Supabase.instance.client.from('advances').update({'status': newStatus}).eq('id', id);
      await Supabase.instance.client.from('advance_history').insert({
        'advance_id': id, 'action': 'approved', 'acted_by': user.id,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Advance approved'), backgroundColor: Color(0xFF059669)),
        );
      }
      _loadAdvances();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _reject(String id) async {
    final reasonCtrl = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reject Advance'),
        content: TextField(controller: reasonCtrl, decoration: const InputDecoration(hintText: 'Reason for rejection')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final user = Supabase.instance.client.auth.currentUser!;
      await Supabase.instance.client.from('advances').update({'status': 'rejected'}).eq('id', id);
      await Supabase.instance.client.from('advance_history').insert({
        'advance_id': id, 'action': 'rejected', 'acted_by': user.id, 'comment': reasonCtrl.text,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Advance rejected'), backgroundColor: Color(0xFFEF4444)),
        );
      }
      _loadAdvances();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'active': case 'approved': return const Color(0xFF059669);
      case 'pending_manager': case 'pending_accountant': return const Color(0xFFF59E0B);
      case 'rejected': return const Color(0xFFEF4444);
      default: return const Color(0xFF6B7280);
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'active': return 'ACTIVE';
      case 'approved': return 'APPROVED';
      case 'pending_manager': return 'PENDING (MGR)';
      case 'pending_accountant': return 'PENDING (ACC)';
      case 'rejected': return 'REJECTED';
      case 'closed': return 'CLOSED';
      default: return (s ?? 'UNKNOWN').toUpperCase();
    }
  }

  String _fmt(double amt) => '₹${NumberFormat('#,##,###', 'en_IN').format(amt.round())}';

  @override
  Widget build(BuildContext context) {
    final stats = _stats;
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Advances', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF191C1E), fontSize: 18)),
        iconTheme: const IconThemeData(color: Color(0xFF444653)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadAdvances,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Stats
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                _stat('PENDING', _fmt(stats['pending']!), const Color(0xFFF59E0B)),
                Container(width: 1, height: 36, margin: const EdgeInsets.symmetric(horizontal: 12), color: const Color(0xFFE5E7EB)),
                _stat('ACTIVE', _fmt(stats['active']!), const Color(0xFF059669)),
                Container(width: 1, height: 36, margin: const EdgeInsets.symmetric(horizontal: 12), color: const Color(0xFFE5E7EB)),
                _stat('CLOSED', _fmt(stats['closed']!), const Color(0xFF6B7280)),
              ]),
            ),
            const SizedBox(height: 16),

            // Filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _chip('all', 'All'),
                _chip('pending', 'Pending'),
                _chip('active', 'Active'),
                _chip('rejected', 'Rejected'),
                _chip('closed', 'Closed'),
              ]),
            ),
            const SizedBox(height: 16),

            // List
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
            else if (_filtered.isEmpty)
              Container(
                padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: const Column(children: [
                  Icon(Icons.account_balance_wallet_outlined, size: 48, color: Color(0xFF9CA3AF)),
                  SizedBox(height: 12),
                  Text('No advances', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                ]),
              )
            else
              ..._filtered.map((a) {
                final status = a['status'] as String?;
                final submitter = a['_submitter'] as Map<String, dynamic>?;
                final isPending = status == 'pending_manager' || status == 'pending_accountant';
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(a['project_name'] ?? 'Unknown Project', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF191C1E)))),
                      Text(_fmt(((a['amount'] as num?) ?? 0).toDouble()), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                    ]),
                    const SizedBox(height: 6),
                    Text('${submitter?['name'] ?? 'Unknown'} • ${submitter?['employee_id'] ?? ''}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                    const SizedBox(height: 8),
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: _statusColor(status).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                        child: Text(_statusLabel(status), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(status))),
                      ),
                      const Spacer(),
                      if (isPending) ...[
                        TextButton(onPressed: () => _reject(a['id']), child: const Text('Reject', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w600))),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () => _approve(a['id']),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669), foregroundColor: Colors.white, minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 14)),
                          child: const Text('Approve', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ]),
                  ]),
                );
              }),
          ]),
        ),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(child: Column(children: [
      Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
      const SizedBox(height: 6),
      Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
    ]));
  }

  Widget _chip(String value, String label) {
    final selected = _filter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: selected,
        label: Text(label),
        onSelected: (_) => setState(() => _filter = value),
        backgroundColor: Colors.white,
        selectedColor: const Color(0xFF006699),
        labelStyle: TextStyle(color: selected ? Colors.white : const Color(0xFF6B7280), fontSize: 12, fontWeight: FontWeight.w600),
        shape: const StadiumBorder(side: BorderSide(color: Color(0xFFE5E7EB))),
      ),
    );
  }
}
