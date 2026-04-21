import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Queues Supabase operations when offline and syncs when back online.
///
/// Usage:
/// ```dart
/// // Instead of direct Supabase insert:
/// await OfflineQueueService.instance.execute(
///   table: 'expenses',
///   operation: 'insert',
///   data: expenseData,
/// );
/// ```
class OfflineQueueService {
  static final OfflineQueueService instance = OfflineQueueService._();
  OfflineQueueService._();

  static const _boxName = 'offline_queue';
  late Box<String> _box;
  bool _initialized = false;
  bool _syncing = false;
  StreamSubscription? _connectivitySub;
  final _statusNotifier = ValueNotifier<bool>(true); // true = online

  ValueNotifier<bool> get onlineStatus => _statusNotifier;
  bool get isOnline => _statusNotifier.value;
  int get pendingCount => _box.length;

  /// Initialize Hive + start listening for connectivity changes
  Future<void> init() async {
    if (_initialized) return;
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
    _initialized = true;

    // Check initial status
    final result = await Connectivity().checkConnectivity();
    _statusNotifier.value = !result.contains(ConnectivityResult.none);

    // Listen for changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((result) {
      final online = !result.contains(ConnectivityResult.none);
      _statusNotifier.value = online;
      if (online && _box.isNotEmpty) {
        _syncQueue();
      }
    });

    // Sync any pending items on startup
    if (_statusNotifier.value && _box.isNotEmpty) {
      _syncQueue();
    }
  }

  /// Execute a Supabase operation — queues if offline, executes immediately if online
  Future<Map<String, dynamic>?> execute({
    required String table,
    required String operation, // 'insert', 'update', 'delete'
    required Map<String, dynamic> data,
    String? matchField,
    String? matchValue,
  }) async {
    if (_statusNotifier.value) {
      // Online — execute directly
      try {
        return await _executeOnSupabase(table, operation, data, matchField, matchValue);
      } catch (e) {
        // If it fails (maybe connection dropped), queue it
        debugPrint('Direct execute failed, queuing: $e');
        _enqueue(table, operation, data, matchField, matchValue);
        return null;
      }
    } else {
      // Offline — queue for later
      _enqueue(table, operation, data, matchField, matchValue);
      return null;
    }
  }

  void _enqueue(String table, String operation, Map<String, dynamic> data, String? matchField, String? matchValue) {
    final item = jsonEncode({
      'table': table,
      'operation': operation,
      'data': data,
      'matchField': matchField,
      'matchValue': matchValue,
      'timestamp': DateTime.now().toIso8601String(),
    });
    _box.add(item);
    debugPrint('Queued offline: $operation on $table (${_box.length} pending)');
  }

  Future<Map<String, dynamic>?> _executeOnSupabase(
    String table, String operation, Map<String, dynamic> data,
    String? matchField, String? matchValue,
  ) async {
    final client = Supabase.instance.client;
    switch (operation) {
      case 'insert':
        final result = await client.from(table).insert(data).select().single();
        return result;
      case 'update':
        if (matchField != null && matchValue != null) {
          final result = await client.from(table).update(data).eq(matchField, matchValue).select().single();
          return result;
        }
        return null;
      case 'delete':
        if (matchField != null && matchValue != null) {
          await client.from(table).delete().eq(matchField, matchValue);
        }
        return null;
      default:
        return null;
    }
  }

  /// Process all queued items
  Future<void> _syncQueue() async {
    if (_syncing || _box.isEmpty) return;
    _syncing = true;
    debugPrint('Syncing ${_box.length} queued operations...');

    final keysToDelete = <dynamic>[];

    for (var i = 0; i < _box.length; i++) {
      final raw = _box.getAt(i);
      if (raw == null) continue;

      try {
        final item = jsonDecode(raw) as Map<String, dynamic>;
        await _executeOnSupabase(
          item['table'],
          item['operation'],
          Map<String, dynamic>.from(item['data']),
          item['matchField'],
          item['matchValue'],
        );
        keysToDelete.add(_box.keyAt(i));
        debugPrint('Synced: ${item['operation']} on ${item['table']}');
      } catch (e) {
        debugPrint('Sync failed for item $i: $e');
        // Stop syncing on first failure — will retry on next connectivity change
        break;
      }
    }

    // Remove successfully synced items
    for (final key in keysToDelete) {
      await _box.delete(key);
    }

    _syncing = false;
    debugPrint('Sync complete. ${_box.length} items remaining.');
  }

  /// Manual sync trigger (e.g., from pull-to-refresh)
  Future<int> syncNow() async {
    final before = _box.length;
    await _syncQueue();
    return before - _box.length;
  }

  void dispose() {
    _connectivitySub?.cancel();
  }
}
