import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/admin/admin_shell.dart';
import 'package:emerald/screens/employee/reports/reports_screen.dart';
import 'package:emerald/screens/admin/pipeline_screen.dart';
import 'package:emerald/screens/admin/tally_export_screen.dart';
import 'package:emerald/screens/admin/admin_advances_screen.dart';
import 'package:emerald/screens/admin/csv_import_screen.dart';
import 'package:emerald/screens/admin/admin_settings_screen.dart';
import 'package:emerald/screens/attendance/widgets/attendance_pill.dart';

/// Admin Overview/Dashboard screen.
///
/// Shows:
/// - Company name + role badge in the AppBar
/// - 4 status stat cards (Pending, Approved, Rejected, Reimbursed)
///   from real voucher data grouped by status
/// - Quick Actions (Review Pending, Export to Tally)
/// - Recent Activity from voucher_history table
class OverviewScreen extends StatefulWidget {
  const OverviewScreen({super.key});

  @override
  State<OverviewScreen> createState() => _OverviewScreenState();
}

class _OverviewScreenState extends State<OverviewScreen> {
  bool _loading = true;
  String _companyName = '';
  String _userRole = '';
  String _userName = '';

  // Voucher stats
  int _pendingCount = 0;
  double _pendingAmount = 0;
  int _approvedCount = 0;
  double _approvedAmount = 0;
  int _rejectedCount = 0;
  double _rejectedAmount = 0;
  int _reimbursedCount = 0;
  double _reimbursedAmount = 0;

  // Recent activity
  List<Map<String, dynamic>> _recentActivity = [];

