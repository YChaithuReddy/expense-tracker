import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:emerald/core/utils/date_formatter.dart';
import 'package:emerald/models/notification_item.dart';

/// Notifications list screen.
///
/// Fetches from Supabase `notifications` table for the current user,
/// ordered by `created_at` descending. Supports pull-to-refresh,
/// mark-all-read, and tap-to-mark-read.
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<NotificationItem> _notifications = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      final data = await Supabase.instance.client
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(50);

      if (!mounted) return;

      final list = <NotificationItem>[];
      for (final row in (data as List)) {
        try {
          list.add(
              NotificationItem.fromJson(row as Map<String, dynamic>));
        } catch (_) {
          // Skip malformed rows to avoid breaking the entire list
        }
      }

      setState(() {
        _notifications = list;
        _isLoading = false;
      });
    } on PostgrestException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
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

  Future<void> _markAsRead(NotificationItem notification) async {
    if (notification.read) return;

    try {
      await Supabase.instance.client
          .from('notifications')
          .update({'is_read': true}).eq('id', notification.id);

      if (!mounted) return;

      setState(() {
        final index = _notifications.indexWhere((n) => n.id == notification.id);
        if (index != -1) {
          _notifications[index] = _notifications[index].copyWith(read: true);
        }
      });
    } catch (_) {
      // Silently fail — will be marked on next refresh
    }
  }

  Future<void> _markAllAsRead() async {
    final hasUnread = _notifications.any((n) => n.isUnread);
    if (!hasUnread) return;

    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return;

      await Supabase.instance.client
          .from('notifications')
          .update({'is_read': true})
          .eq('user_id', userId)
          .eq('is_read', false);

      if (!mounted) return;

      setState(() {
        _notifications = _notifications
            .map((n) => n.isUnread ? n.copyWith(read: true) : n)
            .toList();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('All notifications marked as read'),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => n.isUnread);

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
          'Notifications',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
            letterSpacing: -0.02,
          ),
        ),
        actions: [
          if (hasUnread)
            TextButton.icon(
              onPressed: _markAllAsRead,
              icon: const Icon(
                Icons.done_all,
                size: 18,
                color: Color(0xFF006699),
              ),
              label: const Text(
                'Read all',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF006699),
                ),
              ),
            ),
        ],
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
              const Icon(
                Icons.error_outline,
                size: 48,
                color: Color(0xFFBA1A1A),
              ),
              const SizedBox(height: 16),
              const Text(
                'Failed to load notifications',
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
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF9CA3AF),
                ),
              ),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: _loadNotifications,
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

    if (_notifications.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: _loadNotifications,
      color: const Color(0xFF006699),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _notifications.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          return _NotificationTile(
            notification: _notifications[index],
            onTap: () => _markAsRead(_notifications[index]),
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
              color: const Color(0xFF006699).withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_none_outlined,
              size: 40,
              color: Color(0xFF006699),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'No notifications yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(0xFF191C1E),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You will see notifications here\nwhen there are updates.',
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

// ── Notification Tile Widget ──────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final NotificationItem notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isUnread = notification.isUnread;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
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
          border: isUnread
              ? const Border(
                  left: BorderSide(color: Color(0xFF006699), width: 3),
                )
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Icon ───────────────────────────────────────────
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _icon,
                  size: 20,
                  color: _iconColor,
                ),
              ),
              const SizedBox(width: 14),

              // ── Content ────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isUnread ? FontWeight.w700 : FontWeight.w600,
                        color: const Color(0xFF191C1E),
                      ),
                    ),
                    if (notification.message != null &&
                        notification.message!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        notification.message!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                          height: 1.4,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      notification.createdAt != null
                          ? DateFormatter.relative(notification.createdAt!)
                          : '',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              // ── Unread dot ─────────────────────────────────────
              if (isUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4, left: 8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF006699),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Icon mapping by notification type ─────────────────────────────────

  IconData get _icon {
    return switch (notification.type) {
      'voucher_submitted' => Icons.receipt_long_outlined,
      'voucher_approved' => Icons.check_circle_outline,
      'voucher_rejected' => Icons.cancel_outlined,
      'voucher_reimbursed' => Icons.payments_outlined,
      'voucher_resubmitted' => Icons.replay_outlined,
      'advance_submitted' => Icons.upload_outlined,
      'advance_approved' => Icons.thumb_up_outlined,
      'advance_rejected' => Icons.thumb_down_outlined,
      'advance_resubmitted' => Icons.replay_outlined,
      'expense_added' => Icons.add_card_outlined,
      'employee_joined' => Icons.person_add_outlined,
      'project_created' => Icons.create_new_folder_outlined,
      'system' => Icons.info_outline,
      _ => Icons.notifications_outlined,
    };
  }

  Color get _iconColor {
    return switch (notification.type) {
      'voucher_approved' ||
      'advance_approved' ||
      'voucher_reimbursed' =>
        const Color(0xFF059669),
      'voucher_rejected' || 'advance_rejected' => const Color(0xFFBA1A1A),
      'voucher_submitted' ||
      'advance_submitted' ||
      'voucher_resubmitted' ||
      'advance_resubmitted' =>
        const Color(0xFFF59E0B),
      'expense_added' => const Color(0xFF0EA5E9),
      'employee_joined' || 'project_created' => const Color(0xFF006699),
      _ => const Color(0xFF6B7280),
    };
  }
}
