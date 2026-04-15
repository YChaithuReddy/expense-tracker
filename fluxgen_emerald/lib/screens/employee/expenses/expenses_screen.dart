import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/shared/notification_screen.dart';
import 'package:emerald/screens/shared/activity_log_screen.dart';
import 'package:emerald/screens/employee/expenses/add_expense_screen.dart';
import 'package:emerald/screens/employee/expenses/scan_receipt_screen.dart';
import 'package:emerald/screens/employee/expenses/expense_detail_screen.dart';
import 'package:emerald/screens/employee/expenses/saved_images_screen.dart';
import 'package:emerald/screens/employee/voucher/submit_voucher_screen.dart';
import 'package:emerald/screens/employee/export/export_screen.dart';
import 'package:emerald/screens/employee/whatsapp/whatsapp_screen.dart';
import 'package:emerald/screens/employee/settings/bank_details_screen.dart';
import 'package:emerald/screens/employee/pdfs/pdf_library_screen.dart';
import 'package:emerald/screens/admin/admin_shell.dart';
import 'package:emerald/screens/attendance/widgets/attendance_pill.dart';
import 'package:emerald/widgets/notification_bell.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<Map<String, dynamic>> _recentExpenses = [];
  String _userName = '';
  String _userEmail = '';
  String _userRole = '';
  String? _organizationId;
  bool _loading = true;

  // Quick Stats
  double _thisMonthTotal = 0;
  int _pendingVouchers = 0;
  int _activeAdvances = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      // Load profile
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('name, email, role, organization_id')
          .eq('id', user.id)
          .maybeSingle();

      // Load recent expenses (last 5)
      final expenses = await Supabase.instance.client
          .from('expenses')
          .select()
          .eq('user_id', user.id)
          .order('created_at', ascending: false)
          .limit(5);

      // Load Quick Stats in parallel
      double monthTotal = 0;
      int pendingVouchers = 0;
      int activeAdvances = 0;

      try {
        final now = DateTime.now();
        final monthStart = DateTime(now.year, now.month, 1).toIso8601String().substring(0, 10);

        final results = await Future.wait([
          // This Month Total
          Supabase.instance.client
              .from('expenses')
              .select('amount')
              .eq('user_id', user.id)
              .gte('date', monthStart),
          // Pending Vouchers (not in terminal statuses)
          Supabase.instance.client
              .from('vouchers')
              .select('id')
              .eq('submitted_by', user.id)
              .not('status', 'in', '("approved","reimbursed","rejected")'),
          // Active Advances
          Supabase.instance.client
              .from('advances')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'active'),
        ]);

        // Sum this month expenses
        for (final row in (results[0] as List)) {
          monthTotal += ((row as Map)['amount'] as num?)?.toDouble() ?? 0;
        }
        pendingVouchers = (results[1] as List).length;
        activeAdvances = (results[2] as List).length;
      } catch (_) {
        // Non-critical -- stats can fail silently
      }

      if (mounted) {
        setState(() {
          _userName = profile?['name'] ?? user.email?.split('@').first ?? 'User';
          _userEmail = profile?['email'] ?? user.email ?? '';
          _userRole = (profile?['role'] ?? 'employee').toString().toUpperCase();
          _organizationId = profile?['organization_id'] as String?;
          _recentExpenses = List<Map<String, dynamic>>.from(expenses);
          _thisMonthTotal = monthTotal;
          _pendingVouchers = pendingVouchers;
          _activeAdvances = activeAdvances;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: Stack(
        children: [
          RefreshIndicator(
        onRefresh: _loadData,
        child: CustomScrollView(
          slivers: [
            // Glassmorphism header
            SliverAppBar(
              floating: true, snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.8),
              surfaceTintColor: Colors.transparent,
              title: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset('assets/images/fluxgen_logo.jpg', height: 32),
                ),
                const SizedBox(width: 10),
                const Text('FluxGen', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E), letterSpacing: -0.02)),
              ]),
              actions: [
                const NotificationBell(),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Color(0xFF9CA3AF)),
                  onSelected: (value) {},
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'export', child: Text('Export Data')),
                    const PopupMenuItem(value: 'help', child: Text('Help & Support')),
                  ],
                ),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(delegate: SliverChildListDelegate([
                // Greeting card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white, borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
                  ),
                  child: Column(children: [
                    Text('$greeting, $_userName', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF191C1E), letterSpacing: -0.02)),
                    const SizedBox(height: 4),
                    const Text('Scan a bill or enter details manually', style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
                    const SizedBox(height: 2),
                    Text(_userEmail, style: const TextStyle(fontSize: 11, color: Color(0xFFBBBBBB))),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(6)),
                      child: Text(_userRole, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5, color: Color(0xFFEF4444))),
                    ),
                    const SizedBox(height: 16),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      _QuickAction(icon: Icons.settings_outlined, onTap: () {
                        // Switch to Settings tab (index 4)
                        final shell = context.findAncestorStateOfType<State>();
                        if (shell != null && shell.mounted) {
                          // Navigate via bottom nav - just show snackbar for now
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tap Profile tab for settings'), duration: Duration(seconds: 1)));
                        }
                      }),
                      const SizedBox(width: 10),
                      _QuickAction(icon: Icons.notifications_outlined, badge: '${_recentExpenses.length}',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationScreen()))),
                      const SizedBox(width: 10),
                      _QuickAction(icon: Icons.check_circle_outline, onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const _MyVoucherStatusScreen()),
                        );
                      }),
                      const SizedBox(width: 10),
                      _QuickAction(icon: Icons.dashboard_outlined, onTap: () {
                        final role = _userRole.toLowerCase();
                        if (role == 'admin' || role == 'manager' || role == 'accountant') {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const AdminShell()),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Admin access required'),
                              duration: Duration(seconds: 1),
                            ),
                          );
                        }
                      }),
                    ]),
                  ]),
                ),
                const SizedBox(height: 16),

                // Quick Stats
                const Text(
                  'QUICK STATS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.08,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 100,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      _QuickStatCard(
                        icon: Icons.calendar_month,
                        iconColor: const Color(0xFF006699),
                        label: 'THIS MONTH',
                        value: _loading ? '...' : _formatINR(_thisMonthTotal),
                      ),
                      const SizedBox(width: 10),
                      _QuickStatCard(
                        icon: Icons.receipt_long,
                        iconColor: const Color(0xFFF59E0B),
                        label: 'PENDING VOUCHERS',
                        value: _loading ? '...' : '$_pendingVouchers',
                      ),
                      const SizedBox(width: 10),
                      _QuickStatCard(
                        icon: Icons.account_balance_wallet,
                        iconColor: const Color(0xFF059669),
                        label: 'ACTIVE ADVANCES',
                        value: _loading ? '...' : '$_activeAdvances',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Scan Receipt
                _ActionCard(
                  icon: Icons.document_scanner_outlined,
                  iconColor: const Color(0xFF006699),
                  title: 'Scan Receipt',
                  subtitle: 'Take a photo or upload a bill image to auto-extract details',
                  child: Row(children: [
                    Expanded(child: ElevatedButton.icon(
                      onPressed: () async {
                        final picker = ImagePicker();
                        final photo = await picker.pickImage(source: ImageSource.camera);
                        if (photo != null && context.mounted) {
                          await Navigator.push(context, MaterialPageRoute(
                            builder: (_) => ScanReceiptScreen(capturedImagePath: photo.path),
                          ));
                          _loadData();
                        }
                      },
                      icon: const Icon(Icons.camera_alt, size: 18),
                      label: const Text('Camera'),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006699), foregroundColor: Colors.white, elevation: 0, padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: OutlinedButton.icon(
                      onPressed: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => const ScanReceiptScreen(initialSource: ImageSource.gallery)));
                        _loadData();
                      },
                      icon: const Icon(Icons.photo_library_outlined, size: 18),
                      label: const Text('Gallery'),
                      style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF444653), side: const BorderSide(color: Color(0xFFE5E7EB)), padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                    )),
                  ]),
                ),
                const SizedBox(height: 12),

                // Enter Manually
                _ActionCard(
                  icon: Icons.edit_note, iconColor: const Color(0xFF059669),
                  title: 'Enter Manually',
                  subtitle: 'Add expense details without a receipt — perfect for cash payments',
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
                  onTap: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddExpenseScreen()));
                    _loadData();
                  },
                ),

                const SizedBox(height: 20),

                // Quick Access shortcuts
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
                SizedBox(
                  height: 100,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      _shortcutCard(
                        icon: Icons.account_balance,
                        label: 'Bank\nDetails',
                        color: const Color(0xFF006699),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BankDetailsScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.history,
                        label: 'Activity\nLog',
                        color: const Color(0xFF6366F1),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ActivityLogScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.photo_library,
                        label: 'Saved\nImages',
                        color: const Color(0xFF0EA5E9),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SavedImagesScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.chat,
                        label: 'WhatsApp\nShare',
                        color: const Color(0xFF25D366),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WhatsAppScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.picture_as_pdf,
                        label: 'PDF\nLibrary',
                        color: const Color(0xFFEF4444),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PdfLibraryScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.download,
                        label: 'Export &\nShare',
                        color: const Color(0xFF8B5CF6),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExportScreen())),
                      ),
                      const SizedBox(width: 8),
                      _shortcutCard(
                        icon: Icons.notifications,
                        label: 'Notifications',
                        color: const Color(0xFFF59E0B),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationScreen())),
                      ),
                    ],
                  ),
                ),

                // Submit for Approval — only in company mode
                if (_organizationId != null) ...[
                  const SizedBox(height: 12),
                  _ActionCard(
                    icon: Icons.send, iconColor: const Color(0xFF8B5CF6),
                    title: 'Submit for Approval',
                    subtitle: 'Bundle expenses into a voucher for manager review',
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
                    onTap: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SubmitVoucherScreen()),
                      );
                      if (result == true) _loadData();
                    },
                  ),
                ],
                const SizedBox(height: 12),

                // Export & Reports
                _ActionCard(
                  icon: Icons.download, iconColor: const Color(0xFF0EA5E9),
                  title: 'Export & Reports',
                  subtitle: 'Excel, PDF, email your expense data',
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ExportScreen()));
                  },
                ),
                const SizedBox(height: 24),

                // Recent Entries Header
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('RECENT ENTRIES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.08, color: Color(0xFF6B7280))),
                  TextButton(onPressed: _loadData, child: const Text('Refresh', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF006699)))),
                ]),
                const SizedBox(height: 8),

                // Real recent entries
                if (_loading)
                  const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
                else if (_recentExpenses.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: const Column(children: [
                      Icon(Icons.receipt_long_outlined, size: 40, color: Color(0xFF9CA3AF)),
                      SizedBox(height: 8),
                      Text('No expenses yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                      Text('Add your first expense above', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                    ]),
                  )
                else
                  ...List.generate(_recentExpenses.length, (i) {
                    final e = _recentExpenses[i];
                    final cat = e['category'] as String? ?? 'Other';
                    final vendor = e['vendor'] as String? ?? e['description'] as String? ?? 'N/A';
                    final amount = (e['amount'] as num?)?.toDouble() ?? 0;
                    final date = e['date'] as String? ?? '';
                    return Padding(
                      padding: EdgeInsets.only(bottom: i < _recentExpenses.length - 1 ? 8 : 0),
                      child: GestureDetector(
                        onTap: () async {
                          await Navigator.push(context, MaterialPageRoute(builder: (_) => ExpenseDetailScreen(expense: e)));
                          _loadData();
                        },
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: _catColor(cat).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                              child: Text(cat.length > 4 ? cat.substring(0, 4) : cat, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _catColor(cat))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(vendor, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF191C1E))),
                              Text('$cat • $date', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                            ])),
                            Text('₹${amount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                          ]),
                        ),
                      ),
                    );
                  }),
              ])),
            ),
            // Extra bottom padding so the floating Attendance pill
            // doesn't obscure the last row of recent expenses.
            const SliverToBoxAdapter(child: SizedBox(height: 96)),
          ],
        ),
      ),
          const AttendancePill(),
        ],
      ),
    );
  }

  Widget _shortcutCard({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151),
                height: 1.2,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  String _formatINR(double amount) {
    if (amount >= 100000) {
      return '\u20B9${(amount / 100000).toStringAsFixed(1)}L';
    }
    if (amount >= 1000) {
      return '\u20B9${(amount / 1000).toStringAsFixed(1)}k';
    }
    return '\u20B9${amount.toStringAsFixed(0)}';
  }

  Color _catColor(String cat) {
    switch (cat.toLowerCase()) {
      case 'transportation': return const Color(0xFF0EA5E9);
      case 'food': return const Color(0xFFF59E0B);
      case 'accommodation': return const Color(0xFF8B5CF6);
      case 'office supplies': return const Color(0xFF10B981);
      case 'medical': return const Color(0xFFEF4444);
      default: return const Color(0xFF6B7280);
    }
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String? badge;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, this.badge, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE5E7EB))),
          child: Icon(icon, color: const Color(0xFF9CA3AF), size: 22),
        ),
        if (badge != null)
          Positioned(top: -6, right: -6, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white, width: 2)),
            child: Text(badge!, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
          )),
      ]),
    );
  }
}

