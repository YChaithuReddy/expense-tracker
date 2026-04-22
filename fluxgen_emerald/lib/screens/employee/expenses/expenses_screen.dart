import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/employee/expenses/add_expense_screen.dart';
import 'package:emerald/screens/employee/expenses/scan_receipt_screen.dart';
import 'package:emerald/screens/employee/expenses/expense_detail_screen.dart';
import 'package:emerald/screens/employee/expenses/saved_images_screen.dart';
import 'package:emerald/screens/employee/voucher/submit_voucher_screen.dart';
import 'package:emerald/screens/employee/export/export_screen.dart';
import 'package:emerald/screens/employee/settings/bank_details_screen.dart';
import 'package:emerald/screens/employee/pdfs/pdf_library_screen.dart';
import 'package:emerald/screens/attendance/widgets/attendance_pill.dart';
import 'package:emerald/screens/employee/export/sheets_export_screen.dart';
import 'package:emerald/services/google_sheets_service.dart';
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

  RealtimeChannel? _expensesChannel;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    if (_expensesChannel != null) {
      Supabase.instance.client.removeChannel(_expensesChannel!);
      _expensesChannel = null;
    }
    super.dispose();
  }

  void _subscribeToExpenses(String userId) {
    if (_expensesChannel != null) return;
    _expensesChannel = Supabase.instance.client
        .channel('expenses:$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'expenses',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (_) {
            if (mounted) _loadData();
          },
        )
        .subscribe();
  }

  Future<void> _resetGoogleSheet() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.warning_amber, color: Color(0xFFEA580C), size: 24),
          const SizedBox(width: 8),
          const Text('Reset Sheet?', style: TextStyle(fontWeight: FontWeight.w700)),
        ]),
        content: const Text('This will clear all data in your Google Sheet and restore the template format.\n\nYour expense data in the app is safe — only the sheet is reset.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C), foregroundColor: Colors.white),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resetting Google Sheet...'), backgroundColor: Color(0xFFEA580C), duration: Duration(seconds: 3)),
      );
      await GoogleSheetsService.resetSheet();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sheet reset to template! You can now re-export.'), backgroundColor: Color(0xFF059669)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reset failed: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _loadData() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      _subscribeToExpenses(user.id);

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
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.85,
                  children: [
                    if (_organizationId != null)
                      _shortcutCard(
                        icon: Icons.send,
                        label: 'Submit\nVoucher',
                        color: const Color(0xFF8B5CF6),
                        onTap: () async {
                          final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const SubmitVoucherScreen()));
                          if (result == true) _loadData();
                        },
                      ),
                    _shortcutCard(
                      icon: Icons.table_chart,
                      label: 'Google\nSheets',
                      color: const Color(0xFF059669),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SheetsExportScreen())),
                    ),
                    _shortcutCard(
                      icon: Icons.refresh,
                      label: 'Reset\nSheet',
                      color: const Color(0xFFEA580C),
                      onTap: () => _resetGoogleSheet(),
                    ),
                    _shortcutCard(
                      icon: Icons.download,
                      label: 'Export &\nReport',
                      color: const Color(0xFF0EA5E9),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExportScreen())),
                    ),
                    _shortcutCard(
                      icon: Icons.picture_as_pdf,
                      label: 'PDF\nLibrary',
                      color: const Color(0xFFEF4444),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PdfLibraryScreen())),
                    ),
                    _shortcutCard(
                      icon: Icons.account_balance,
                      label: 'Bank\nDetails',
                      color: const Color(0xFF006699),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BankDetailsScreen())),
                    ),
                    _shortcutCard(
                      icon: Icons.photo_library,
                      label: 'Saved\nImages',
                      color: const Color(0xFF0EA5E9),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SavedImagesScreen())),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

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
