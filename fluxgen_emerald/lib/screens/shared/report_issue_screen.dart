import 'dart:io';
import 'package:flutter/material.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// User-facing issue report screen.
///
/// Auto-captures device info, app version, OS, and current user.
/// Stores reports in the `issue_reports` Supabase table.
/// Optionally attaches a screenshot uploaded to `issue-screenshots` bucket.
class ReportIssueScreen extends StatefulWidget {
  const ReportIssueScreen({super.key});

  @override
  State<ReportIssueScreen> createState() => _ReportIssueScreenState();
}

class _ReportIssueScreenState extends State<ReportIssueScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  static const _categories = ['Bug', 'Feature Request', 'Performance', 'UI Issue', 'Other'];
  String _selectedCategory = 'Bug';
  File? _screenshot;
  bool _isSubmitting = false;

  // Auto-captured info
  String _deviceModel = '';
  String _osVersion = '';
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    _captureDeviceInfo();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _captureDeviceInfo() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      final packageInfo = await PackageInfo.fromPlatform();

      if (Platform.isAndroid) {
        final android = await deviceInfo.androidInfo;
        _deviceModel = '${android.brand} ${android.model}';
        _osVersion = 'Android ${android.version.release} (SDK ${android.version.sdkInt})';
      } else if (Platform.isIOS) {
        final ios = await deviceInfo.iosInfo;
        _deviceModel = ios.utsname.machine;
        _osVersion = '${ios.systemName} ${ios.systemVersion}';
      }

      _appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _pickScreenshot() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Color(0xFF006699)),
                title: const Text('Camera'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Color(0xFF006699)),
                title: const Text('Gallery'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, maxWidth: 1280, imageQuality: 80);
    if (picked != null) {
      setState(() => _screenshot = File(picked.path));
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      String? screenshotUrl;

      // Upload screenshot if attached
      if (_screenshot != null) {
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final ext = _screenshot!.path.split('.').last;
        final path = '${user.id}/$timestamp.$ext';

        await Supabase.instance.client.storage
            .from('issue-screenshots')
            .upload(path, _screenshot!);

        screenshotUrl = Supabase.instance.client.storage
            .from('issue-screenshots')
            .getPublicUrl(path);
      }

      // Insert report
      await Supabase.instance.client.from('issue_reports').insert({
        'user_id': user.id,
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim(),
        'category': _selectedCategory,
        'screenshot_url': screenshotUrl,
        'device_model': _deviceModel,
        'os_version': _osVersion,
        'app_version': _appVersion,
        'status': 'open',
      });

      // Also send to Sentry as an event for correlation
      try {
        await Sentry.captureMessage(
          'User Report [$_selectedCategory]: ${_titleController.text.trim()}',
          level: SentryLevel.info,
          withScope: (scope) {
            scope.setTag('report_category', _selectedCategory);
            // ignore: deprecated_member_use
            scope.setExtra('description', _descriptionController.text.trim());
            // ignore: deprecated_member_use
            scope.setExtra('device_model', _deviceModel);
            // ignore: deprecated_member_use
            scope.setExtra('app_version', _appVersion);
          },
        );
      } catch (_) {
        // Sentry event is best-effort
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Issue report submitted. Thank you!'),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );

      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text('Report an Issue',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF006699).withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Color(0xFF006699), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Device info and app version are captured automatically to help us diagnose the issue faster.',
                        style: TextStyle(fontSize: 12, color: const Color(0xFF006699).withValues(alpha: 0.8)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Category
              const Text('Category', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF444653))),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: _categories.take(3).map((cat) {
                    final selected = _selectedCategory == cat;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedCategory = cat),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: selected ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: selected
                                ? [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))]
                                : null,
                          ),
                          child: Text(cat, textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                                  color: selected ? const Color(0xFF006699) : const Color(0xFF9CA3AF))),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 4),
              // Second row for remaining categories
              Container(
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: _categories.skip(3).map((cat) {
                    final selected = _selectedCategory == cat;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedCategory = cat),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: selected ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: selected
                                ? [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))]
                                : null,
                          ),
                          child: Text(cat, textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                                  color: selected ? const Color(0xFF006699) : const Color(0xFF9CA3AF))),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 20),

              // Title
              const Text('Title', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF444653))),
              const SizedBox(height: 8),
              TextFormField(
                controller: _titleController,
                textCapitalization: TextCapitalization.sentences,
                decoration: _inputDecoration(hint: 'Brief summary of the issue', icon: Icons.title),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 20),

              // Description
              const Text('Description', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF444653))),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descriptionController,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: _inputDecoration(hint: 'What happened? What did you expect to happen?', icon: Icons.description_outlined),
                validator: (v) => (v == null || v.trim().length < 10) ? 'Please provide more detail (at least 10 characters)' : null,
              ),
              const SizedBox(height: 20),

              // Screenshot
              const Text('Screenshot (optional)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF444653))),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickScreenshot,
                child: Container(
                  height: _screenshot != null ? 200 : 80,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1.5, style: BorderStyle.solid),
                  ),
                  child: _screenshot != null
                      ? Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(_screenshot!, width: double.infinity, height: 200, fit: BoxFit.cover),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: GestureDetector(
                                onTap: () => setState(() => _screenshot = null),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                                  child: const Icon(Icons.close, size: 16, color: Colors.white),
                                ),
                              ),
                            ),
                          ],
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_a_photo_outlined, size: 28, color: Color(0xFF9CA3AF)),
                            SizedBox(height: 6),
                            Text('Tap to add screenshot', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 20),

              // Auto-captured info card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('AUTO-CAPTURED INFO',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
                    const SizedBox(height: 10),
                    _infoRow(Icons.phone_android, 'Device', _deviceModel.isEmpty ? 'Loading...' : _deviceModel),
                    _infoRow(Icons.android, 'OS', _osVersion.isEmpty ? 'Loading...' : _osVersion),
                    _infoRow(Icons.info_outline, 'App Version', _appVersion.isEmpty ? 'Loading...' : _appVersion),
                    _infoRow(Icons.person_outline, 'User',
                        Supabase.instance.client.auth.currentUser?.email ?? 'Unknown'),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Submit
              SizedBox(
                width: double.infinity,
                height: 52,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF006699), Color(0xFF1E40AF)]),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [BoxShadow(color: const Color(0xFF006699).withValues(alpha: 0.25), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submit,
                    icon: _isSubmitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send, size: 20),
                    label: Text(_isSubmitting ? 'Submitting...' : 'Submit Report',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF9CA3AF)),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12, color: Color(0xFF444653)), overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({required String hint, required IconData icon}) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20, color: const Color(0xFF9CA3AF)),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF006699), width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFBA1A1A), width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}
