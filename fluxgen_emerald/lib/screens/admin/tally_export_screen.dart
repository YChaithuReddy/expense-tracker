import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tally Export screen — generates Tally-compatible XML for voucher import.
///
/// Workflow:
///   1. Select date range (From / To)
///   2. Fetch approved/reimbursed vouchers in that range
///   3. Select individual vouchers via checkboxes or Select All
///   4. Preview the generated XML or share it via Share.share()
///
/// XML format follows the standard Tally voucher import schema with
/// VOUCHER tags containing debit (employee expense) and credit (payment ledger)
/// entries.
class TallyExportScreen extends StatefulWidget {
  const TallyExportScreen({super.key});

  @override
  State<TallyExportScreen> createState() => _TallyExportScreenState();
}

class _TallyExportScreenState extends State<TallyExportScreen> {
  DateTime? _dateFrom;
  DateTime? _dateTo;
  bool _loading = false;

  // ── Tally settings (persisted in SharedPreferences) ───────────────────
  String _paymentLedger = 'Cash in Hand';
  String _companyName = 'FluxGen Technologies Pvt Ltd';
  String _voucherType = 'Payment';
  String _gstin = '';
  String _narrationPrefix = '';
  bool _includeReimbursed = true; // when false → only 'approved'

  List<_VoucherRow> _vouchers = [];
  final Set<String> _selectedIds = {};

