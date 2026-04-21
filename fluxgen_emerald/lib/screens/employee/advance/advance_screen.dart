import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/employee/advance/advance_form_sheet.dart';
import 'package:emerald/widgets/notification_bell.dart';

class AdvanceScreen extends StatefulWidget {
  const AdvanceScreen({super.key});

  @override
  State<AdvanceScreen> createState() => _AdvanceScreenState();
}

class _AdvanceScreenState extends State<AdvanceScreen> {
  List<Map<String, dynamic>> _advances = [];
  bool _loading = true;
  double _allocated = 0, _settled = 0, _balance = 0;

  @override
  void initState() {
    super.initState();
    _loadAdvances();
  }

  Future<void> _loadAdvances() async {
    setState(() => _loading = true);
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      final data = await Supabase.instance.client
          .from('advances')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      double alloc = 0, settled = 0;
      for (final a in data) {
        final amt = (a['amount'] as num?)?.toDouble() ?? 0;
        alloc += amt;
        final status = a['status'] as String? ?? '';
        if (status == 'closed' || status == 'settled') settled += amt;
      }

      if (mounted) {
        setState(() {
          _advances = List<Map<String, dynamic>>.from(data);
          _allocated = alloc;
          _settled = settled;
          _balance = alloc - settled;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatINR(double amount) {
    if (amount >= 100000) return '₹${(amount / 100000).toStringAsFixed(1)}L';
    if (amount >= 1000) return '₹${(amount / 1000).toStringAsFixed(1)}k';
    return '₹${amount.toStringAsFixed(0)}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active': case 'approved': return const Color(0xFF059669);
      case 'pending_manager': case 'pending_accountant': return const Color(0xFFF59E0B);
      case 'rejected': return const Color(0xFFEF4444);
      default: return const Color(0xFF6B7280);
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'active': case 'approved': return const Color(0xFFECFDF5);
      case 'pending_manager': case 'pending_accountant': return const Color(0xFFFFFBEB);
      case 'rejected': return const Color(0xFFFEF2F2);
      default: return const Color(0xFFF3F4F6);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'approved': return 'APPROVED';
      case 'pending_manager': return 'PENDING';
      case 'pending_accountant': return 'PENDING';
      case 'rejected': return 'REJECTED';
      case 'closed': return 'CLOSED';
      default: return status.toUpperCase();
    }
  }

  Color _typeColor(String? type) {
    switch (type) {
      case 'project': return const Color(0xFF0EA5E9);
      case 'service': return const Color(0xFF0D9488);
      case 'survey': return const Color(0xFFF59E0B);
      default: return const Color(0xFF6B7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadAdvances,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              title: const Text('Advance Management',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
              actions: [
                const NotificationBell(),
              ],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Stats
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                    decoration: BoxDecoration(
                      color: Colors.white, borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
                    ),
                    child: Row(children: [
                      _stat('ALLOCATED', _formatINR(_allocated), const Color(0xFF006699)),
                      Container(width: 1, height: 36, margin: const EdgeInsets.symmetric(horizontal: 12), color: const Color(0xFFE5E7EB)),
                      _stat('SETTLED', _formatINR(_settled), const Color(0xFF059669)),
                      Container(width: 1, height: 36, margin: const EdgeInsets.symmetric(horizontal: 12), color: const Color(0xFFE5E7EB)),
                      _stat('BALANCE', _formatINR(_balance), const Color(0xFFF59E0B)),
                    ]),
                  ),
                  const SizedBox(height: 16),

                  // Create button
                  SizedBox(
                    width: double.infinity, height: 52,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFC2410C)]),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [BoxShadow(color: const Color(0xFFEA580C).withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
                      ),
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          await AdvanceFormSheet.show(context);
                          _loadAdvances();
                        },
                        icon: const Icon(Icons.add_circle_outline, size: 20),
                        label: const Text('Create Advance Request', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Header
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('RECENT REQUESTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.08, color: Color(0xFF6B7280))),
                    TextButton(onPressed: _loadAdvances, child: const Text('Refresh', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF006699)))),
                  ]),
                  const SizedBox(height: 12),

                  // List
                  if (_loading)
                    const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                  else if (_advances.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: const Column(children: [
                        Icon(Icons.account_balance_wallet_outlined, size: 48, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Text('No advances yet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                        SizedBox(height: 4),
                        Text('Tap "Create Advance Request" to get started', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                      ]),
                    )
                  else
                    ...List.generate(_advances.length, (i) {
                      final a = _advances[i];
                      final status = a['status'] as String? ?? 'pending';
                      final type = a['visit_type'] as String? ?? 'project';
                      final amount = (a['amount'] as num?)?.toDouble() ?? 0;
                      return Padding(
                        padding: EdgeInsets.only(bottom: i < _advances.length - 1 ? 10 : 0),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white, borderRadius: BorderRadius.circular(16),
                            boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
                          ),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Expanded(child: Text(a['project_name'] ?? 'Unknown', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF191C1E)))),
                              Text('₹${amount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                            ]),
                            const SizedBox(height: 10),
                            Row(children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: _typeColor(type).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                                child: Text(type.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _typeColor(type))),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(a['id']?.toString().substring(0, 8) ?? '', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)))),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(6)),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Container(width: 6, height: 6, decoration: BoxDecoration(color: _statusColor(status), shape: BoxShape.circle)),
                                  const SizedBox(width: 4),
                                  Text(_statusLabel(status), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _statusColor(status))),
                                ]),
                              ),
                            ]),
                          ]),
                        ),
                      );
                    }),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(child: Column(children: [
      Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center),
      const SizedBox(height: 6),
      Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color), textAlign: TextAlign.center),
    ]));
  }
}
