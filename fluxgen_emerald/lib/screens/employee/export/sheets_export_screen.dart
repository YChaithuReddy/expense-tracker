import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../services/google_sheets_service.dart';

/// Google Sheets export screen — select expenses and sync to linked Google Sheet.
/// Same UI pattern as submit_voucher_screen (expense selection + action).
class SheetsExportScreen extends StatefulWidget {
  const SheetsExportScreen({super.key});

  @override
  State<SheetsExportScreen> createState() => _SheetsExportScreenState();
}

class _SheetsExportScreenState extends State<SheetsExportScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _expenses = [];
  final Set<String> _selectedIds = {};
  bool _loading = true;
  bool _exporting = false;
  bool _selectAll = false;
  String? _sheetUrl;

  @override
  void initState() {
    super.initState();
    _loadExpenses();
    _loadSheetUrl();
  }

  Future<void> _loadSheetUrl() async {
    _sheetUrl = await GoogleSheetsService.getSheetUrl();
    if (mounted) setState(() {});
  }

  Future<void> _loadExpenses() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      final data = await _supabase
          .from('expenses')
          .select()
          .eq('user_id', user.id)
          .order('date', ascending: false);

      if (mounted) {
        setState(() {
          _expenses = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toggleSelectAll(bool? value) {
    setState(() {
      _selectAll = value ?? false;
      if (_selectAll) {
        _selectedIds.addAll(_expenses.map((e) => e['id'] as String));
      } else {
        _selectedIds.clear();
      }
    });
  }

  double get _selectedTotal {
    double total = 0;
    for (final e in _expenses) {
      if (_selectedIds.contains(e['id'])) {
        total += (e['amount'] is num ? (e['amount'] as num).toDouble() : 0);
      }
    }
    return total;
  }

  Future<void> _exportToSheets() async {
    if (_selectedIds.isEmpty) return;
    if (_sheetUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No Google Sheet linked. Configure in web dashboard first.'), backgroundColor: Color(0xFFEF4444)),
      );
      return;
    }

    setState(() => _exporting = true);
    try {
      final selected = _expenses.where((e) => _selectedIds.contains(e['id'])).toList();

      // Main export
      await GoogleSheetsService.exportToSheet(selected);

      // Sync project sheets
      final sheetId = _sheetUrl!.split('/d/').last.split('/').first;
      GoogleSheetsService.syncProjectSheets(sheetId, selected).catchError((_) {});

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${selected.length} expenses synced to Google Sheets!'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd MMM yyyy');

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: const Text('Export to Google Sheets',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF059669)))
          : Column(
              children: [
                // Header info
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: Colors.white,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.table_chart, color: Color(0xFF059669), size: 20),
                          const SizedBox(width: 8),
                          Expanded(child: Text(
                            _sheetUrl != null ? 'Sheet linked' : 'No Google Sheet linked',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                                color: _sheetUrl != null ? const Color(0xFF059669) : const Color(0xFFEF4444)),
                          )),
                          Text('${_selectedIds.length} selected',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF006699))),
                        ],
                      ),
                      if (_selectedIds.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text('Total: \u20B9${_selectedTotal.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                      ],
                    ],
                  ),
                ),

                // Select All
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Checkbox(
                        value: _selectAll,
                        onChanged: _toggleSelectAll,
                        activeColor: const Color(0xFF006699),
                      ),
                      const Text('Select All', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Text('${_expenses.length} expenses', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                    ],
                  ),
                ),
                const Divider(height: 1),

                // Expense list
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _expenses.length,
                    itemBuilder: (ctx, i) {
                      final exp = _expenses[i];
                      final id = exp['id'] as String;
                      final isSelected = _selectedIds.contains(id);
                      final date = DateTime.tryParse(exp['date']?.toString() ?? '');
                      final amount = (exp['amount'] is num) ? (exp['amount'] as num).toDouble() : 0.0;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: isSelected ? const BorderSide(color: Color(0xFF059669), width: 1.5) : BorderSide.none,
                        ),
                        color: isSelected ? const Color(0xFFF0FDF4) : Colors.white,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            setState(() {
                              if (isSelected) {
                                _selectedIds.remove(id);
                                _selectAll = false;
                              } else {
                                _selectedIds.add(id);
                                if (_selectedIds.length == _expenses.length) _selectAll = true;
                              }
                            });
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Checkbox(
                                  value: isSelected,
                                  onChanged: (_) {
                                    setState(() {
                                      if (isSelected) {
                                        _selectedIds.remove(id);
                                        _selectAll = false;
                                      } else {
                                        _selectedIds.add(id);
                                        if (_selectedIds.length == _expenses.length) _selectAll = true;
                                      }
                                    });
                                  },
                                  activeColor: const Color(0xFF059669),
                                  visualDensity: VisualDensity.compact,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(exp['vendor'] as String? ?? 'N/A',
                                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF191C1E)),
                                          maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 3),
                                      Text(
                                        '${date != null ? fmt.format(date) : ''} · ${exp['category'] ?? ''}',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                                      ),
                                    ],
                                  ),
                                ),
                                Text('\u20B9${amount.toStringAsFixed(0)}',
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Export button
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -4))],
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _selectedIds.isEmpty || _exporting ? null : _exportToSheets,
                      icon: _exporting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.table_chart, size: 20),
                      label: Text(
                        _exporting ? 'Exporting...' : 'Export ${_selectedIds.length} to Google Sheets',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFFD1D5DB),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
