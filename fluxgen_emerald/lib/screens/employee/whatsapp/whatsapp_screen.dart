import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:emerald/services/whatsapp_service.dart';
import 'package:emerald/widgets/notification_bell.dart';

/// Full WhatsApp integration screen.
///
/// Sections:
///  1. Setup  — save / change phone number (persisted locally + Supabase)
///  2. Notifications toggle
///  3. Send Summary — period picker + send to own WhatsApp
///  4. Share via WhatsApp Web — opens wa.me link
class WhatsAppScreen extends StatefulWidget {
  const WhatsAppScreen({super.key});

  @override
  State<WhatsAppScreen> createState() => _WhatsAppScreenState();
}

class _WhatsAppScreenState extends State<WhatsAppScreen> {
  // ── Constants ────────────────────────────────────────────────────────────
  static const _primary = Color(0xFF006699);
  static const _whatsAppGreen = Color(0xFF25D366);
  static const _bg = Color(0xFFF3F4F6);
  static const _dark = Color(0xFF191C1E);
  static const _muted = Color(0xFF9CA3AF);
  static const _errorRed = Color(0xFFBA1A1A);
  static const _successGreen = Color(0xFF059669);

  static const _prefKeyPhone = 'whatsapp_phone';
  static const _prefKeyNotif = 'whatsapp_notifications';

  // ── Services ─────────────────────────────────────────────────────────────
  final _whatsAppService = WhatsAppService();
  final _supabase = Supabase.instance.client;

  // ── Controllers ──────────────────────────────────────────────────────────
  final _phoneController = TextEditingController();

  // ── State ────────────────────────────────────────────────────────────────
  bool _isLoading = true;
  bool _isSendingSummary = false;

  String _savedPhone = '';
  bool _isEditing = false; // true when user taps "Change"
  bool _notificationsEnabled = false;

  // Period picker
  int _selectedPeriodIndex = 0; // 0 = This Month, 1 = Last Month, 2 = Custom
  DateTime? _customFrom;
  DateTime? _customTo;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  Future<void> _loadAll() async {
    setState(() => _isLoading = true);
    await Future.wait([_loadSettings(), _loadProfile()]);
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final phone = prefs.getString(_prefKeyPhone) ?? '';
    final notif = prefs.getBool(_prefKeyNotif) ?? false;

    // Also try loading from Supabase profile
    final user = _supabase.auth.currentUser;
    if (user != null) {
      try {
        final profile = await _supabase
            .from('profiles')
            .select('whatsapp_number, whatsapp_notifications_enabled')
            .eq('id', user.id)
            .maybeSingle();

        if (profile != null) {
          final dbPhone =
              (profile['whatsapp_number'] as String?) ?? '';
          final dbNotif =
              (profile['whatsapp_notifications_enabled'] as bool?) ?? false;

          // Prefer Supabase values if present
          if (dbPhone.isNotEmpty) {
            _savedPhone = dbPhone;
            _notificationsEnabled = dbNotif;
            // Sync back to prefs
            await prefs.setString(_prefKeyPhone, dbPhone);
            await prefs.setBool(_prefKeyNotif, dbNotif);
            return;
          }
        }
      } catch (_) {
        // Columns may not exist yet — fall back to SharedPreferences
      }
    }

    _savedPhone = phone;
    _notificationsEnabled = notif;
  }

  Future<void> _loadProfile() async {}

  // ── Save Phone Number ────────────────────────────────────────────────────

  Future<void> _savePhoneNumber() async {
    final raw = _phoneController.text.trim();
    if (raw.isEmpty) {
      _showSnack('Please enter a phone number', isError: true);
      return;
    }

    // Validate: must be 10 digits
    final digits = raw.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.length != 10) {
      _showSnack('Enter a valid 10-digit phone number', isError: true);
      return;
    }

    final fullNumber = '91$digits'; // prepend India code

