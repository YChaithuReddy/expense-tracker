import 'package:fl_chart/fl_chart.dart';
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

                  // Hero KPI strip — loads after data resolves
                  if (!_loading && _error == null) ...[
                    _heroKpiStrip(),
                    const SizedBox(height: 16),
                  ],

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
                    // Department pie
                    _chartCard(
                      title: 'Spend by Department',
                      icon: Icons.business_rounded,
                      child: _departments.isEmpty
                          ? _emptyChart()
                          : SizedBox(
                              height: 220,
                              child: _departmentPie(),
                            ),
                    ),
                    const SizedBox(height: 12),
                    // Monthly trend line
                    _chartCard(
                      title: 'Monthly Trend',
                      icon: Icons.trending_up_rounded,
                      child: _months.isEmpty
                          ? _emptyChart()
                          : SizedBox(
                              height: 180,
                              child: _monthlyLine(),
                            ),
                    ),
                    const SizedBox(height: 12),
                    // Top projects
                    _chartCard(
                      title: 'Top Projects',
                      icon: Icons.folder_rounded,
                      child: _projects.isEmpty
                          ? _emptyChart()
                          : _topList(_projects, palette: const [
                              Color(0xFF0EA5E9),
                              Color(0xFF22D3EE),
                              Color(0xFF06B6D4),
                              Color(0xFF0891B2),
                              Color(0xFF155E75),
                            ]),
                    ),
                    const SizedBox(height: 12),
                    // Top employees
                    _chartCard(
                      title: 'Top Employees',
                      icon: Icons.emoji_events_rounded,
                      child: _employees.isEmpty
                          ? _emptyChart()
                          : _topList(_employees, palette: const [
                              Color(0xFFEA580C),
                              Color(0xFFF59E0B),
                              Color(0xFFFBBF24),
                              Color(0xFFFDE68A),
                              Color(0xFFFEF3C7),
                            ]),
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

  // ── New premium layout helpers ──────────────────────────────────────

  /// 4-tile hero KPI strip that sits above the chart cards.
  Widget _heroKpiStrip() {
    final totalTxns =
        _employees.values.fold<int>(0, (s, e) => s + e.count);
    final topDept = _departments.entries.isEmpty
        ? '—'
        : (_departments.entries.toList()
              ..sort((a, b) => b.value.amount.compareTo(a.value.amount)))
            .first
            .key;
    final avgPerEmp = _employees.isEmpty
        ? 0.0
        : _totalSpend / _employees.length;

    return Row(
      children: [
        Expanded(
          child: _kpiCard(
            label: 'TOTAL SPEND',
            value: _fmtAmt(_totalSpend),
            icon: Icons.account_balance_wallet_rounded,
            gradient: const [AppColors.primary, Color(0xFF00456B)],
            textLight: true,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _kpiCard(
            label: 'TRANSACTIONS',
            value: NumberFormat.decimalPattern('en_IN').format(totalTxns),
            icon: Icons.receipt_long_rounded,
            gradient: const [Color(0xFFF8FAFC), Color(0xFFEFF6FF)],
            textLight: false,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _kpiCard(
            label: 'TOP DEPT',
            value: topDept,
            icon: Icons.business_rounded,
            gradient: const [Color(0xFFF8FAFC), Color(0xFFFFF7ED)],
            textLight: false,
            valueFontSize: 12,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _kpiCard(
            label: 'AVG / EMP',
            value: _fmtAmt(avgPerEmp),
            icon: Icons.person_rounded,
            gradient: const [Color(0xFFF8FAFC), Color(0xFFECFDF5)],
            textLight: false,
          ),
        ),
      ],
    );
  }

  Widget _kpiCard({
    required String label,
    required String value,
    required IconData icon,
    required List<Color> gradient,
    required bool textLight,
    double valueFontSize = 15,
  }) {
    final labelColor =
        textLight ? Colors.white.withValues(alpha: 0.72) : const Color(0xFF6B7280);
    final valueColor = textLight ? Colors.white : const Color(0xFF191C1E);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: textLight ? 0.14 : 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon,
              size: 16,
              color:
                  textLight ? Colors.white.withValues(alpha: 0.9) : AppColors.primary),
          const SizedBox(height: 8),
          Text(label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: labelColor,
              )),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                fontSize: valueFontSize,
                fontWeight: FontWeight.w700,
                color: valueColor,
                letterSpacing: -0.3,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _chartCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 10),
            Text(title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E),
                )),
          ]),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _emptyChart() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 30),
        child: Center(
          child: Text('No data',
              style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
        ),
      );

  Widget _departmentPie() {
    final entries = _departments.entries.toList()
      ..sort((a, b) => b.value.amount.compareTo(a.value.amount));
    final top = entries.take(5).toList();
    final palette = const [
      Color(0xFF006699),
      Color(0xFF0EA5E9),
      Color(0xFF22C55E),
      Color(0xFFF59E0B),
      Color(0xFF8B5CF6),
    ];
    return Row(
      children: [
        SizedBox(
          width: 150,
          height: 150,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 34,
              sections: [
                for (var i = 0; i < top.length; i++)
                  PieChartSectionData(
                    value: top[i].value.amount,
                    color: palette[i % palette.length],
                    title: '',
                    radius: 36,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < top.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: palette[i % palette.length],
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        top[i].key,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      _totalSpend > 0
                          ? '${(top[i].value.amount / _totalSpend * 100).toStringAsFixed(0)}%'
                          : '—',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF191C1E),
                      ),
                    ),
                  ]),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _monthlyLine() {
    // Sort months chronologically (keys are like "Jan 2026" / "Feb 2026").
    final entries = _months.entries.toList();
    entries.sort((a, b) {
      try {
        return DateFormat('MMM yyyy')
            .parse(a.key)
            .compareTo(DateFormat('MMM yyyy').parse(b.key));
      } catch (_) {
        return a.key.compareTo(b.key);
      }
    });

    final spots = [
      for (var i = 0; i < entries.length; i++)
        FlSpot(i.toDouble(), entries[i].value.amount),
    ];
    final maxY = entries.fold<double>(
        0, (m, e) => e.value.amount > m ? e.value.amount : m);

    return LineChart(
      LineChartData(
        minY: 0,
        maxY: maxY * 1.15,
        gridData: FlGridData(
          drawVerticalLine: false,
          horizontalInterval: maxY > 0 ? maxY / 3 : 1,
          getDrawingHorizontalLine: (_) => const FlLine(
              color: Color(0xFFF3F4F6), strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 44,
              interval: maxY > 0 ? maxY / 3 : 1,
              getTitlesWidget: (v, _) => Text(
                _fmtAmt(v),
                style: const TextStyle(
                    fontSize: 9, color: Color(0xFF9CA3AF)),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              interval: 1,
              getTitlesWidget: (v, meta) {
                final i = v.toInt();
                if (i < 0 || i >= entries.length) {
                  return const SizedBox.shrink();
                }
                // Show first, last, and every other label to avoid overlap.
                final show = i == 0 ||
                    i == entries.length - 1 ||
                    entries.length <= 6 ||
                    i % 2 == 0;
                if (!show) return const SizedBox.shrink();
                final label = entries[i].key.split(' ').first; // "Jan"
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(label,
                      style: const TextStyle(
                          fontSize: 9, color: Color(0xFF9CA3AF))),
                );
              },
            ),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.25,
            color: AppColors.primary,
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                radius: 3,
                color: Colors.white,
                strokeWidth: 2,
                strokeColor: AppColors.primary,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.24),
                  AppColors.primary.withValues(alpha: 0.02),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _topList(
    Map<String, _AnalyticsEntry> data, {
    required List<Color> palette,
  }) {
    final entries = data.entries.toList()
      ..sort((a, b) => b.value.amount.compareTo(a.value.amount));
    final top = entries.take(5).toList();
    final maxAmt = top.isEmpty ? 0.0 : top.first.value.amount;

    return Column(
      children: [
        for (var i = 0; i < top.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Container(
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: palette[i % palette.length]
                          .withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Text('${i + 1}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: palette[i % palette.length],
                        )),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      top[i].key,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF374151),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    _fmtAmt(top[i].value.amount),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ]),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: maxAmt > 0 ? top[i].value.amount / maxAmt : 0,
                    minHeight: 6,
                    backgroundColor:
                        palette[i % palette.length].withValues(alpha: 0.12),
                    valueColor: AlwaysStoppedAnimation(
                        palette[i % palette.length]),
                  ),
                ),
              ],
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
