import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:async';
import '../screens/shared/notification_screen.dart';

/// Reusable notification bell icon with live unread count badge and
/// a small sync-status dot (green = connected, amber = reconnecting,
/// gray = offline).
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

enum _SyncState { connected, reconnecting, offline }

class _NotificationBellState extends State<NotificationBell> {
  int _unread = 0;
  StreamSubscription? _sub;
  _SyncState _syncState = _SyncState.reconnecting;

  @override
  void initState() {
    super.initState();
    _loadCount();
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      _syncState = _SyncState.reconnecting;
      _sub = Supabase.instance.client
          .from('notifications')
          .stream(primaryKey: ['id'])
          .eq('user_id', user.id)
          .listen(
            (data) {
              if (mounted) {
                final count = data.where((n) => n['is_read'] == false).length;
                setState(() {
                  _unread = count;
                  _syncState = _SyncState.connected;
                });
              }
            },
            onError: (_) {
              if (mounted) setState(() => _syncState = _SyncState.offline);
            },
            onDone: () {
              if (mounted) setState(() => _syncState = _SyncState.offline);
            },
          );
    } else {
      _syncState = _SyncState.offline;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _loadCount() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final result = await Supabase.instance.client
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_read', false);
      if (mounted) setState(() => _unread = (result as List).length);
    } catch (_) {}
  }

  Color get _syncColor {
    switch (_syncState) {
      case _SyncState.connected:
        return const Color(0xFF10B981);
      case _SyncState.reconnecting:
        return const Color(0xFFF59E0B);
      case _SyncState.offline:
        return const Color(0xFF9CA3AF);
    }
  }

  String get _syncTooltip {
    switch (_syncState) {
      case _SyncState.connected:
        return 'Notifications • Synced';
      case _SyncState.reconnecting:
        return 'Notifications • Reconnecting';
      case _SyncState.offline:
        return 'Notifications • Offline';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: _syncTooltip,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          IconButton(
            icon: const Icon(
              Icons.notifications_outlined,
              color: Color(0xFF9CA3AF),
            ),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const NotificationScreen(),
                ),
              );
              _loadCount();
            },
          ),
          // Sync status dot (top-left)
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: _syncColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1),
              ),
            ),
          ),
          // Unread badge (top-right)
          if (_unread > 0)
            Positioned(
              top: 8,
              right: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(8),
                ),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                child: Text(
                  _unread > 99 ? '99+' : '$_unread',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