    // Persist locally
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKeyPhone, fullNumber);

    // Persist to Supabase
    final user = _supabase.auth.currentUser;
    if (user != null) {
      try {
        await _supabase.from('profiles').update({
          'whatsapp_number': fullNumber,
        }).eq('id', user.id);
      } catch (_) {
        // Column may not exist — local persistence is the fallback
      }
    }

    setState(() {
      _savedPhone = fullNumber;
      _isEditing = false;
      _phoneController.clear();
    });

    _showSnack('WhatsApp number saved');
  }

  // ── Toggle Notifications ─────────────────────────────────────────────────

  Future<void> _toggleNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKeyNotif, value);

    final user = _supabase.auth.currentUser;
    if (user != null) {
      try {
        await _supabase.from('profiles').update({
          'whatsapp_notifications_enabled': value,
        }).eq('id', user.id);
      } catch (_) {
        // Column may not exist — local persistence is the fallback
      }
    }
  }

  // ── Fetch Expenses by Period ─────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> _fetchExpensesForPeriod() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    DateTime from;
    DateTime to;
    final now = DateTime.now();

    switch (_selectedPeriodIndex) {
      case 0: // This Month
        from = DateTime(now.year, now.month, 1);
        to = now;
        break;
      case 1: // Last Month
        final lastMonth = DateTime(now.year, now.month - 1, 1);
        from = lastMonth;
        to = DateTime(now.year, now.month, 0); // last day of prev month
        break;
      case 2: // Custom
        if (_customFrom == null || _customTo == null) {
          _showSnack('Please select a date range', isError: true);
          return [];
        }
        from = _customFrom!;
        to = _customTo!;
        break;
      default:
        from = DateTime(now.year, now.month, 1);
        to = now;
    }

    final fromStr = DateFormat('yyyy-MM-dd').format(from);
    final toStr = DateFormat('yyyy-MM-dd').format(to);

    try {
      final data = await _supabase
          .from('expenses')
          .select('date, category, vendor, description, amount')
          .eq('user_id', user.id)
          .gte('date', fromStr)
          .lte('date', toStr)
          .order('date', ascending: false)
          .limit(200);

      return (data as List<dynamic>)
          .map((e) => e as Map<String, dynamic>)
          .toList();
    } catch (e) {
      debugPrint('Fetch expenses error: $e');
      return [];
    }
  }

  // ── Send Summary to Own WhatsApp ─────────────────────────────────────────

  Future<void> _sendSummary() async {
    if (_savedPhone.isEmpty) {
      _showSnack('Please save your WhatsApp number first', isError: true);
      return;
    }

    setState(() => _isSendingSummary = true);

    try {
      final expenses = await _fetchExpensesForPeriod();
      if (expenses.isEmpty) {
        _showSnack('No expenses found for this period', isError: true);
        return;
      }

      final periodLabel = _getPeriodLabel();
      final message =
          _buildSummaryText(expenses, periodLabel);

      await _whatsAppService.sendExpenseSummary(
        phoneNumber: _savedPhone,
        message: message,
      );
    } catch (e) {
      _showSnack('Failed to open WhatsApp: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSendingSummary = false);
    }
  }

  // ── Share via WhatsApp Web ───────────────────────────────────────────────

  Future<void> _shareViaWhatsApp() async {
    setState(() => _isSendingSummary = true);

    try {
      final expenses = await _fetchExpensesForPeriod();
      if (expenses.isEmpty) {
        _showSnack('No expenses found for this period', isError: true);
        return;
      }

      final periodLabel = _getPeriodLabel();
      final message = _buildSummaryText(expenses, periodLabel);

      // Open wa.me with no specific phone → user picks contact
      final encoded = Uri.encodeComponent(message);
      final url = Uri.parse('https://wa.me/?text=$encoded');

      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        _showSnack('Could not open WhatsApp', isError: true);
      }
    } catch (e) {
      _showSnack('Share failed: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSendingSummary = false);
    }
  }

  // ── Summary Text Builder (matches web format) ────────────────────────────

  String _buildSummaryText(
      List<Map<String, dynamic>> expenses, String period) {
    final buf = StringBuffer();

    buf.writeln('*Expense Summary - $period*');
    buf.writeln();

    final total =
        expenses.fold<double>(0, (s, e) => s + ((e['amount'] as num?)?.toDouble() ?? 0));

    final byCategory = <String, double>{};
    for (final e in expenses) {
      final cat = (e['category'] as String?) ?? 'Other';
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      byCategory[cat] = (byCategory[cat] ?? 0) + amt;
    }

    buf.writeln('*Total: Rs. ${total.toStringAsFixed(2)}*');
    buf.writeln('Expenses: ${expenses.length}');
    buf.writeln();
    buf.writeln('*By Category:*');

    final sorted = byCategory.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    for (final entry in sorted) {
      buf.writeln('  - ${entry.key}: Rs. ${entry.value.toStringAsFixed(2)}');
    }

    buf.writeln();
    buf.writeln('_Sent from FluxGen Expense Tracker_');

    return buf.toString();
  }

  String _getPeriodLabel() {
    final now = DateTime.now();
    final fmt = DateFormat('MMM yyyy');
    switch (_selectedPeriodIndex) {
      case 0:
        return fmt.format(now);
      case 1:
        return fmt.format(DateTime(now.year, now.month - 1));
      case 2:
        if (_customFrom != null && _customTo != null) {
          final df = DateFormat('dd MMM');
          return '${df.format(_customFrom!)} - ${df.format(_customTo!)}';
        }
        return 'Custom';
      default:
        return 'This Month';
    }
  }

  // ── Date Pickers ─────────────────────────────────────────────────────────

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      initialDateRange: _customFrom != null && _customTo != null
          ? DateTimeRange(start: _customFrom!, end: _customTo!)
          : DateTimeRange(
              start: DateTime(now.year, now.month, 1), end: now),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: _primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: _dark,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _customFrom = picked.start;
        _customTo = picked.end;
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? _errorRed : _successGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }

  String _formatSavedPhone() {
    if (_savedPhone.isEmpty) return '';
    // Format: +91 98765 43210
    final digits = _savedPhone.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.length >= 12) {
      final cc = digits.substring(0, 2);
      final p1 = digits.substring(2, 7);
      final p2 = digits.substring(7);
      return '+$cc $p1 $p2';
    }
    return '+$_savedPhone';
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'WhatsApp',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: _dark,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _dark),
          onPressed: () => Navigator.pop(context),
        ),
        actions: const [NotificationBell()],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: _primary),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildSetupCard(),
                const SizedBox(height: 14),
                _buildNotificationsCard(),
                const SizedBox(height: 14),
                _buildSendSummaryCard(),
                const SizedBox(height: 14),
                _buildShareCard(),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  // ── 1. Setup Card ────────────────────────────────────────────────────────

  Widget _buildSetupCard() {
    final hasPhone = _savedPhone.isNotEmpty;
    final showInput = !hasPhone || _isEditing;

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _whatsAppGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.phone_android,
                    color: _whatsAppGreen, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'WhatsApp Number',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _dark,
                  ),
                ),
              ),
              if (hasPhone && !_isEditing)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _successGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Connected',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _successGreen,
                    ),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 14),

          if (hasPhone && !_isEditing) ...[
            // Show saved number
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: _bg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle,
                      color: _whatsAppGreen, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    _formatSavedPhone(),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _dark,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () {
                      // Pre-fill with existing 10-digit number
                      final digits =
                          _savedPhone.replaceAll(RegExp(r'[^\d]'), '');
                      _phoneController.text =
                          digits.length > 2 ? digits.substring(2) : digits;
                      setState(() => _isEditing = true);
                    },
                    child: const Text(
                      'Change',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (showInput) ...[
            // Phone input
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    color: _bg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text(
                    '+91',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    maxLength: 10,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Enter 10-digit number',
                      hintStyle: const TextStyle(
                        color: _muted,
                        fontWeight: FontWeight.w400,
                      ),
                      counterText: '',
                      filled: true,
                      fillColor: _bg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: ElevatedButton(
                      onPressed: _savePhoneNumber,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _whatsAppGreen,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Save Number',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
                if (_isEditing) ...[
                  const SizedBox(width: 10),
                  SizedBox(
                    height: 44,
                    child: TextButton(
                      onPressed: () =>
                          setState(() => _isEditing = false),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          color: _muted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ── 2. Notifications Toggle Card ─────────────────────────────────────────

  Widget _buildNotificationsCard() {
    return _Card(
      child: SwitchListTile(
        contentPadding: EdgeInsets.zero,
        secondary: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.notifications_active,
              color: Color(0xFF8B5CF6), size: 20),
        ),
        title: const Text(
          'WhatsApp Notifications',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: _dark,
          ),
        ),
        subtitle: const Text(
          'Get voucher & advance updates on WhatsApp',
          style: TextStyle(fontSize: 12, color: _muted),
        ),
        value: _notificationsEnabled,
        onChanged: _toggleNotifications,
        activeColor: _whatsAppGreen,
      ),
    );
  }

  // ── 3. Send Summary Card ─────────────────────────────────────────────────

  Widget _buildSendSummaryCard() {
    final periods = ['This Month', 'Last Month', 'Custom'];

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    const Icon(Icons.summarize, color: _primary, size: 20),
              ),
              const SizedBox(width: 12),
              const Text(
                'Send Summary',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: _dark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Period picker chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(periods.length, (i) {
              final selected = _selectedPeriodIndex == i;
              return ChoiceChip(
                label: Text(periods[i]),
                selected: selected,
                selectedColor: _primary.withValues(alpha: 0.15),
                backgroundColor: _bg,
                labelStyle: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? _primary : _muted,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: selected ? _primary : Colors.transparent,
                    width: 1.2,
                  ),
                ),
                showCheckmark: false,
                onSelected: (sel) {
                  setState(() => _selectedPeriodIndex = i);
                  if (i == 2) _pickDateRange();
                },
              );
            }),
          ),

          // Show custom range if selected
          if (_selectedPeriodIndex == 2 &&
              _customFrom != null &&
              _customTo != null) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _pickDateRange,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _bg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.calendar_today,
                        size: 14, color: _primary),
                    const SizedBox(width: 8),
                    Text(
                      '${DateFormat('dd MMM yyyy').format(_customFrom!)} - ${DateFormat('dd MMM yyyy').format(_customTo!)}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: _dark,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.edit, size: 12, color: _muted),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Send button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed:
                  _isSendingSummary || _savedPhone.isEmpty
                      ? null
                      : _sendSummary,
              icon: _isSendingSummary
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send, size: 18),
              label: Text(
                _isSendingSummary
                    ? 'Sending...'
                    : _savedPhone.isEmpty
                        ? 'Save number first'
                        : 'Send to My WhatsApp',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _whatsAppGreen,
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    _whatsAppGreen.withValues(alpha: 0.4),
                disabledForegroundColor: Colors.white70,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── 4. Share Card ────────────────────────────────────────────────────────

  Widget _buildShareCard() {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _whatsAppGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    const Icon(Icons.share, color: _whatsAppGreen, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Share via WhatsApp',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _dark,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Share summary with anyone — no setup needed',
                      style: TextStyle(fontSize: 12, color: _muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _isSendingSummary ? null : _shareViaWhatsApp,
              icon: _isSendingSummary
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _whatsAppGreen,
                      ),
                    )
                  : const Icon(Icons.open_in_new, size: 18),
              label: const Text(
                'Share Expense Summary',
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: _whatsAppGreen,
                side: const BorderSide(
                    color: _whatsAppGreen, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reusable Card Widget ─────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
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
      child: child,
    );
  }
}
