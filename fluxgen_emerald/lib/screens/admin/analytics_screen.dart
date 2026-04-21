import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/theme/app_colors.dart';

/// Admin Analytics screen showing org-wide expense analytics.
///
/// Features:
/// - Date range filter (From/To with Clear)
/// - 4 analytics cards in 2-column grid:
///   - Spend by Department
///   - Spend by Project
///   - Spend by Employee
///   - Monthly Trend
/// - Fetches ALL org expenses (not just current user)
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  bool _loading = true;
  String? _error;
  DateTime? _dateFrom;
  DateTime? _dateTo;

  // Computed analytics
  Map<String, _AnalyticsEntry> _departments = {};
  Map<String, _AnalyticsEntry> _projects = {};
  Map<String, _AnalyticsEntry> _employees = {};
  Map<String, _AnalyticsEntry> _months = {};
  double _totalSpend = 0;

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
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Get org id
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;

      // Strategy: fetch all profiles in the org, then fetch expenses for those users
      List<Map<String, dynamic>> orgProfiles;
      if (orgId != null && orgId.isNotEmpty) {
        final pData = await Supabase.instance.client
            .from('profiles')
            .select('id, name, email, department')
            .eq('organization_id', orgId);
        orgProfiles = List<Map<String, dynamic>>.from(pData);
      } else {
        // Fallback: just current user
        orgProfiles = [
          {'id': user.id, 'name': 'You', 'email': user.email, 'department': null}
        ];
      }

      final userIds = orgProfiles.map((p) => p['id'] as String).toList();

      // Build profile lookup
      final profileLookup = <String, Map<String, dynamic>>{};
      for (final p in orgProfiles) {
        profileLookup[p['id'] as String] = p;
      }

      // Fetch expenses for all org users
      // Supabase inFilter has a practical limit; batch if needed
      List<Map<String, dynamic>> allExpenses = [];
      const batchSize = 50;
      for (int i = 0; i < userIds.length; i += batchSize) {
        final batch = userIds.sublist(
            i, i + batchSize > userIds.length ? userIds.length : i + batchSize);
        final data = await Supabase.instance.client
            .from('expenses')
            .select('user_id, amount, date, category, project_id')
            .inFilter('user_id', batch)
            .order('date', ascending: false);
        allExpenses.addAll(List<Map<String, dynamic>>.from(data));
      }

      // Apply date filters client-side
      if (_dateFrom != null) {
        allExpenses = allExpenses.where((e) {
          final d = DateTime.tryParse(e['date']?.toString() ?? '');
          return d != null && !d.isBefore(_dateFrom!);
        }).toList();
      }
      if (_dateTo != null) {
        allExpenses = allExpenses.where((e) {
          final d = DateTime.tryParse(e['date']?.toString() ?? '');
          return d != null && !d.isAfter(_dateTo!);
        }).toList();
      }

      // Also fetch projects for name lookup
      Map<String, String> projectLookup = {};
      try {
        final projData = await Supabase.instance.client
            .from('projects')
            .select('id, project_name, project_code');
        for (final p in (projData as List<dynamic>)) {
          final pid = p['id'] as String;
          final name = p['project_name'] as String? ??
              p['project_code'] as String? ??
              pid;
          projectLookup[pid] = name;
        }
      } catch (_) {
        // projects table may not exist
      }

      // Compute analytics
      _computeAnalytics(allExpenses, profileLookup, projectLookup);

      if (!mounted) return;
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _computeAnalytics(
    List<Map<String, dynamic>> expenses,
    Map<String, Map<String, dynamic>> profiles,
    Map<String, String> projects,
  ) {
    final depts = <String, _AnalyticsEntry>{};
    final projs = <String, _AnalyticsEntry>{};
    final emps = <String, _AnalyticsEntry>{};
    final mons = <String, _AnalyticsEntry>{};
    final monthFmt = DateFormat('MMM yyyy');
    double total = 0;

    for (final e in expenses) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      total += amt;

      final userId = e['user_id'] as String? ?? '';
      final prof = profiles[userId];
      final dept = prof?['department'] as String? ?? 'Unassigned';
      final empName = prof?['name'] as String? ??
          (prof?['email'] as String?)?.split('@').first ??
          'Unknown';

      final projectId = e['project_id'] as String?;
      final projectName =
          projectId != null ? (projects[projectId] ?? projectId) : 'No Project';

      final date = DateTime.tryParse(e['date']?.toString() ?? '');
      final monthKey = date != null ? monthFmt.format(date) : 'Unknown';

      depts.update(dept, (v) => _AnalyticsEntry(v.amount + amt, v.count + 1),
          ifAbsent: () => _AnalyticsEntry(amt, 1));
      projs.update(
          projectName, (v) => _AnalyticsEntry(v.amount + amt, v.count + 1),
          ifAbsent: () => _AnalyticsEntry(amt, 1));
      emps.update(empName, (v) => _AnalyticsEntry(v.amount + amt, v.count + 1),
          ifAbsent: () => _AnalyticsEntry(amt, 1));
      mons.update(monthKey, (v) => _AnalyticsEntry(v.amount + amt, v.count + 1),
          ifAbsent: () => _AnalyticsEntry(amt, 1));
    }

    // Sort by amount descending (except months keep original order)
    _departments = Map.fromEntries(
        depts.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
    _projects = Map.fromEntries(
        projs.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
    _employees = Map.fromEntries(
        emps.entries.toList()..sort((a, b) => b.value.amount.compareTo(a.value.amount)));
    _months = mons;
    _totalSpend = total;
  }

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _dateFrom : _dateTo) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(
                primary: AppColors.primary,
              ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _dateFrom = picked;
        } else {
          _dateTo = picked;
        }
      });
      _loadData();
    }
  }

  String _fmtAmt(double a) =>
      '\u20B9${NumberFormat('#,##,###', 'en_IN').format(a.round())}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // AppBar
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              title: Row(
                children: [
                  const Icon(Icons.bar_chart, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Text(
                    'Analytics',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ],
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Date filter
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => _pickDate(true),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F4F6),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today,
                                      size: 14, color: Color(0xFF9CA3AF)),
                                  const SizedBox(width: 6),
                                  Text(
                                    _dateFrom != null
                                        ? DateFormat('dd MMM yyyy')
                                            .format(_dateFrom!)
                                        : 'From',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: _dateFrom != null
                                          ? const Color(0xFF191C1E)
                                          : const Color(0xFF9CA3AF),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => _pickDate(false),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3F4F6),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today,
                                      size: 14, color: Color(0xFF9CA3AF)),
                                  const SizedBox(width: 6),
                                  Text(
                                    _dateTo != null
                                        ? DateFormat('dd MMM yyyy')
                                            .format(_dateTo!)
                                        : 'To',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: _dateTo != null
                                          ? const Color(0xFF191C1E)
                                          : const Color(0xFF9CA3AF),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _dateFrom = null;
                              _dateTo = null;
                            });
                            _loadData();
                          },
                          child: const Text('Clear',
                              style: TextStyle(
                                  fontSize: 13, color: AppColors.primary)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Total spend summary
                  if (!_loading && _error == null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary.withValues(alpha: 0.08),
                            AppColors.primary.withValues(alpha: 0.03),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total Org Spend',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF6B7280))),
                          Text(
                            _fmtAmt(_totalSpend),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),

                  if (_loading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(60),
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary),
                      ),
                    )
                  else if (_error != null)
                    _buildError()
                  else ...[
                    // 2-column grid
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _analyticsCard(
                            'Spend by Department',
                            Icons.business,
                            _departments,
                            showPercent: true,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _analyticsCard(
                            'Spend by Project',
                            Icons.folder_outlined,
                            _projects,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _analyticsCard(
                            'Spend by Employee',
                            Icons.people_outline,
                            _employees,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _analyticsCard(
                            'Monthly Trend',
                            Icons.trending_up,
                            _months,
                            showBar: true,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _analyticsCard(
    String title,
    IconData icon,
    Map<String, _AnalyticsEntry> data, {
    bool showPercent = false,
    bool showBar = false,
  }) {
    final maxAmt =
        data.values.fold<double>(0, (m, d) => d.amount > m ? d.amount : m);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                Icon(icon, size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(height: 1, color: const Color(0xFFF3F4F6)),

          if (data.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('No data',
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
              ),
            )
          else
            ...data.entries.take(8).map((e) => Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              e.key,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF374151),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              _fmtAmt(e.value.amount),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF191C1E),
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                          if (showPercent && _totalSpend > 0)
                            SizedBox(
                              width: 36,
                              child: Text(
                                '${(e.value.amount / _totalSpend * 100).toStringAsFixed(0)}%',
                                style: const TextStyle(
                                    fontSize: 10, color: Color(0xFF9CA3AF)),
                                textAlign: TextAlign.right,
                              ),
                            ),
                          if (!showPercent && !showBar)
                            SizedBox(
                              width: 24,
                              child: Text(
                                '${e.value.count}',
                                style: const TextStyle(
                                    fontSize: 10, color: Color(0xFF9CA3AF)),
                                textAlign: TextAlign.right,
                              ),
                            ),
                        ],
                      ),
                      if (showBar && maxAmt > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: e.value.amount / maxAmt,
                              minHeight: 5,
                              backgroundColor: const Color(0xFFE0E7FF),
                              valueColor: const AlwaysStoppedAnimation(
                                  AppColors.primary),
                            ),
                          ),
                        ),
                    ],
                  ),
                )),
          const SizedBox(height: 8),
        ],
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
          const Text('Failed to load analytics',
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
            onPressed: _loadData,
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
}

// ════════════════════════════════════════════════════════════════════════
// Analytics Entry
// ════════════════════════════════════════════════════════════════════════

class _AnalyticsEntry {
  final double amount;
  final int count;
  const _AnalyticsEntry(this.amount, this.count);
}
