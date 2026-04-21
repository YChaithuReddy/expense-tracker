import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/utils/date_formatter.dart';

/// Activity Log screen.
///
/// Fetches from the `activity_log` table for the current user,
/// groups entries by date (Today, Yesterday, This Week, Older),
/// and displays each with an action-type icon and relative timestamp.
class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  State<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends State<ActivityLogScreen> {
  List<Map<String, dynamic>> _logs = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  Future<void> _loadLogs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      final data = await Supabase.instance.client
          .from('activity_log')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(100);

      if (!mounted) return;

      setState(() {
        _logs = List<Map<String, dynamic>>.from(data as List);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  /// Groups logs by date label using DateFormatter.groupLabel.
  Map<String, List<Map<String, dynamic>>> get _groupedLogs {
    final Map<String, List<Map<String, dynamic>>> groups = {};

    for (final log in _logs) {
      final createdAt = log['created_at'] != null
          ? DateTime.parse(log['created_at'] as String)
          : DateTime.now();
      final label = _dateGroupLabel(createdAt);

      groups.putIfAbsent(label, () => []);
      groups[label]!.add(log);
    }

    return groups;
  }

  String _dateGroupLabel(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateDay = DateTime(date.year, date.month, date.day);
    final diff = today.difference(dateDay).inDays;

    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return 'This Week';
    return 'Older';
  }

  IconData _iconForAction(String? action) {
    return switch (action) {
      'expense_added' => Icons.receipt_long_outlined,
      'expense_deleted' => Icons.delete_outlined,
      'voucher_submitted' => Icons.send_outlined,
      'voucher_approved' => Icons.check_circle_outlined,
      'advance_submitted' => Icons.account_balance_outlined,
      'login' => Icons.login_outlined,
      _ => Icons.info_outlined,
    };
  }

  String _formatActionLabel(String action) {
    return switch (action) {
      'expense_added' => 'Expense Added',
      'expense_deleted' => 'Expense Deleted',
      'voucher_submitted' => 'Voucher Submitted',
      'voucher_approved' => 'Voucher Approved',
      'advance_submitted' => 'Advance Submitted',
      'login' => 'Login',
      _ => action
          .replaceAll('_', ' ')
          .split(' ')
          .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
          .join(' '),
    };
  }

  Color _colorForAction(String? action) {
    return switch (action) {
      'expense_added' => const Color(0xFF059669),
      'expense_deleted' => const Color(0xFFBA1A1A),
      'voucher_submitted' => const Color(0xFFF59E0B),
      'voucher_approved' => const Color(0xFF059669),
      'advance_submitted' => const Color(0xFF006699),
      'login' => const Color(0xFF0EA5E9),
      _ => const Color(0xFF6B7280),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white.withValues(alpha: 0.95),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: Color(0xFF444653),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Activity Log',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
            letterSpacing: -0.02,
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF006699)),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFBA1A1A)),
              const SizedBox(height: 16),
              const Text(
                'Failed to load activity log',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF191C1E),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
              ),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: _loadLogs,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF006699),
                  side: const BorderSide(color: Color(0xFF006699)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_logs.isEmpty) {
      return _buildEmptyState();
    }

    final groups = _groupedLogs;
    // Maintain consistent order: Today, Yesterday, This Week, Older
    final orderedKeys = <String>[];
    for (final key in ['Today', 'Yesterday', 'This Week', 'Older']) {
      if (groups.containsKey(key)) orderedKeys.add(key);
    }

    return RefreshIndicator(
      onRefresh: _loadLogs,
      color: const Color(0xFF006699),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orderedKeys.length,
        itemBuilder: (context, sectionIndex) {
          final label = orderedKeys[sectionIndex];
          final items = groups[label]!;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (sectionIndex > 0) const SizedBox(height: 20),
              // Section header
              Padding(
                padding: const EdgeInsets.only(bottom: 10, left: 4),
                child: Text(
                  label.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ),
              // Section items
              Container(
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
                  children: List.generate(items.length, (index) {
                    final log = items[index];
                    final action = log['action'] as String?;
                    final description =
                        log['details'] as String? ?? 'Activity';
                    final createdAt = log['created_at'] != null
                        ? DateTime.parse(log['created_at'] as String)
                        : DateTime.now();
                    final icon = _iconForAction(action);
                    final color = _colorForAction(action);

                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
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
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      description,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF191C1E),
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if (action != null &&
                                        action.isNotEmpty &&
                                        action != description) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        _formatActionLabel(action),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: color,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 2),
                                    Text(
                                      DateFormatter.relative(createdAt),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF9CA3AF),
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (index < items.length - 1)
                          const Divider(
                            height: 1,
                            indent: 70,
                            color: Color(0xFFF3F4F6),
                          ),
                      ],
                    );
                  }),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.history,
              size: 40,
              color: Color(0xFF6366F1),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'No activity yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(0xFF191C1E),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your activity history will\nappear here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF9CA3AF),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}
