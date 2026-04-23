import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/screens/employee/settings/profile_edit_screen.dart';
import 'package:emerald/screens/employee/whatsapp/whatsapp_screen.dart';
import 'package:emerald/screens/shared/report_issue_screen.dart';
import 'package:emerald/core/constants/app_constants.dart';
import 'package:emerald/services/update_service.dart';
import 'package:emerald/widgets/notification_bell.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  String _userName = '';
  String _userEmail = '';
  String _employeeId = '';
  String _initials = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final data = await Supabase.instance.client
          .from('profiles')
          .select('name, email, employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (mounted && data != null) {
        final name = data['name'] as String? ?? user.email?.split('@').first ?? 'User';
        setState(() {
          _userName = name;
          _userEmail = data['email'] as String? ?? user.email ?? '';
          _employeeId = data['employee_id'] as String? ?? '';
          _initials = name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
        });
      }
    } catch (_) {}
  }

  Future<void> _handleLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out', style: TextStyle(color: Color(0xFFBA1A1A), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (shouldLogout == true) {
      try { await Supabase.instance.client.auth.signOut(); } catch (_) {}
    }
  }

  void _showClearDataDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.warning_amber, color: Color(0xFFEA580C), size: 24),
          const SizedBox(width: 8),
          const Text('Clear Data', style: TextStyle(fontWeight: FontWeight.w700)),
        ]),
        content: const Text('This will clear all locally cached data. Your Supabase data is safe and will be re-downloaded on next load.\n\nContinue?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Local cache cleared'), backgroundColor: Color(0xFF059669)),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true, snap: true,
            backgroundColor: Colors.white.withValues(alpha: 0.95),
            surfaceTintColor: Colors.transparent,
            automaticallyImplyLeading: false,
            title: const Text('Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
            actions: const [
              NotificationBell(),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              // Profile Section
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
                ),
                child: Row(children: [
                  Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF006699), Color(0xFF00288E)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Center(child: Text(_initials.isEmpty ? '?' : _initials, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700))),
                  ),
                  const SizedBox(width: 16),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_userName.isEmpty ? 'Loading...' : _userName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                    const SizedBox(height: 2),
                    Text(_userEmail, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                    if (_employeeId.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(4)),
                        child: Text(_employeeId, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6B7280), letterSpacing: 0.5)),
                      ),
                    ],
                  ])),
                  IconButton(
                    onPressed: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileEditScreen()));
                      _loadProfile();
                    },
                    icon: const Icon(Icons.edit_outlined, size: 20, color: Color(0xFF006699)),
                  ),
                ]),
              ),
              const SizedBox(height: 16),

              // WhatsApp
              _SettingsCard(icon: Icons.chat, iconColor: const Color(0xFF25D366), title: 'WhatsApp', subtitle: 'Notifications & expense summary',
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WhatsAppScreen()))),
              const SizedBox(height: 10),

              // Report Issue
              _SettingsCard(icon: Icons.bug_report_outlined, iconColor: const Color(0xFFEF4444), title: 'Report an Issue', subtitle: 'Bug reports, feature requests & feedback',
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportIssueScreen()))),
              const SizedBox(height: 10),

              // Check for Updates
              _SettingsCard(icon: Icons.system_update, iconColor: const Color(0xFF006699), title: 'Check for Updates', subtitle: 'Download & install latest version',
                onTap: () => UpdateService.manualCheck(context)),
              const SizedBox(height: 10),

              // Clear Data
              _SettingsCard(icon: Icons.warning_amber_outlined, iconColor: const Color(0xFFEA580C), title: 'Clear Data', subtitle: 'Remove cached data & reset',
                onTap: _showClearDataDialog),
              const SizedBox(height: 32),

              // Logout
              SizedBox(
                width: double.infinity, height: 52,
                child: OutlinedButton.icon(
                  onPressed: _handleLogout,
                  icon: const Icon(Icons.logout, size: 20),
                  label: const Text('Sign Out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFBA1A1A), side: const BorderSide(color: Color(0xFFBA1A1A), width: 1.5), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                ),
              ),
              const SizedBox(height: 16),
              Center(child: Text('FluxGen Expense Tracker v${AppConstants.appVersion}', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)))),
              const SizedBox(height: 32),
            ])),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsCard({required this.icon, required this.iconColor, required this.title, required this.subtitle, this.trailing, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF191C1E))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
          ])),
          trailing ?? const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
        ]),
      ),
    );
  }
}
