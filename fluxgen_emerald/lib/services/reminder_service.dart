import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Service for advance deadline reminders.
///
/// The company policy allows 10 days to submit advance vouchers.
/// This service warns users when advances are nearing the deadline
/// (8+ days old) so they can act before the 10-day limit.
class ReminderService {
  ReminderService._();

  static final _supabase = Supabase.instance.client;

  static const _prefKey = 'last_deadline_reminder_date';

  /// Returns `true` if no reminder has been shown today yet.
  static Future<bool> _shouldShowToday() async {
    final prefs = await SharedPreferences.getInstance();
    final lastShown = prefs.getString(_prefKey) ?? '';
    final today = DateTime.now().toIso8601String().split('T')[0]; // YYYY-MM-DD
    return lastShown != today;
  }

  /// Records today's date so the reminder won't fire again until tomorrow.
  static Future<void> _markShownToday() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().split('T')[0];
    await prefs.setString(_prefKey, today);
  }

  /// Checks for advances nearing the 10-day deadline and shows a
  /// reminder dialog if any are found.
  ///
  /// The reminder is shown at most once per calendar day.
  /// Call this from `initState` / `addPostFrameCallback` on the shell screen.
  static Future<void> checkAndNotify(BuildContext context) async {
    try {
      if (!await _shouldShowToday()) return;

      final advances = await checkDeadlines();
      if (advances.isNotEmpty && context.mounted) {
        showDeadlineReminder(context, advances);
        await _markShownToday();
      }
    } catch (e) {
      debugPrint('ReminderService check error: $e');
    }
  }

  /// Fetches active advances where `submitted_at` is more than 8 days ago.
  ///
  /// Returns a list of advance maps with `id`, `project_name`, `amount`,
  /// `submitted_at`, and computed `days_remaining`.
  static Future<List<Map<String, dynamic>>> checkDeadlines() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    try {
      // Fetch all active advances and filter client-side because
      // the date field to check (submitted_at vs created_at) varies per row.
      final data = await _supabase
          .from('advances')
          .select('id, project_name, amount, submitted_at, created_at, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', ascending: false);

      final results = <Map<String, dynamic>>[];

      for (final row in (data as List<dynamic>)) {
        final map = row as Map<String, dynamic>;

        // Use submitted_at if available, else created_at
        final dateStr = (map['submitted_at'] ?? map['created_at']) as String?;
        if (dateStr == null) continue;

        final submittedDate = DateTime.tryParse(dateStr);
        if (submittedDate == null) continue;

        final daysSinceSubmission =
            DateTime.now().difference(submittedDate).inDays;

        // Warn at 8+ days (2 days before the 10-day deadline)
        if (daysSinceSubmission >= 8) {
          final daysRemaining = 10 - daysSinceSubmission;
          results.add({
            ...map,
            'days_since_submission': daysSinceSubmission,
            'days_remaining': daysRemaining < 0 ? 0 : daysRemaining,
          });
        }
      }

      return results;
    } catch (e) {
      debugPrint('checkDeadlines error: $e');
      return [];
    }
  }

  /// Shows a warning dialog listing advances nearing the 10-day deadline.
  static void showDeadlineReminder(
    BuildContext context,
    List<Map<String, dynamic>> advances,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFF59E0B),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Deadline Reminder',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'The following advances are nearing the 10-day voucher submission deadline:',
              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 16),
            ...advances.map((adv) {
              final projectName = adv['project_name'] ?? 'Unknown';
              final amount = (adv['amount'] as num?)?.toDouble() ?? 0;
              final daysRemaining = adv['days_remaining'] as int? ?? 0;
              final isOverdue = daysRemaining <= 0;

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isOverdue
                      ? const Color(0xFFFEE2E2)
                      : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isOverdue
                        ? const Color(0xFFBA1A1A).withValues(alpha: 0.3)
                        : const Color(0xFFF59E0B).withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            projectName.toString(),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Rs. ${amount.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: isOverdue
                            ? const Color(0xFFBA1A1A)
                            : const Color(0xFFF59E0B),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isOverdue
                            ? 'OVERDUE'
                            : '$daysRemaining day${daysRemaining == 1 ? '' : 's'} left',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Dismiss',
              style: TextStyle(color: Color(0xFF6B7280)),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              // Navigate to advance screen — the shell should switch to index 1
              // For now, we pop back which is safe from the shell
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF006699),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('View Advances'),
          ),
        ],
      ),
    );
  }
}