  final _supabase = Supabase.instance.client;

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _loading = true);
    try {
      await Future.wait([
        _loadProfile(),
        _loadVoucherStats(),
        _loadRecentActivity(),
      ]);
    } catch (_) {
      // Individual loaders handle their own errors
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadProfile() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      final profile = await _supabase
          .from('profiles')
          .select('name, role, organization_id')
          .eq('id', user.id)
          .maybeSingle();

      if (profile == null || !mounted) return;

      final role = (profile['role'] as String?) ?? 'employee';
      final orgId = profile['organization_id'] as String?;
      String companyName = 'FluxGen';

      if (orgId != null && orgId.isNotEmpty) {
        try {
          final org = await _supabase
              .from('organizations')
              .select('name')
              .eq('id', orgId)
              .maybeSingle();
          if (org != null) {
            companyName = (org['name'] as String?) ?? 'FluxGen';
          }
        } catch (_) {
          // Organization table might not exist or be accessible
        }
      }

      if (mounted) {
        setState(() {
          _companyName = companyName;
          _userRole = role.toUpperCase();
          _userName = (profile['name'] as String?) ??
              user.email?.split('@').first ??
              'Admin';
        });
      }
    } catch (_) {}
  }

  Future<void> _loadVoucherStats() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      // Get the user's organization_id first
      final profile = await _supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;
      if (orgId == null || orgId.isEmpty) return;

      // Fetch all vouchers for this organization
      final vouchers = await _supabase
          .from('vouchers')
          .select('status, total_amount')
          .eq('organization_id', orgId);

      // Group client-side
      int pendingC = 0, approvedC = 0, rejectedC = 0, reimbursedC = 0;
      double pendingA = 0, approvedA = 0, rejectedA = 0, reimbursedA = 0;

      for (final v in vouchers) {
        final status = (v['status'] as String?) ?? '';
        final amount = (v['total_amount'] is num)
            ? (v['total_amount'] as num).toDouble()
            : double.tryParse(v['total_amount']?.toString() ?? '0') ?? 0.0;

        switch (status) {
          case 'pending_manager':
          case 'manager_approved':
          case 'pending_accountant':
            pendingC++;
            pendingA += amount;
          case 'approved':
            approvedC++;
            approvedA += amount;
          case 'rejected':
            rejectedC++;
            rejectedA += amount;
          case 'reimbursed':
            reimbursedC++;
            reimbursedA += amount;
        }
      }

      if (mounted) {
        setState(() {
          _pendingCount = pendingC;
          _pendingAmount = pendingA;
          _approvedCount = approvedC;
          _approvedAmount = approvedA;
          _rejectedCount = rejectedC;
          _rejectedAmount = rejectedA;
          _reimbursedCount = reimbursedC;
          _reimbursedAmount = reimbursedA;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadRecentActivity() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      final profile = await _supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;
      if (orgId == null || orgId.isEmpty) return;

      // Fetch recent voucher history
      // voucher_history may have: id, voucher_id, action, performed_by, description, created_at
      final history = await _supabase
          .from('voucher_history')
          .select()
          .eq('organization_id', orgId)
          .order('created_at', ascending: false)
          .limit(10);

      if (mounted) {
        setState(() {
          _recentActivity = List<Map<String, dynamic>>.from(history);
        });
      }
    } catch (_) {
      // voucher_history table might not exist yet -- gracefully degrade
    }
  }

  String _formatINR(double amount) {
    if (amount >= 100000) return '${(amount / 100000).toStringAsFixed(1)}L';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(1)}k';
    return amount.toStringAsFixed(0);
  }

  String _relativeTime(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoDate);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
      return '${(diff.inDays / 30).floor()}mo ago';
    } catch (_) {
      return '';
    }
  }

  IconData _actionIcon(String? action) {
    switch (action?.toLowerCase()) {
      case 'submitted':
      case 'created':
        return Icons.add_circle_outline;
      case 'approved':
      case 'manager_approved':
        return Icons.check_circle_outline;
      case 'rejected':
        return Icons.cancel_outlined;
      case 'reimbursed':
      case 'paid':
        return Icons.payments_outlined;
      default:
        return Icons.info_outline;
    }
  }

  Color _actionColor(String? action) {
    switch (action?.toLowerCase()) {
      case 'submitted':
      case 'created':
        return const Color(0xFF006699);
      case 'approved':
      case 'manager_approved':
        return const Color(0xFF059669);
      case 'rejected':
        return const Color(0xFFEF4444);
      case 'reimbursed':
      case 'paid':
        return const Color(0xFF0EA5E9);
      default:
        return const Color(0xFF6B7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: Stack(
        children: [
          RefreshIndicator(
        onRefresh: _loadAllData,
        child: CustomScrollView(
          slivers: [
            // ── AppBar ──────────────────────────────────────────
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              title: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF006699),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Center(
                      child: Text(
                        'F',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _companyName.isEmpty ? 'FluxGen' : _companyName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF191C1E),
                        letterSpacing: -0.02,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (_userRole.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: _userRole == 'ADMIN'
                            ? const Color(0xFFFEF2F2)
                            : const Color(0xFFF0F9FF),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _userRole,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: _userRole == 'ADMIN'
                              ? const Color(0xFFEF4444)
                              : const Color(0xFF0EA5E9),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Greeting ────────────────────────────────────
                  if (_userName.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        '$greeting, $_userName',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF191C1E),
                          letterSpacing: -0.02,
                        ),
                      ),
                    ),

                  // ── Stats Cards ──────────────────────────────────
                  if (_loading)
                    _buildLoadingCards()
                  else
                    _buildStatsGrid(),

                  const SizedBox(height: 20),

                  // ── Quick Access Shortcuts ─────────────────────
                  const Text(
                    'QUICK ACCESS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.08,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 10),
                  GridView.count(
                    crossAxisCount: 3,
                    childAspectRatio: 1.1,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    children: [
                      _shortcutCard(
                        icon: Icons.bar_chart,
                        label: 'Analytics',
                        color: const Color(0xFF8B5CF6),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen())),
                      ),
                      _shortcutCard(
                        icon: Icons.view_column,
                        label: 'Pipeline',
                        color: const Color(0xFF0EA5E9),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PipelineScreen())),
                      ),
                      _shortcutCard(
                        icon: Icons.file_download,
                        label: 'Tally Export',
                        color: const Color(0xFF059669),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TallyExportScreen())),
                      ),
                      _shortcutCard(
                        icon: Icons.account_balance_wallet,
                        label: 'Advances',
                        color: const Color(0xFFEA580C),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminAdvancesScreen())),
                      ),
                      _shortcutCard(
                        icon: Icons.upload_file,
                        label: 'CSV Import',
                        color: const Color(0xFFF59E0B),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CsvImportScreen())),
                      ),
                      _shortcutCard(
                        icon: Icons.settings,
                        label: 'Settings',
                        color: const Color(0xFF6366F1),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminSettingsScreen())),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // ── Quick Actions ──────────────────────────────
                  const Text(
                    'QUICK ACTIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.08,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.pending_actions,
                          label: 'Review Pending',
                          color: const Color(0xFFF59E0B),
                          onTap: () {
                            final shell = context
                                .findAncestorStateOfType<AdminShellState>();
                            shell?.switchToTab(1);
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.upload_file,
                          label: 'Export to Tally',
                          color: const Color(0xFF059669),
                          onTap: () {
                            final shell = context
                                .findAncestorStateOfType<AdminShellState>();
                            shell?.switchToTab(4);
                          },
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── Recent Activity ────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'RECENT ACTIVITY',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.08,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      TextButton(
                        onPressed: _loadAllData,
                        child: const Text(
                          'Refresh',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF006699),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (_loading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(40),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF006699),
                        ),
                      ),
                    )
                  else if (_recentActivity.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Column(
                        children: [
                          Icon(
                            Icons.history_outlined,
                            size: 48,
                            color: Color(0xFF9CA3AF),
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No recent activity',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Voucher approvals and actions will appear here',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF191C1E)
                                .withValues(alpha: 0.04),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: List.generate(
                          _recentActivity.length,
                          (i) {
                            final item = _recentActivity[i];
                            final action =
                                item['action'] as String? ?? 'update';
                            final description =
                                item['description'] as String? ??
                                    item['action'] as String? ??
                                    'Activity';
                            final createdAt =
                                item['created_at'] as String?;

                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                border: i < _recentActivity.length - 1
                                    ? const Border(
                                        bottom: BorderSide(
                                          color: Color(0xFFF3F4F6),
                                          width: 1,
                                        ),
                                      )
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: _actionColor(action)
                                          .withValues(alpha: 0.1),
                                      borderRadius:
                                          BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      _actionIcon(action),
                                      size: 18,
                                      color: _actionColor(action),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      description,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: Color(0xFF374151),
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    _relativeTime(createdAt),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF9CA3AF),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ),

                  const SizedBox(height: 32),
                ]),
              ),
            ),
          ],
        ),
      ),
          const AttendancePill(),
        ],
      ),
    );
  }

  Widget _shortcutCard({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF191C1E).withValues(alpha: 0.04),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF191C1E),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingCards() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _shimmerCard()),
            const SizedBox(width: 12),
            Expanded(child: _shimmerCard()),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _shimmerCard()),
            const SizedBox(width: 12),
            Expanded(child: _shimmerCard()),
          ],
        ),
      ],
    );
  }

  Widget _shimmerCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 60,
            height: 10,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 24,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: 70,
            height: 10,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Pending',
                count: _pendingCount,
                amount: _pendingAmount,
                color: const Color(0xFFF59E0B),
                bgColor: const Color(0xFFFFFBEB),
                icon: Icons.schedule,
                formatINR: _formatINR,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: 'Approved',
                count: _approvedCount,
                amount: _approvedAmount,
                color: const Color(0xFF059669),
                bgColor: const Color(0xFFECFDF5),
                icon: Icons.check_circle_outline,
                formatINR: _formatINR,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Rejected',
                count: _rejectedCount,
                amount: _rejectedAmount,
                color: const Color(0xFFEF4444),
                bgColor: const Color(0xFFFEF2F2),
                icon: Icons.cancel_outlined,
                formatINR: _formatINR,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: 'Reimbursed',
                count: _reimbursedCount,
                amount: _reimbursedAmount,
                color: const Color(0xFF0EA5E9),
                bgColor: const Color(0xFFF0F9FF),
                icon: Icons.payments_outlined,
                formatINR: _formatINR,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Stat Card Widget ────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final int count;
  final double amount;
  final Color color;
  final Color bgColor;
  final IconData icon;
  final String Function(double) formatINR;

  const _StatCard({
    required this.label,
    required this.count,
    required this.amount,
    required this.color,
    required this.bgColor,
    required this.icon,
    required this.formatINR,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
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
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9CA3AF),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '\u20B9${formatINR(amount)}',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Quick Action Button ─────────────────────────────────────────────────

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
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
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              size: 14,
              color: Colors.grey.shade400,
            ),
          ],
        ),
      ),
    );
  }
}
