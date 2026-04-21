import 'package:supabase_flutter/supabase_flutter.dart';

class ActivityLogService {
  static Future<void> log(String action, String description) async {
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) return;
      await Supabase.instance.client.from('activity_log').insert({
        'user_id': userId,
        'action': action,
        'details': description,
      });
    } catch (_) {}
  }
}
