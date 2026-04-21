import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/network/supabase_client.dart';
import '../models/notification_item.dart';

/// Service for notifications against the Supabase `notifications` table.
///
/// Supports fetching, marking as read, and real-time subscriptions via
/// Supabase Realtime (PostgreSQL changes).
class NotificationService {
  NotificationService();

  // Active realtime channel reference for cleanup.
  RealtimeChannel? _realtimeChannel;

  // ─── Read ──────────────────────────────────────────────────────────────

  /// Fetches notifications for [userId], ordered newest first.
  ///
  /// Defaults to the latest 50 items.
  Future<List<NotificationItem>> getNotifications(
    String userId, {
    int limit = 50,
  }) async {
    try {
      final data = await supabase
          .from('notifications')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(limit);

      return (data as List<dynamic>)
          .map((row) =>
              NotificationItem.fromJson(row as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getNotifications error: $e');
      throw Exception('Failed to load notifications: $e');
    }
  }

  /// Returns the count of unread notifications for [userId].
  Future<int> getUnreadCount(String userId) async {
    try {
      final result = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('is_read', false)
          .count(CountOption.exact);

      return result.count;
    } catch (e) {
      debugPrint('getUnreadCount error: $e');
      return 0;
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────

  /// Marks a single notification as read.
  Future<void> markAsRead(String notificationId) async {
    try {
      await supabase
          .from('notifications')
          .update({'is_read': true})
          .eq('id', notificationId);
    } catch (e) {
      debugPrint('markAsRead error: $e');
      throw Exception('Failed to mark notification as read: $e');
    }
  }

  /// Marks all notifications for [userId] as read.
  Future<void> markAllAsRead(String userId) async {
    try {
      await supabase
          .from('notifications')
          .update({'is_read': true})
          .eq('user_id', userId)
          .eq('is_read', false);
    } catch (e) {
      debugPrint('markAllAsRead error: $e');
      throw Exception('Failed to mark all notifications as read: $e');
    }
  }

  // ─── Realtime ──────────────────────────────────────────────────────────

  /// Subscribes to real-time INSERT events on the `notifications` table
  /// filtered to [userId].
  ///
  /// Returns a [Stream] of [NotificationItem] that emits whenever a new
  /// notification is created for this user.
  ///
  /// Call [unsubscribe] when done to clean up the channel.
  Stream<NotificationItem> subscribeToNotifications(String userId) {
    final controller = StreamController<NotificationItem>.broadcast();

    // Clean up any existing subscription
    _unsubscribeInternal();

    _realtimeChannel = supabase
        .channel('notifications:$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'notifications',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            try {
              final newRow = payload.newRecord;
              if (newRow.isNotEmpty) {
                final notification = NotificationItem.fromJson(newRow);
                controller.add(notification);
              }
            } catch (e) {
              debugPrint('Realtime notification parse error: $e');
            }
          },
        )
        .subscribe();

    // Clean up when the stream is cancelled
    controller.onCancel = () {
      _unsubscribeInternal();
    };

    return controller.stream;
  }

  /// Removes the active realtime subscription.
  Future<void> unsubscribe() async {
    await _unsubscribeInternal();
  }

  Future<void> _unsubscribeInternal() async {
    if (_realtimeChannel != null) {
      try {
        await supabase.removeChannel(_realtimeChannel!);
      } catch (e) {
        debugPrint('Realtime unsubscribe warning: $e');
      }
      _realtimeChannel = null;
    }
  }
}
