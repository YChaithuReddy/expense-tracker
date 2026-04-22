import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/theme/app_colors.dart';

// ─── Color palette constants ─────────────────────────────────────────────────
const _kPending    = Color(0xFFF59E0B);
const _kApproved   = Color(0xFF10B981);
const _kReimbursed = Color(0xFF006699);
const _kClosed     = Color(0xFF6B7280);
const _kBlue       = Color(0xFF3B82F6);

// ─── Stage descriptor ────────────────────────────────────────────────────────
class _Stage {
  final String title;
  final Color color;
  final IconData icon;
  final List<Map<String, dynamic>> items;
  const _Stage(this.title, this.color, this.icon, this.items);
}

/// Admin Approval Pipeline — premium Kanban-style board for vouchers and advances.
class PipelineScreen extends StatefulWidget {
  const PipelineScreen({super.key});

  @override
  State<PipelineScreen> createState() => _PipelineScreenState();
}

class _PipelineScreenState extends State<PipelineScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> _allVouchers = [];
  List<Map<String, dynamic>> _allAdvances = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _loadPipeline();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // ─── Data loading (unchanged logic) ──────────────────────────────────────
  Future<void> _loadPipeline() async {
    setState(() { _loading = true; _error = null; });
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
      final orgId = profile?['organization_id'] as String?;

      // Load vouchers
      var vq = Supabase.instance.client
          .from('vouchers')
          .select('*, submitter:submitted_by(id, name, email, employee_id)');
      if (orgId != null) vq = vq.eq('organization_id', orgId);
      final vouchers = await vq.order('submitted_at', ascending: false);

      // Load advances — batch-fetch profiles separately
      var aq = Supabase.instance.client.from('advances').select();
      if (orgId != null) aq = aq.eq('organization_id', orgId);
      final advancesRaw = await aq.order('submitted_at', ascending: false);
      final advances = List<Map<String, dynamic>>.from(advancesRaw);

      final userIds = advances
          .map((a) => a['user_id'])
          .whereType<String>()
          .toSet()
          .toList();
      if (userIds.isNotEmpty) {
        final profiles = await Supabase.instance.client
            .from('profiles')
            .select('id, name, email, employee_id')
            .inFilter('id', userIds);
        final profileMap = {for (var p in profiles) p['id']: p};
        for (var a in advances) {
          a['_submitter'] = profileMap[a['user_id']];
        }
      }

      if (!mounted) return;
      setState(() {
        _allVouchers = List<Map<String, dynamic>>.from(vouchers);
        _allAdvances = advances;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: _buildAppBar(),
      body: _loading
          ? _buildLoading()
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    _PillTabBar(controller: _tabController, tabs: [
                      'Vouchers  ${_allVouchers.length}',
                      'Advances  ${_allAdvances.length}',
                    ]),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildVoucherPipeline(),
                          _buildAdvancePipeline(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  // ─── AppBar ───────────────────────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white.withValues(alpha: 0.97),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shadowColor: Colors.black.withValues(alpha: 0.06),
      title: const Text(
        'Approval Pipeline',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Color(0xFF191C1E),
          letterSpacing: -0.3,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Color(0xFF9CA3AF)),
          onPressed: () {
            HapticFeedback.lightImpact();
            _loadPipeline();
          },
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: const Color(0xFFE5E7EB)),
      ),
    );
  }

  // ─── Loading / error states ───────────────────────────────────────────────
  Widget _buildLoading() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(
            color: AppColors.primary,
            strokeWidth: 2.5,
          ),
          const SizedBox(height: 16),
          Text(
            'Loading pipeline…',
            style: TextStyle(
              fontSize: 13,
              color: const Color(0xFF9CA3AF),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded,
                  color: Color(0xFFEF4444), size: 28),
            ),
            const SizedBox(height: 16),
            const Text('Failed to load pipeline',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF191C1E))),
            const SizedBox(height: 6),
            Text(
              _error ?? '',
              style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            TextButton.icon(
              onPressed: _loadPipeline,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: TextButton.styleFrom(foregroundColor: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Pipeline builders ────────────────────────────────────────────────────
  Widget _buildVoucherPipeline() {
    final submitted   = _allVouchers.where((v) => v['status'] == 'pending_manager').toList();
    final mgrApproved = _allVouchers.where((v) => v['status'] == 'manager_approved' || v['status'] == 'pending_accountant').toList();
    final accApproved = _allVouchers.where((v) => v['status'] == 'approved').toList();
    final reimbursed  = _allVouchers.where((v) => v['status'] == 'reimbursed').toList();

    return _buildKanban([
      _Stage('Submitted',           _kPending,    Icons.hourglass_top_rounded,    submitted),
      _Stage('Mgr Approved',        _kBlue,       Icons.verified_outlined,         mgrApproved),
      _Stage('Acct Approved',       _kApproved,   Icons.check_circle_outline,      accApproved),
      _Stage('Reimbursed',          _kReimbursed, Icons.payments_outlined,         reimbursed),
    ], isAdvance: false);
  }

  Widget _buildAdvancePipeline() {
    final submitted   = _allAdvances.where((a) => a['status'] == 'pending_manager').toList();
    final mgrApproved = _allAdvances.where((a) => a['status'] == 'pending_accountant' || a['status'] == 'manager_approved').toList();
    final active      = _allAdvances.where((a) => a['status'] == 'active' || a['status'] == 'approved').toList();
    final closed      = _allAdvances.where((a) => a['status'] == 'closed' || a['status'] == 'settled').toList();

    return _buildKanban([
      _Stage('Submitted',     _kPending,  Icons.hourglass_top_rounded, submitted),
      _Stage('Mgr Approved',  _kBlue,     Icons.verified_outlined,      mgrApproved),
      _Stage('Active',        _kApproved, Icons.bolt_rounded,           active),
      _Stage('Closed',        _kClosed,   Icons.check_circle_outline,   closed),
    ], isAdvance: true);
  }

  // ─── Kanban board ─────────────────────────────────────────────────────────
  Widget _buildKanban(List<_Stage> stages, {required bool isAdvance}) {
    return RefreshIndicator(
      onRefresh: _loadPipeline,
      color: AppColors.primary,
      displacement: 20,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          _FunnelSummary(stages: stages, isAdvance: isAdvance),
          SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (int i = 0; i < stages.length; i++) ...[
                  if (i > 0) const SizedBox(width: 12),
                  _KanbanColumn(
                    stage: stages[i],
                    isAdvance: isAdvance,
                    columnIndex: i,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Funnel summary ──────────────────────────────────────────────────────────
class _FunnelSummary extends StatelessWidget {
  const _FunnelSummary({required this.stages, required this.isAdvance});
  final List<_Stage> stages;
  final bool isAdvance;

  double _amountOf(Map<String, dynamic> item) {
    final a = item['total_amount'] ?? item['amount'];
    if (a is num) return a.toDouble();
    return double.tryParse(a?.toString() ?? '0') ?? 0;
  }

  String _fmtINR(double v) {
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(1)}k';
    return '₹${v.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final counts = stages.map((s) => s.items.length).toList();
    final totals = stages
        .map((s) => s.items.fold<double>(0, (sum, i) => sum + _amountOf(i)))
        .toList();
    final maxCount = counts.fold<int>(0, (m, c) => c > m ? c : m);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 10),
      padding: const EdgeInsets.all(14),
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
              child: const Icon(Icons.filter_alt_rounded,
                  size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 10),
            Text(
              isAdvance ? 'Advance funnel' : 'Voucher funnel',
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E)),
            ),
            const Spacer(),
            Text(
              '${counts.fold<int>(0, (s, c) => s + c)} items',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          SizedBox(
            height: 140,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: (maxCount + 1).toDouble(),
                minY: 0,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxCount > 0 ? maxCount / 3 : 1,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: Color(0xFFF3F4F6),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 22,
                      interval: maxCount > 0 ? (maxCount / 3).ceilToDouble() : 1,
                      getTitlesWidget: (v, _) => Text(
                        v.toInt().toString(),
                        style: const TextStyle(
                            fontSize: 9, color: Color(0xFF9CA3AF)),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (v, meta) {
                        final i = v.toInt();
                        if (i < 0 || i >= stages.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            stages[i].title.split(' ').first,
                            style: const TextStyle(
                                fontSize: 9,
                                color: Color(0xFF6B7280),
                                fontWeight: FontWeight.w600),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: [
                  for (var i = 0; i < stages.length; i++)
                    BarChartGroupData(
                      x: i,
                      barRods: [
                        BarChartRodData(
                          toY: counts[i].toDouble(),
                          width: 22,
                          borderRadius:
                              const BorderRadius.vertical(top: Radius.circular(6)),
                          gradient: LinearGradient(
                            colors: [
                              stages[i].color.withValues(alpha: 0.95),
                              stages[i].color.withValues(alpha: 0.55),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < stages.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stages[i].title,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                          color: stages[i].color,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _fmtINR(totals[i]),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF191C1E),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Pill-style tab bar ───────────────────────────────────────────────────────
class _PillTabBar extends StatelessWidget {
  const _PillTabBar({required this.controller, required this.tabs});
  final TabController controller;
  final List<String> tabs;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
        ),
        child: TabBar(
          controller: controller,
          indicator: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            gradient: const LinearGradient(
              colors: [AppColors.primary, Color(0xFF0080BF)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.30),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          indicatorPadding: const EdgeInsets.all(3),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF6B7280),
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          dividerColor: Colors.transparent,
          splashFactory: NoSplash.splashFactory,
          overlayColor: WidgetStateProperty.all(Colors.transparent),
          tabs: tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
    );
  }
}

// ─── Kanban column ────────────────────────────────────────────────────────────
class _KanbanColumn extends StatelessWidget {
  const _KanbanColumn({
    required this.stage,
    required this.isAdvance,
    required this.columnIndex,
  });

  final _Stage stage;
  final bool isAdvance;
  final int columnIndex;

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final isPending = stage.color == _kPending;

    return SizedBox(
      width: 268,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ColumnHeader(stage: stage, isPending: isPending),
          const SizedBox(height: 2),
          Container(
            constraints: BoxConstraints(maxHeight: screenHeight - 280),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(14)),
              border: Border.all(
                  color: stage.color.withValues(alpha: 0.12), width: 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: stage.items.isEmpty
                ? _EmptyColumn(stage: stage)
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                    itemCount: stage.items.length,
                    itemBuilder: (context, index) {
                      final item = stage.items[index];
                      final delay = Duration(milliseconds: 60 * index);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: (isAdvance
                                ? _AdvanceCard(item: item, stageColor: stage.color)
                                : _VoucherCard(item: item, stageColor: stage.color))
                            .animate(delay: delay)
                            .fadeIn(duration: 280.ms, curve: Curves.easeOut)
                            .slideY(
                              begin: 0.12,
                              end: 0,
                              duration: 280.ms,
                              curve: Curves.easeOut,
                            ),
                      );
                    },
                  ),
          ),
        ],
      ),
    )
        .animate(delay: Duration(milliseconds: 80 * columnIndex))
        .fadeIn(duration: 350.ms, curve: Curves.easeOut)
        .slideX(begin: 0.06, end: 0, duration: 350.ms, curve: Curves.easeOut);
  }
}

// ─── Column header ────────────────────────────────────────────────────────────
class _ColumnHeader extends StatelessWidget {
  const _ColumnHeader({required this.stage, required this.isPending});
  final _Stage stage;
  final bool isPending;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
        border: Border.all(color: stage.color.withValues(alpha: 0.18), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          // Colored accent bar
          Container(
            height: 4,
            decoration: BoxDecoration(
              color: stage.color,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                // Icon container
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: stage.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(stage.icon, size: 16, color: stage.color),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    stage.title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                      letterSpacing: -0.1,
                    ),
                  ),
                ),
                // Count badge — pulses when pending
                _CountBadge(count: stage.items.length, color: stage.color, pulse: isPending && stage.items.isNotEmpty),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Count badge with optional pulse ─────────────────────────────────────────
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count, required this.color, required this.pulse});
  final int count;
  final Color color;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    Widget badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 1),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );

    if (pulse && count > 0) {
      badge = badge
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scaleXY(begin: 1.0, end: 1.08, duration: 1000.ms, curve: Curves.easeInOut);
    }

    return badge;
  }
}

// ─── Empty column state ───────────────────────────────────────────────────────
class _EmptyColumn extends StatelessWidget {
  const _EmptyColumn({required this.stage});
  final _Stage stage;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: stage.color.withValues(alpha: 0.18),
          width: 1.5,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: stage.color.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(stage.icon, size: 22, color: stage.color.withValues(alpha: 0.50)),
          ),
          const SizedBox(height: 10),
          Text(
            'No ${stage.title.toLowerCase()} items',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF9CA3AF),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Voucher card ─────────────────────────────────────────────────────────────
class _VoucherCard extends StatefulWidget {
  const _VoucherCard({required this.item, required this.stageColor});
  final Map<String, dynamic> item;
  final Color stageColor;

  @override
  State<_VoucherCard> createState() => _VoucherCardState();
}

class _VoucherCardState extends State<_VoucherCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final v = widget.item;
    final submitter = v['submitter'] as Map<String, dynamic>?;
    final name = submitter?['name'] as String? ?? 'Unknown';
    final amount = (v['total_amount'] as num?)?.toDouble() ?? 0;
    final date = DateTime.tryParse(v['submitted_at']?.toString() ?? '');

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.025),
                blurRadius: 2,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Avatar(name: name, color: widget.stageColor),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF191C1E),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (v['voucher_number'] != null) ...[
                          const SizedBox(height: 1),
                          Text(
                            v['voucher_number'] as String,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF9CA3AF),
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Status dot glow
                  _GlowDot(color: widget.stageColor),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '₹${NumberFormat('#,##,###', 'en_IN').format(amount.round())}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  if (date != null)
                    Text(
                      _timeAgo(date),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFFB0B7C3),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Advance card ─────────────────────────────────────────────────────────────
class _AdvanceCard extends StatefulWidget {
  const _AdvanceCard({required this.item, required this.stageColor});
  final Map<String, dynamic> item;
  final Color stageColor;

  @override
  State<_AdvanceCard> createState() => _AdvanceCardState();
}

class _AdvanceCardState extends State<_AdvanceCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final a = widget.item;
    final submitter = a['_submitter'] as Map<String, dynamic>?;
    final name = submitter?['name'] as String? ?? 'Unknown';
    final amount = (a['amount'] as num?)?.toDouble() ?? 0;
    final date = DateTime.tryParse(
        a['submitted_at']?.toString() ?? a['created_at']?.toString() ?? '');
    final type = (a['visit_type'] as String? ?? 'project').toUpperCase();
    final project = a['project_name'] as String? ?? 'Unknown Project';

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.025),
                blurRadius: 2,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Avatar(name: name, color: widget.stageColor),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF191C1E),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 1),
                        Text(
                          project,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF9CA3AF),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  _GlowDot(color: widget.stageColor),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: _kBlue.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      type,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: _kBlue,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (date != null)
                    Text(
                      _timeAgo(date),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFFB0B7C3),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '₹${NumberFormat('#,##,###', 'en_IN').format(amount.round())}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Avatar widget ────────────────────────────────────────────────────────────
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.color});
  final String name;
  final Color color;

  static Color _avatarColor(String name, Color baseColor) {
    // Deterministic hue shift from name hash so each person has a unique tint
    final h = name.codeUnits.fold(0, (a, b) => a + b);
    final hue = (h * 37) % 360;
    return HSLColor.fromAHSL(1.0, hue.toDouble(), 0.55, 0.48).toColor();
  }

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    final bg = _avatarColor(name, color);
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: bg.withValues(alpha: 0.35),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initials,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}

// ─── Status dot with soft glow ────────────────────────────────────────────────
class _GlowDot extends StatelessWidget {
  const _GlowDot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 9,
      height: 9,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.55),
            blurRadius: 5,
            spreadRadius: 1,
          ),
        ],
      ),
    );
  }
}

// ─── Time-ago helper ──────────────────────────────────────────────────────────
String _timeAgo(DateTime date) {
  final now = DateTime.now();
  final diff = now.difference(date);

  if (diff.inMinutes < 1)  return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours   < 24) return '${diff.inHours}h ago';
  if (diff.inDays    < 7)  return '${diff.inDays}d ago';
  if (diff.inDays    < 30) return '${(diff.inDays / 7).floor()}w ago';
  return DateFormat('d MMM').format(date);
}