class _QuickStatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _QuickStatCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
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
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: Color(0xFF9CA3AF),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: iconColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? child;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _ActionCard({required this.icon, required this.iconColor, required this.title, required this.subtitle, this.child, this.trailing, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, color: iconColor, size: 22),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF191C1E))),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
            ])),
            if (trailing != null) trailing!,
          ]),
          if (child != null) ...[const SizedBox(height: 16), child!],
        ]),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// My Voucher Status Screen
// ════════════════════════════════════════════════════════════════════════════

class _MyVoucherStatusScreen extends StatefulWidget {
  const _MyVoucherStatusScreen();

  @override
  State<_MyVoucherStatusScreen> createState() => _MyVoucherStatusScreenState();
}

class _MyVoucherStatusScreenState extends State<_MyVoucherStatusScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _vouchers = [];

  @override
  void initState() {
    super.initState();
    _loadVouchers();
  }

  Future<void> _loadVouchers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final data = await Supabase.instance.client
          .from('vouchers')
          .select('id, voucher_number, status, total_amount, expense_count, purpose, submitted_at, created_at')
          .eq('submitted_by', user.id)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _vouchers = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFF59E0B);
      case 'manager_approved':
        return const Color(0xFF0EA5E9);
      case 'approved':
        return const Color(0xFF059669);
      case 'rejected':
        return const Color(0xFFEF4444);
      case 'reimbursed':
        return const Color(0xFF0EA5E9);
      default:
        return const Color(0xFF6B7280);
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'pending_manager':
      case 'pending_accountant':
        return const Color(0xFFFFFBEB);
      case 'manager_approved':
        return const Color(0xFFF0F9FF);
      case 'approved':
        return const Color(0xFFECFDF5);
      case 'rejected':
        return const Color(0xFFFEF2F2);
      case 'reimbursed':
        return const Color(0xFFF0F9FF);
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending_manager':
        return 'Pending Manager';
      case 'manager_approved':
        return 'Manager Approved';
      case 'pending_accountant':
        return 'Pending Accountant';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'reimbursed':
        return 'Reimbursed';
      default:
        return status.replaceAll('_', ' ').toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'My Vouchers',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF191C1E)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadVouchers,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF006699),
                ),
              )
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 48,
                            color: Color(0xFFEF4444),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Failed to load vouchers',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: _loadVouchers,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF006699),
                              side: const BorderSide(color: Color(0xFF006699)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _vouchers.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 100),
                          Center(
                            child: Column(
                              children: [
                                Icon(
                                  Icons.receipt_long_outlined,
                                  size: 48,
                                  color: Colors.grey[300],
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'No vouchers submitted yet',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF9CA3AF),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Submit expenses for approval to see them here',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFFBBBBBB),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _vouchers.length,
                        itemBuilder: (context, index) {
                          final v = _vouchers[index];
                          final number = v['voucher_number'] as String? ?? 'N/A';
                          final status = v['status'] as String? ?? '';
                          final totalAmount = (v['total_amount'] is num)
                              ? (v['total_amount'] as num).toDouble()
                              : 0.0;
                          final expenseCount = (v['expense_count'] is num)
                              ? (v['expense_count'] as num).toInt()
                              : 0;
                          final dateStr = v['submitted_at'] as String? ??
                              v['created_at'] as String?;
                          String formattedDate = '';
                          if (dateStr != null) {
                            try {
                              formattedDate = DateFormat('dd MMM yyyy')
                                  .format(DateTime.parse(dateStr));
                            } catch (_) {}
                          }

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Container(
                              padding: const EdgeInsets.all(16),
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
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          number,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF191C1E),
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '\u20B9${totalAmount.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF191C1E),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _statusBg(status),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(
                                                color: _statusColor(status),
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              _statusLabel(status),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: _statusColor(status),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '$expenseCount expense${expenseCount != 1 ? 's' : ''}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(
                                        formattedDate,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
