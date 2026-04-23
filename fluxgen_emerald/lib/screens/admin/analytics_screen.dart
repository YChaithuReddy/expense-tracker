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

                  // Premium hero — loads after data resolves
                  if (!_loading && _error == null) ...[
                    _heroBlock(),
                    const SizedBox(height: 14),
                    _miniKpiStrip(),
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
                    // Department donut (center total)
                    _chartCard(
                      title: 'Spend by Department',
                      icon: Icons.business_rounded,
                      child: _departments.isEmpty
                          ? _emptyChart()
                          : SizedBox(
                              height: 230,
                              child: _departmentDonut(),
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
                              height: 200,
                              child: _monthlyLine(),
                            ),
                    ),
                    const SizedBox(height: 12),
                    // Top Spenders — podium + list
                    _chartCard(
                      title: 'Top Spenders',
                      icon: Icons.emoji_events_rounded,
                      child: _employees.isEmpty
                          ? _emptyChart()
                          : _podiumPlusList(_employees),
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

  // ── Premium hero + mini KPIs ────────────────────────────────────────

  /// Tall gradient hero card with giant total amount + period label +
  /// a subtle sparkline ribbon at the bottom built from monthly totals.
  Widget _heroBlock() {
    final totalTxns = _employees.values.fold<int>(0, (s, e) => s + e.count);
    final periodLabel = () {
      if (_dateFrom != null && _dateTo != null) {
        final fmt = DateFormat('dd MMM');
        return '${fmt.format(_dateFrom!)} → ${fmt.format(_dateTo!)}';
      }
      return 'All-time total';
    }();

    // Sparkline spots from monthly data (chronological).
    final monthEntries = _months.entries.toList();
    monthEntries.sort((a, b) {
      try {
        return DateFormat('MMM yyyy')
            .parse(a.key)
            .compareTo(DateFormat('MMM yyyy').parse(b.key));
      } catch (_) {
        return a.key.compareTo(b.key);
      }
    });
    final sparkSpots = [
      for (var i = 0; i < monthEntries.length; i++)
        FlSpot(i.toDouble(), monthEntries[i].value.amount),
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, Color(0xFF003A5F), Color(0xFF001E33)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.32),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Soft accent circle in top-right for depth.
          Positioned(
            right: -40,
            top: -40,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.10),
                    Colors.white.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.event_note_rounded,
                        size: 12, color: Colors.white),
                    const SizedBox(width: 5),
                    Text(
                      periodLabel,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                        color: Colors.white,
                      ),
                    ),
                  ]),
                ),
              ]),
              const SizedBox(height: 14),
              Text(
                'Total org spend',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _fmtAmt(_totalSpend),
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -1.0,
                  height: 1.0,
                ),
              ),
              const SizedBox(height: 10),
              Row(children: [
                _heroChip(
                    Icons.receipt_long_rounded,
                    '${NumberFormat.decimalPattern('en_IN').format(totalTxns)} txns'),
                const SizedBox(width: 8),
                _heroChip(Icons.people_rounded,
                    '${_employees.length} ppl'),
              ]),
              const SizedBox(height: 12),
              // Sparkline ribbon — only render when there is data.
              SizedBox(
                height: 42,
                child: sparkSpots.length < 2
                    ? const SizedBox.shrink()
                    : LineChart(
                        LineChartData(
                          gridData: const FlGridData(show: false),
                          borderData: FlBorderData(show: false),
                          titlesData: const FlTitlesData(show: false),
                          lineTouchData:
                              const LineTouchData(enabled: false),
                          minY: 0,
                          lineBarsData: [
                            LineChartBarData(
                              spots: sparkSpots,
                              isCurved: true,
                              curveSmoothness: 0.3,
                              color: Colors.white,
                              barWidth: 2,
                              isStrokeCapRound: true,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.white.withValues(alpha: 0.28),
                                    Colors.white.withValues(alpha: 0.0),
                                  ],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: Colors.white.withValues(alpha: 0.9)),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ]),
    );
  }

  /// Secondary KPI strip shown below the hero — two compact tiles.
  Widget _miniKpiStrip() {
    final topDept = _departments.entries.isEmpty
        ? '—'
        : (_departments.entries.toList()
              ..sort((a, b) => b.value.amount.compareTo(a.value.amount)))
            .first
            .key;
    final avgPerEmp =
        _employees.isEmpty ? 0.0 : _totalSpend / _employees.length;

    return Row(children: [
      Expanded(
        child: _miniKpiCard(
          icon: Icons.business_rounded,
          label: 'TOP DEPT',
          value: topDept,
          tint: const Color(0xFFEA580C),
          tintBg: const Color(0xFFFFF7ED),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: _miniKpiCard(
          icon: Icons.person_rounded,
          label: 'AVG / EMP',
          value: _fmtAmt(avgPerEmp),
          tint: const Color(0xFF059669),
          tintBg: const Color(0xFFECFDF5),
        ),
      ),
    ]);
  }

  Widget _miniKpiCard({
    required IconData icon,
    required String label,
    required String value,
    required Color tint,
    required Color tintBg,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: tintBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: tint),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.7,
                  color: Color(0xFF9CA3AF),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF191C1E),
                  letterSpacing: -0.3,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ]),
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

  Widget _departmentDonut() {
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
          width: 160,
          height: 160,
          child: Stack(
            alignment: Alignment.center,
            children: [
              PieChart(
                PieChartData(
                  sectionsSpace: 3,
                  centerSpaceRadius: 48,
                  startDegreeOffset: -90,
                  sections: [
                    for (var i = 0; i < top.length; i++)
                      PieChartSectionData(
                        value: top[i].value.amount,
                        color: palette[i % palette.length],
                        title: '',
                        radius: 26,
                      ),
                  ],
                ),
              ),
              // Centre label
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'TOTAL',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _fmtAmt(_totalSpend),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF191C1E),
                      letterSpacing: -0.4,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < top.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
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
                          fontSize: 12,
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
                        fontSize: 12,
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

  /// Podium for top-3 + ranked list for the rest. Used for Top Spenders.
  Widget _podiumPlusList(Map<String, _AnalyticsEntry> data) {
    final entries = data.entries.toList()
      ..sort((a, b) => b.value.amount.compareTo(a.value.amount));
    final podium = entries.take(3).toList();
    final rest = entries.skip(3).take(5).toList();
    final maxAmt = entries.isEmpty ? 0.0 : entries.first.value.amount;

    // Podium order visually: 2nd, 1st, 3rd (1st is tallest, centre).
    final order = podium.length >= 3
        ? [podium[1], podium[0], podium[2]]
        : podium.length == 2
            ? [podium[1], podium[0]]
            : podium;
    const medalColors = {
      0: Color(0xFFFFD54F), // gold
      1: Color(0xFFB0BEC5), // silver
      2: Color(0xFFD7853B), // bronze
    };
    const heights = {0: 96.0, 1: 76.0, 2: 60.0};

    int rankOf(MapEntry<String, _AnalyticsEntry> e) =>
        podium.indexOf(e); // 0/1/2 gold/silver/bronze

    return Column(
      children: [
        // Podium
        if (podium.isNotEmpty)
          SizedBox(
            height: 160,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final entry in order)
                  Expanded(
                    child: _PodiumPillar(
                      rank: rankOf(entry),
                      name: entry.key,
                      amount: _fmtAmt(entry.value.amount),
                      height: heights[rankOf(entry)] ?? 60,
                      medalColor:
                          medalColors[rankOf(entry)] ?? const Color(0xFFE5E7EB),
                    ),
                  ),
              ],
            ),
          ),
        if (rest.isNotEmpty) const SizedBox(height: 12),
        if (rest.isNotEmpty)
          Column(
            children: [
              for (var i = 0; i < rest.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    SizedBox(
                      width: 22,
                      child: Text(
                        '#${i + 4}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Expanded(
                              child: Text(
                                rest[i].key,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF374151),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              _fmtAmt(rest[i].value.amount),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF191C1E),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: maxAmt > 0
                                  ? rest[i].value.amount / maxAmt
                                  : 0,
                              minHeight: 4,
                              backgroundColor: const Color(0xFFF3F4F6),
                              valueColor: const AlwaysStoppedAnimation(
                                  AppColors.primary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ]),
                ),
            ],
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

// ════════════════════════════════════════════════════════════════════════
// Podium pillar — one column of the Top Spenders podium.
// ════════════════════════════════════════════════════════════════════════

class _PodiumPillar extends StatelessWidget {
  const _PodiumPillar({
    required this.rank,
    required this.name,
    required this.amount,
    required this.height,
    required this.medalColor,
  });
  final int rank; // 0 = gold, 1 = silver, 2 = bronze
  final String name;
  final String amount;
  final double height;
  final Color medalColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: medalColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: medalColor.withValues(alpha: 0.45),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.emoji_events_rounded,
              size: 16,
              color: Colors.white.withValues(alpha: 0.95),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF191C1E),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            amount,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Container(
            height: height,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  medalColor.withValues(alpha: 0.85),
                  medalColor.withValues(alpha: 0.45),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(10),
              ),
              boxShadow: [
                BoxShadow(
                  color: medalColor.withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            alignment: Alignment.topCenter,
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${rank + 1}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
