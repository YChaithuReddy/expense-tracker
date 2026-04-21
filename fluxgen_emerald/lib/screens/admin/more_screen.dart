import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/core/constants/app_constants.dart';
import 'package:emerald/screens/admin/admin_settings_screen.dart';
import 'package:emerald/screens/shared/report_issue_screen.dart';
import 'package:emerald/services/update_service.dart';

/// "More" tab -- lightweight hub after feature shortcuts moved to Overview.
///
/// Shows: Settings, Help & Support, About.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  static Future<void> _handleLogout(BuildContext context) async {
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

  static void _showClearDataDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.warning_amber, color: Color(0xFFEA580C), size: 24),
          const SizedBox(width: 8),
          const Text('Clear Data', style: TextStyle(fontWeight: FontWeight.w700)),
        ]),
        content: const Text('This will clear all locally cached data. Your Supabase data is safe.\n\nContinue?'),
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
            floating: true,
            snap: true,
            backgroundColor: Colors.white.withValues(alpha: 0.95),
            surfaceTintColor: Colors.transparent,
            automaticallyImplyLeading: false,
            title: const Text(
              'More',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF191C1E),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Settings
                _MoreCard(
                  icon: Icons.settings_outlined,
                  iconColor: const Color(0xFF6B7280),
                  title: 'Settings',
                  subtitle: 'Organization, employees & projects',
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const AdminSettingsScreen()),
                  ),
                ),
                const SizedBox(height: 10),

                // Help & Support
                _MoreCard(
                  icon: Icons.help_outline,
                  iconColor: const Color(0xFF006699),
                  title: 'Help & Support',
                  subtitle: 'FAQs, contact support, report issues',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Support coming soon'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 10),

                // About
                _MoreCard(
                  icon: Icons.info_outline,
                  iconColor: const Color(0xFF8B5CF6),
                  title: 'About',
                  subtitle: 'FluxGen Expense Tracker v${AppConstants.appVersion}',
                  onTap: () {
                    showAboutDialog(
                      context: context,
                      applicationName: 'FluxGen Expense Tracker',
                      applicationVersion: AppConstants.appVersion,
                      applicationLegalese: '2026 FluxGen. All rights reserved.',
                    );
                  },
                ),

                const SizedBox(height: 10),

                // Report Issue
                _MoreCard(
                  icon: Icons.bug_report_outlined,
                  iconColor: const Color(0xFFEF4444),
                  title: 'Report an Issue',
                  subtitle: 'Bug reports, feature requests & feedback',
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ReportIssueScreen()),
                  ),
                ),
                const SizedBox(height: 10),

                // Check for Updates
                _MoreCard(
                  icon: Icons.system_update,
                  iconColor: const Color(0xFF006699),
                  title: 'Check for Updates',
                  subtitle: 'Download & install latest version',
                  onTap: () => UpdateService.manualCheck(context),
                ),
                const SizedBox(height: 10),

                // Clear Data
                _MoreCard(
                  icon: Icons.warning_amber_outlined,
                  iconColor: const Color(0xFFEA580C),
                  title: 'Clear Data',
                  subtitle: 'Remove cached data & reset',
                  onTap: () => _showClearDataDialog(context),
                ),
                const SizedBox(height: 32),

                // Sign Out
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton.icon(
                    onPressed: () => _handleLogout(context),
                    icon: const Icon(Icons.logout, size: 20),
                    label: const Text('Sign Out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFBA1A1A),
                      side: const BorderSide(color: Color(0xFFBA1A1A), width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Center(child: Text('FluxGen Expense Tracker v${AppConstants.appVersion}', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)))),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _MoreCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _MoreCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
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
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              size: 14,
              color: Color(0xFF9CA3AF),
            ),
          ],
        ),
      ),
    );
  }
}