  @override
  void initState() {
    super.initState();
    _loadSettings();
    // Default: last 30 days
    _dateTo = DateTime.now();
    _dateFrom = DateTime.now().subtract(const Duration(days: 30));
    _fetchVouchers();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final ledger = prefs.getString('tally_payment_ledger');
    final company = prefs.getString('tally_company_name');
    final vType = prefs.getString('tally_voucher_type');
    final gst = prefs.getString('tally_gstin');
    final narration = prefs.getString('tally_narration_prefix');
    final incReim = prefs.getBool('tally_include_reimbursed');
    if (!mounted) return;
    setState(() {
      if (ledger != null && ledger.isNotEmpty) _paymentLedger = ledger;
      if (company != null && company.isNotEmpty) _companyName = company;
      if (vType != null && vType.isNotEmpty) _voucherType = vType;
      if (gst != null) _gstin = gst;
      if (narration != null) _narrationPrefix = narration;
      if (incReim != null) _includeReimbursed = incReim;
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tally_payment_ledger', _paymentLedger);
    await prefs.setString('tally_company_name', _companyName);
    await prefs.setString('tally_voucher_type', _voucherType);
    await prefs.setString('tally_gstin', _gstin);
    await prefs.setString('tally_narration_prefix', _narrationPrefix);
    await prefs.setBool('tally_include_reimbursed', _includeReimbursed);
  }

  // ── Data ──────────────────────────────────────────────────────────────

  Future<void> _fetchVouchers() async {
    if (_dateFrom == null || _dateTo == null) return;
    setState(() => _loading = true);

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      // Get org id from profile
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;
      if (orgId == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      final fromStr =
          DateFormat('yyyy-MM-dd').format(_dateFrom!);
      final toStr =
          DateFormat('yyyy-MM-dd').format(_dateTo!);

      final statusFilter =
          _includeReimbursed ? ['approved', 'reimbursed'] : ['approved'];
      final data = await Supabase.instance.client
          .from('vouchers')
          .select(
              'id, voucher_number, total_amount, submitted_at, purpose, status, submitter:submitted_by(name, email)')
          .eq('organization_id', orgId)
          .inFilter('status', statusFilter)
          .gte('submitted_at', '${fromStr}T00:00:00')
          .lte('submitted_at', '${toStr}T23:59:59')
          .order('submitted_at', ascending: false);

      final rows = (data as List<dynamic>).map((row) {
        final r = row as Map<String, dynamic>;
        final submitter = r['submitter'];
        String empName = 'Unknown';
        if (submitter is Map<String, dynamic>) {
          empName =
              submitter['name'] as String? ?? submitter['email'] as String? ?? 'Unknown';
        }
        return _VoucherRow(
          id: r['id'] as String,
          voucherNumber: r['voucher_number'] as String? ?? '',
          amount: (r['total_amount'] as num?)?.toDouble() ?? 0,
          employeeName: empName,
          purpose: r['purpose'] as String? ?? '',
          status: r['status'] as String? ?? '',
          date: r['submitted_at'] != null
              ? DateTime.tryParse(r['submitted_at'] as String)
              : null,
        );
      }).toList();

      if (mounted) {
        setState(() {
          _vouchers = rows;
          _selectedIds.clear();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load vouchers: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────

  bool get _allSelected =>
      _vouchers.isNotEmpty && _selectedIds.length == _vouchers.length;

  void _toggleSelectAll() {
    setState(() {
      if (_allSelected) {
        _selectedIds.clear();
      } else {
        _selectedIds.addAll(_vouchers.map((v) => v.id));
      }
    });
  }

  void _toggleSelect(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  // ── XML Generation ────────────────────────────────────────────────────

  /// Escapes special XML characters in a string.
  String _xmlEscape(String str) {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
  }

  /// Generates Tally-compatible XML matching the web app's tally-export.js format.
  ///
  /// Structure:
  /// - ENVELOPE > HEADER (VERSION, TALLYREQUEST, TYPE, ID)
  /// - ENVELOPE > BODY > DESC > STATICVARIABLES > SVCURRENTCOMPANY
  /// - ENVELOPE > BODY > DATA > TALLYMESSAGE > VOUCHER (one per selected voucher)
  /// - Each VOUCHER has ALLLEDGERENTRIES.LIST for debit (negative) and credit (positive)
  /// - PARTYLEDGERNAME, EFFECTIVEDATE, ISCANCELLED, ISOPTIONAL per voucher
  String _generateXml() {
    final selected =
        _vouchers.where((v) => _selectedIds.contains(v.id)).toList();
    if (selected.isEmpty) return '';

    final dateFmt = DateFormat('yyyyMMdd');
    final company = _companyName;
    final buffer = StringBuffer();

    buffer.writeln('<?xml version="1.0" encoding="UTF-8"?>');
    buffer.writeln('<ENVELOPE>');
    buffer.writeln('    <HEADER>');
    buffer.writeln('        <VERSION>1</VERSION>');
    buffer.writeln('        <TALLYREQUEST>Import</TALLYREQUEST>');
    buffer.writeln('        <TYPE>Data</TYPE>');
    buffer.writeln('        <ID>Vouchers</ID>');
    buffer.writeln('    </HEADER>');
    buffer.writeln('    <BODY>');
    buffer.writeln('        <DESC>');
    buffer.writeln('            <STATICVARIABLES>');
    buffer.writeln(
        '                <SVCURRENTCOMPANY>${_xmlEscape(company)}</SVCURRENTCOMPANY>');
    if (_gstin.trim().isNotEmpty) {
      buffer.writeln(
          '                <SVGSTIN>${_xmlEscape(_gstin.trim())}</SVGSTIN>');
    }
    buffer.writeln('            </STATICVARIABLES>');
    buffer.writeln('        </DESC>');
    buffer.writeln('        <DATA>');
    buffer.writeln('            <TALLYMESSAGE>');

    for (final v in selected) {
      final dateStr = v.date != null
          ? dateFmt.format(v.date!)
          : dateFmt.format(DateTime.now());
      final voucherNum = _xmlEscape(v.voucherNumber);
      final employeeName = _xmlEscape(v.employeeName);
      final purpose = v.purpose.isNotEmpty
          ? _xmlEscape(v.purpose)
          : 'Expense Reimbursement';
      final prefix = _narrationPrefix.trim().isNotEmpty
          ? '${_xmlEscape(_narrationPrefix.trim())} | '
          : '';
      final narration = '$prefix$voucherNum | $employeeName | $purpose';
      final amountStr = v.amount.toStringAsFixed(2);
      final expenseLedger = '$employeeName - Expenses';

      buffer.writeln('');
      buffer.writeln('        <VOUCHER>');
      buffer.writeln('            <DATE>$dateStr</DATE>');
      buffer.writeln(
          '            <NARRATION>$narration</NARRATION>');
      buffer.writeln(
          '            <VOUCHERTYPENAME>${_xmlEscape(_voucherType)}</VOUCHERTYPENAME>');
      buffer.writeln(
          '            <VOUCHERNUMBER>$voucherNum</VOUCHERNUMBER>');
      buffer.writeln(
          '            <PARTYLEDGERNAME>$employeeName</PARTYLEDGERNAME>');
      buffer.writeln(
          '            <EFFECTIVEDATE>$dateStr</EFFECTIVEDATE>');
      buffer.writeln('            <ISCANCELLED>No</ISCANCELLED>');
      buffer.writeln('            <ISOPTIONAL>No</ISOPTIONAL>');

      // Debit: employee expense ledger (negative amount in Tally)
      buffer.writeln('            <ALLLEDGERENTRIES.LIST>');
      buffer.writeln(
          '                <LEDGERNAME>${_xmlEscape(expenseLedger)}</LEDGERNAME>');
      buffer.writeln(
          '                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
      buffer.writeln('                <AMOUNT>-$amountStr</AMOUNT>');
      buffer.writeln('            </ALLLEDGERENTRIES.LIST>');

      // Credit: payment ledger (positive amount in Tally)
      buffer.writeln('            <ALLLEDGERENTRIES.LIST>');
      buffer.writeln(
          '                <LEDGERNAME>${_xmlEscape(_paymentLedger)}</LEDGERNAME>');
      buffer.writeln(
          '                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
      buffer.writeln('                <AMOUNT>$amountStr</AMOUNT>');
      buffer.writeln('            </ALLLEDGERENTRIES.LIST>');

      buffer.writeln('        </VOUCHER>');
    }

    buffer.writeln('');
    buffer.writeln('            </TALLYMESSAGE>');
    buffer.writeln('        </DATA>');
    buffer.writeln('    </BODY>');
    buffer.writeln('</ENVELOPE>');

    return buffer.toString();
  }

  /// Writes [xml] to a temp `.xml` file and returns the XFile handle.
  /// Sharing a file instead of a string lets Tally import it directly — a
  /// raw-text Share.share payload would arrive as a chat message body.
  Future<XFile> _writeXmlFile(String xml) async {
    final dir = await getTemporaryDirectory();
    final ts = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final path = '${dir.path}/tally_export_$ts.xml';
    final file = File(path);
    await file.writeAsString(xml);
    return XFile(path, mimeType: 'application/xml', name: 'tally_export_$ts.xml');
  }

  void _showPreview() {
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select at least one voucher'),
          backgroundColor: Color(0xFFF59E0B),
        ),
      );
      return;
    }

    final xml = _generateXml();
    final size = MediaQuery.of(context).size;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        insetPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF006699),
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.code, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'XML Preview · ${_selectedIds.length} voucher'
                      '${_selectedIds.length == 1 ? '' : 's'}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(ctx),
                    child: const Icon(Icons.close,
                        color: Colors.white, size: 20),
                  ),
                ],
              ),
            ),
            // Content
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: size.height * 0.55),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(12),
                child: SelectableText(
                  xml,
                  style: const TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: Color(0xFF374151),
                    height: 1.5,
                  ),
                ),
              ),
            ),
            // Actions
            Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFE5E7EB), width: 1),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: xml));
                        if (!ctx.mounted) return;
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text('XML copied to clipboard'),
                            backgroundColor: Color(0xFF059669),
                          ),
                        );
                      },
                      icon: const Icon(Icons.copy_rounded, size: 16),
                      label: const Text('Copy'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF006699),
                        side: const BorderSide(color: Color(0xFF006699)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _exportXml();
                      },
                      icon: const Icon(Icons.download_rounded, size: 16),
                      label: const Text('Download .xml'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF006699),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportXml() async {
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select at least one voucher'),
          backgroundColor: Color(0xFFF59E0B),
        ),
      );
      return;
    }

    try {
      final xml = _generateXml();
      final file = await _writeXmlFile(xml);
      await Share.shareXFiles(
        [file],
        subject:
            'Tally Export — ${_selectedIds.length} voucher(s) · $_companyName',
        text:
            'Tally voucher import XML. Open in Tally via Gateway → Import Data → Vouchers.',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Export failed: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  // ── Date Picker ───────────────────────────────────────────────────────

  Future<void> _pickDate(bool isFrom) async {
    final initial = isFrom ? _dateFrom : _dateTo;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _dateFrom = picked;
        } else {
          _dateTo = picked;
        }
      });
      _fetchVouchers();
    }
  }

  // ── Settings sheet ────────────────────────────────────────────────────

  Future<void> _openSettingsSheet() async {
    final ledgerCtrl = TextEditingController(text: _paymentLedger);
    final companyCtrl = TextEditingController(text: _companyName);
    final voucherTypeCtrl = TextEditingController(text: _voucherType);
    final gstCtrl = TextEditingController(text: _gstin);
    final narrationCtrl = TextEditingController(text: _narrationPrefix);
    bool includeReim = _includeReimbursed;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (innerCtx, setSheet) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(innerCtx).viewInsets.bottom,
              ),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE5E7EB),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      Row(children: [
                        const Icon(Icons.tune_rounded,
                            color: Color(0xFF006699)),
                        const SizedBox(width: 8),
                        const Text(
                          'Tally Export Settings',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF191C1E),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 16),
                      _settingsField(
                        icon: Icons.business_rounded,
                        label: 'Company Name',
                        controller: companyCtrl,
                        hint: 'e.g. FluxGen Technologies Pvt Ltd',
                      ),
                      const SizedBox(height: 12),
                      _settingsField(
                        icon: Icons.receipt_long_rounded,
                        label: 'Voucher Type',
                        controller: voucherTypeCtrl,
                        hint: 'Payment / Journal / Receipt',
                      ),
                      const SizedBox(height: 12),
                      _settingsField(
                        icon: Icons.account_balance_wallet_rounded,
                        label: 'Payment Ledger',
                        controller: ledgerCtrl,
                        hint: 'e.g. Cash in Hand, HDFC Bank',
                      ),
                      const SizedBox(height: 12),
                      _settingsField(
                        icon: Icons.badge_rounded,
                        label: 'GSTIN (optional)',
                        controller: gstCtrl,
                        hint: '29AAAAA0000A1Z5',
                      ),
                      const SizedBox(height: 12),
                      _settingsField(
                        icon: Icons.short_text_rounded,
                        label: 'Narration Prefix (optional)',
                        controller: narrationCtrl,
                        hint: 'e.g. REIMB-2026',
                      ),
                      const SizedBox(height: 14),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: includeReim,
                        onChanged: (v) => setSheet(() => includeReim = v),
                        title: const Text(
                          'Include reimbursed vouchers',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF191C1E),
                          ),
                        ),
                        subtitle: const Text(
                          'When off, only status = approved is exported.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        activeColor: const Color(0xFF006699),
                      ),
                      const SizedBox(height: 14),
                      Row(children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(sheetCtx),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF6B7280),
                              side: const BorderSide(color: Color(0xFFE5E7EB)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () async {
                              setState(() {
                                _paymentLedger =
                                    ledgerCtrl.text.trim().isEmpty
                                        ? 'Cash in Hand'
                                        : ledgerCtrl.text.trim();
                                _companyName =
                                    companyCtrl.text.trim().isEmpty
                                        ? 'FluxGen Technologies Pvt Ltd'
                                        : companyCtrl.text.trim();
                                _voucherType =
                                    voucherTypeCtrl.text.trim().isEmpty
                                        ? 'Payment'
                                        : voucherTypeCtrl.text.trim();
                                _gstin = gstCtrl.text.trim();
                                _narrationPrefix = narrationCtrl.text.trim();
                                final refresh =
                                    _includeReimbursed != includeReim;
                                _includeReimbursed = includeReim;
                                if (refresh) _fetchVouchers();
                              });
                              await _saveSettings();
                              if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF006699),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text(
                              'Save',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ]),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _settingsField({
    required IconData icon,
    required String label,
    required TextEditingController controller,
    required String hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 14, color: const Color(0xFF6B7280)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: Color(0xFF6B7280),
            ),
          ),
        ]),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: const Color(0xFFF3F4F6),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd MMM yyyy');

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: Colors.white.withValues(alpha: 0.95),
            surfaceTintColor: Colors.transparent,
            title: const Text(
              'Tally Export',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF191C1E),
              ),
            ),
            actions: [
              IconButton(
                tooltip: 'Tally settings',
                icon: const Icon(Icons.tune_rounded,
                    color: Color(0xFF006699)),
                onPressed: _openSettingsSheet,
              ),
              const SizedBox(width: 4),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Date Range ──────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _pickDate(true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.calendar_today,
                                    size: 14, color: Color(0xFF9CA3AF)),
                                const SizedBox(width: 6),
                                Text(
                                  _dateFrom != null
                                      ? dateFmt.format(_dateFrom!)
                                      : 'From',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: _dateFrom != null
                                        ? const Color(0xFF191C1E)
                                        : const Color(0xFF9CA3AF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Icon(Icons.arrow_forward,
                            size: 16, color: Color(0xFF9CA3AF)),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _pickDate(false),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.calendar_today,
                                    size: 14, color: Color(0xFF9CA3AF)),
                                const SizedBox(width: 6),
                                Text(
                                  _dateTo != null
                                      ? dateFmt.format(_dateTo!)
                                      : 'To',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: _dateTo != null
                                        ? const Color(0xFF191C1E)
                                        : const Color(0xFF9CA3AF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Payment Ledger Info ─────────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006699).withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          size: 16, color: Color(0xFF006699)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Credit Ledger: $_paymentLedger',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF006699),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Loading / Voucher List ──────────────────────
                if (_loading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator(
                        color: Color(0xFF006699),
                      ),
                    ),
                  )
                else if (_vouchers.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(40),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.receipt_long_outlined,
                            size: 48, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Text(
                          'No approved vouchers',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Adjust the date range or check voucher statuses',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF9CA3AF),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                else ...[
                  // Select All row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_vouchers.length} VOUCHER${_vouchers.length == 1 ? '' : 'S'} FOUND',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                      GestureDetector(
                        onTap: _toggleSelectAll,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _allSelected ? 'Deselect All' : 'Select All',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF006699),
                              ),
                            ),
                            const SizedBox(width: 4),
                            SizedBox(
                              height: 24,
                              width: 24,
                              child: Checkbox(
                                value: _allSelected,
                                onChanged: (_) => _toggleSelectAll(),
                                activeColor: const Color(0xFF006699),
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Voucher list
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF191C1E)
                              .withValues(alpha: 0.04),
                          blurRadius: 20,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: List.generate(_vouchers.length, (i) {
                        final v = _vouchers[i];
                        final isSelected = _selectedIds.contains(v.id);
                        final statusColor = v.status == 'reimbursed'
                            ? const Color(0xFF0EA5E9)
                            : const Color(0xFF059669);

                        return Column(
                          children: [
                            GestureDetector(
                              onTap: () => _toggleSelect(v.id),
                              behavior: HitTestBehavior.opaque,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 12,
                                ),
                                child: Row(
                                  children: [
                                    // Checkbox
                                    SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: Checkbox(
                                        value: isSelected,
                                        onChanged: (_) =>
                                            _toggleSelect(v.id),
                                        activeColor:
                                            const Color(0xFF006699),
                                        materialTapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                        visualDensity:
                                            VisualDensity.compact,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    // Details
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Text(
                                                v.voucherNumber,
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w700,
                                                  color: Color(0xFF191C1E),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  horizontal: 6,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: statusColor
                                                      .withValues(alpha: 0.1),
                                                  borderRadius:
                                                      BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  v.status.toUpperCase(),
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w700,
                                                    color: statusColor,
                                                    letterSpacing: 0.5,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            v.employeeName,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFF6B7280),
                                            ),
                                          ),
                                          if (v.date != null)
                                            Text(
                                              dateFmt.format(v.date!),
                                              style: const TextStyle(
                                                fontSize: 10,
                                                color: Color(0xFF9CA3AF),
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    // Amount
                                    Text(
                                      '\u20B9${v.amount.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF191C1E),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (i < _vouchers.length - 1)
                              const Divider(
                                height: 1,
                                indent: 46,
                                color: Color(0xFFF3F4F6),
                              ),
                          ],
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Action Buttons ────────────────────────────
                  if (_selectedIds.isNotEmpty) ...[
                    // Selected summary
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_selectedIds.length} selected',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF374151),
                            ),
                          ),
                          Text(
                            '\u20B9${_vouchers.where((v) => _selectedIds.contains(v.id)).fold<double>(0, (s, v) => s + v.amount).toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Preview & Export row
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _showPreview,
                            icon: const Icon(Icons.code, size: 18),
                            label: const Text(
                              'Preview XML',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF006699),
                              side: const BorderSide(
                                color: Color(0xFF006699),
                                width: 1.5,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _exportXml,
                            icon: const Icon(Icons.upload_file, size: 18),
                            label: const Text(
                              'Export XML',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF006699),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data class for voucher rows ──────────────────────────────────────────────

class _VoucherRow {
  final String id;
  final String voucherNumber;
  final double amount;
  final String employeeName;
  final String purpose;
  final String status;
  final DateTime? date;

  const _VoucherRow({
    required this.id,
    required this.voucherNumber,
    required this.amount,
    required this.employeeName,
    required this.purpose,
    required this.status,
    this.date,
  });
}
