import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:open_filex/open_filex.dart';
import 'package:emerald/core/constants/app_constants.dart';

class UpdateService {
  static const _currentVersion = AppConstants.appVersion;
  static const _currentBuildNumber = 31;

  /// Check for updates on app start — shows once per day max, skips dismissed versions
  static Future<void> checkForUpdate(BuildContext context) async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Only check once per day (unless force_update)
      final lastCheck = prefs.getString('update_last_check_date') ?? '';
      final today = DateTime.now().toIso8601String().substring(0, 10);

      final data = await Supabase.instance.client
          .from('app_config')
          .select()
          .eq('key', 'android_latest')
          .maybeSingle();

      if (data == null) return;

      final latestVersion = data['value'] as String? ?? _currentVersion;
      final apkUrl = data['metadata']?['apk_url'] as String? ?? '';
      final releaseNotes = data['metadata']?['release_notes'] as String? ?? '';
      final forceUpdate = data['metadata']?['force_update'] as bool? ?? false;
      final latestBuild = data['metadata']?['build_number'] as int? ?? 0;

      final isNewer = _compareSemver(latestVersion, _currentVersion) > 0 ||
          latestBuild > _currentBuildNumber;

      if (!isNewer) return;

      // Skip if already shown today (unless force update)
      if (!forceUpdate && lastCheck == today) return;

      // Skip if user dismissed this specific version
      final skippedVersion = prefs.getString('update_skipped_version') ?? '';
      if (!forceUpdate && skippedVersion == latestVersion) return;

      // Mark as checked today
      await prefs.setString('update_last_check_date', today);

      if (!context.mounted) return;
      _showUpdateDialog(context,
        latestVersion: latestVersion,
        apkUrl: apkUrl,
        releaseNotes: releaseNotes,
        forceUpdate: forceUpdate,
      );
    } catch (e) {
      debugPrint('Update check failed: $e');
    }
  }

  /// Manual check — called from settings "Check for Updates" button
  static Future<void> manualCheck(BuildContext context) async {
    // Show checking indicator
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        content: Row(children: [
          CircularProgressIndicator(color: Color(0xFF006699)),
          SizedBox(width: 20),
          Text('Checking for updates...'),
        ]),
      ),
    );

    try {
      final data = await Supabase.instance.client
          .from('app_config')
          .select()
          .eq('key', 'android_latest')
          .maybeSingle();

      if (!context.mounted) return;
      Navigator.pop(context); // close checking dialog

      if (data == null) {
        _showUpToDate(context);
        return;
      }

      final latestVersion = data['value'] as String? ?? _currentVersion;
      final apkUrl = data['metadata']?['apk_url'] as String? ?? '';
      final releaseNotes = data['metadata']?['release_notes'] as String? ?? '';
      final latestBuild = data['metadata']?['build_number'] as int? ?? 0;

      if (_compareSemver(latestVersion, _currentVersion) > 0 ||
          latestBuild > _currentBuildNumber) {
        if (!context.mounted) return;
        _showUpdateDialog(context,
          latestVersion: latestVersion,
          apkUrl: apkUrl,
          releaseNotes: releaseNotes,
          forceUpdate: false,
        );
      } else {
        if (!context.mounted) return;
        _showUpToDate(context);
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update check failed: $e'), backgroundColor: const Color(0xFFBA1A1A)),
        );
      }
    }
  }

  static void _showUpToDate(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: const Color(0xFF059669).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.check_circle, color: Color(0xFF059669), size: 24),
          ),
          const SizedBox(width: 12),
          const Text('Up to Date', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        ]),
        content: Text('You\'re running the latest version (v$_currentVersion).', style: const TextStyle(fontSize: 14, color: Color(0xFF374151))),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006699), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  static int _compareSemver(String a, String b) {
    final partsA = a.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final partsB = b.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    for (var i = 0; i < 3; i++) {
      final va = i < partsA.length ? partsA[i] : 0;
      final vb = i < partsB.length ? partsB[i] : 0;
      if (va != vb) return va - vb;
    }
    return 0;
  }

  static void _showUpdateDialog(
    BuildContext context, {
    required String latestVersion,
    required String apkUrl,
    required String releaseNotes,
    required bool forceUpdate,
  }) {
    showDialog(
      context: context,
      barrierDismissible: !forceUpdate,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: const Color(0xFF006699).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.system_update, color: Color(0xFF006699), size: 24),
          ),
          const SizedBox(width: 12),
          const Expanded(child: Text('Update Available', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
        ]),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Version $latestVersion is available.', style: const TextStyle(fontSize: 14, color: Color(0xFF374151))),
            if (releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text("What's new:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
              const SizedBox(height: 4),
              Text(releaseNotes, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
            ],
            const SizedBox(height: 8),
            Text('Current: v$_currentVersion', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          ],
        ),
        actions: [
          if (!forceUpdate)
            TextButton(onPressed: () async {
              // Remember user dismissed this version — don't show again today
              final prefs = await SharedPreferences.getInstance();
              await prefs.setString('update_skipped_version', latestVersion);
              if (ctx.mounted) Navigator.pop(ctx);
            }, child: const Text('Later', style: TextStyle(color: Color(0xFF6B7280)))),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              if (apkUrl.isNotEmpty) {
                _downloadAndInstall(context, apkUrl, latestVersion);
              }
            },
            icon: const Icon(Icons.download, size: 18),
            label: const Text('Download & Install'),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006699), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          ),
        ],
      ),
    );
  }

  /// Downloads APK with progress bar, then triggers install
  static Future<void> _downloadAndInstall(BuildContext context, String url, String version) async {
    final progressNotifier = ValueNotifier<double>(0);
    final statusNotifier = ValueNotifier<String>('Connecting...');
    bool cancelled = false;

    // Show download progress dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: false,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(children: [
            const Icon(Icons.downloading, color: Color(0xFF006699), size: 24),
            const SizedBox(width: 12),
            const Text('Downloading Update', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ]),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            ValueListenableBuilder<String>(
              valueListenable: statusNotifier,
              builder: (_, status, __) => Text(status, style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
            ),
            const SizedBox(height: 16),
            ValueListenableBuilder<double>(
              valueListenable: progressNotifier,
              builder: (_, progress, __) => Column(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: progress > 0 ? progress : null,
                    minHeight: 8,
                    backgroundColor: const Color(0xFFE5E7EB),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF006699)),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  progress > 0 ? '${(progress * 100).toStringAsFixed(0)}%' : 'Starting download...',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF006699)),
                ),
              ]),
            ),
          ]),
          actions: [
            TextButton(
              onPressed: () { cancelled = true; Navigator.pop(ctx); },
              child: const Text('Cancel', style: TextStyle(color: Color(0xFFBA1A1A))),
            ),
          ],
        ),
      ),
    );

    try {
      // Follow redirects manually (GitHub uses 302 → S3)
      String currentUrl = url;
      http.StreamedResponse? response;
      final client = http.Client();

      for (int i = 0; i < 5; i++) {
        final req = http.Request('GET', Uri.parse(currentUrl));
        req.followRedirects = false;
        response = await client.send(req);

        if (response.statusCode >= 300 && response.statusCode < 400) {
          final location = response.headers['location'];
          if (location == null) break;
          currentUrl = location.startsWith('http') ? location : Uri.parse(currentUrl).resolve(location).toString();
          await response.stream.drain();
          continue;
        }
        break;
      }

      if (response == null || response.statusCode != 200) {
        throw Exception('Download failed: HTTP ${response?.statusCode ?? 'unknown'}');
      }

      final totalBytes = response.contentLength ?? 0;
      int receivedBytes = 0;
      final chunks = <int>[];

      statusNotifier.value = 'Downloading v$version...';

      await for (final chunk in response.stream) {
        if (cancelled) return;
        chunks.addAll(chunk);
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          progressNotifier.value = receivedBytes / totalBytes;
        }
        statusNotifier.value = 'Downloading... ${(receivedBytes / 1024 / 1024).toStringAsFixed(1)} MB'
            '${totalBytes > 0 ? ' / ${(totalBytes / 1024 / 1024).toStringAsFixed(1)} MB' : ''}';
      }

      if (cancelled) return;

      // Verify download
      if (chunks.length < 1024 * 100) {
        throw Exception('Downloaded file is too small (${chunks.length} bytes) — likely an HTML error page');
      }

      // Verify APK signature (PK header = 0x504B0304)
      if (chunks.length < 4 ||
          chunks[0] != 0x50 || chunks[1] != 0x4B ||
          chunks[2] != 0x03 || chunks[3] != 0x04) {
        throw Exception('Downloaded file is not a valid APK');
      }

      statusNotifier.value = 'Saving...';
      progressNotifier.value = 1.0;

      // Save to public Downloads folder so installer can access it
      final downloadDir = Directory('/storage/emulated/0/Download');
      final dir = downloadDir.existsSync() ? downloadDir : await getTemporaryDirectory();

      final file = File('${dir.path}/FluxGen-v$version.apk');
      await file.writeAsBytes(chunks, flush: true);

      if (!context.mounted) return;
      Navigator.pop(context); // close progress dialog

      // Open APK with Android package installer
      final result = await OpenFilex.open(
        file.path,
        type: 'application/vnd.android.package-archive',
      );

      // If open_filex failed, show manual instructions
      if (result.type != ResultType.done && context.mounted) {
        _showManualInstallDialog(context, file.path);
      }

    } catch (e) {
      if (cancelled) return;
      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e'), backgroundColor: const Color(0xFFBA1A1A), duration: const Duration(seconds: 6)),
        );
      }
    }
  }

  static void _showManualInstallDialog(BuildContext context, String filePath) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.check_circle, color: Color(0xFF059669), size: 24),
          const SizedBox(width: 8),
          const Text('Download Complete', style: TextStyle(fontWeight: FontWeight.w700)),
        ]),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('APK downloaded successfully!', style: TextStyle(fontSize: 14, color: Color(0xFF374151))),
            const SizedBox(height: 12),
            const Text('To install:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
            const SizedBox(height: 4),
            const Text('1. Open your file manager\n2. Navigate to the Downloads folder\n3. Tap the APK file to install',
                style: TextStyle(fontSize: 13, color: Color(0xFF6B7280), height: 1.5)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(8)),
              child: Text(filePath, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)), maxLines: 3, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006699), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
