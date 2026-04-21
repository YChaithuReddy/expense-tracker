import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/constants/fluxgen_api.dart';
import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import '../../services/attendance_csv_service.dart';

/// Download Report tab — matches web's "Download Report" page.
///
/// Shows 3 report types:
/// 1. Employee Report — select employee + date range → Preview/CSV
/// 2. Work Type Report — select type + date range → Preview/CSV
/// 3. Site-wise Report — select site + date range → Preview/CSV
class AttendanceReportTab extends ConsumerStatefulWidget {
  const AttendanceReportTab({super.key});

  @override
  ConsumerState<AttendanceReportTab> createState() => _AttendanceReportTabState();
}

class _AttendanceReportTabState extends ConsumerState<AttendanceReportTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  // Employee Report
  String? _selectedEmployee;
  DateTime? _empFrom;
  DateTime? _empTo;

  // Work Type Report
  String? _selectedWorkType;
  DateTime? _workFrom;
  DateTime? _workTo;

  // Site Report
  String? _selectedSite;
  DateTime? _siteFrom;
  DateTime? _siteTo;

  // Preview data
  List<StatusEntry>? _previewData;
  String _previewTitle = '';

  final _dateFmt = DateFormat('dd-MM-yyyy');

  List<StatusEntry> _cachedEntries = [];
  bool _loadingData = false;

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _loadingData = true);
    try {
      // Load last 90 days of data for reports
      final now = DateTime.now();
      final from = now.subtract(const Duration(days: 90));
      final fromStr = '${from.year}-${from.month.toString().padLeft(2, '0')}-${from.day.toString().padLeft(2, '0')}';
      final toStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      final params = WeekRangeParams(from: fromStr, to: toStr, empId: 'ALL');
      final entries = await ref.read(weekStatusProvider(params).future);
      if (mounted) {
        setState(() {
          _cachedEntries = entries;
          _loadingData = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingData = false);
    }
  }

  List<String> get _employeeNames {
    final names = _cachedEntries.map((e) => e.empName).where((n) => n.isNotEmpty).toSet().toList();
    names.sort();
    return names;
  }

  List<String> get _siteNames {
    final sites = _cachedEntries.map((e) => e.siteName).where((s) => s.isNotEmpty).toSet().toList();
    sites.sort();
    return sites;
  }

  Future<void> _pickDate(bool isFrom, String reportType) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(2024),
      lastDate: now,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      switch (reportType) {
        case 'employee':
          if (isFrom) _empFrom = picked; else _empTo = picked;
        case 'work':
          if (isFrom) _workFrom = picked; else _workTo = picked;
        case 'site':
          if (isFrom) _siteFrom = picked; else _siteTo = picked;
      }
    });
  }

  List<StatusEntry> _filterEntries({String? employee, String? workType, String? site, DateTime? from, DateTime? to}) {
    var entries = List<StatusEntry>.from(_cachedEntries);
    if (employee != null) {
      entries = entries.where((e) => e.empName == employee).toList();
    }
    if (workType != null) {
      entries = entries.where((e) => e.workType.toLowerCase() == workType.toLowerCase()).toList();
    }
    if (site != null) {
      entries = entries.where((e) => e.siteName == site).toList();
    }
    if (from != null) {
      entries = entries.where((e) {
        final d = DateTime.tryParse(e.date);
        return d != null && !d.isBefore(from);
      }).toList();
    }
    if (to != null) {
      entries = entries.where((e) {
        final d = DateTime.tryParse(e.date);
        return d != null && !d.isAfter(to);
      }).toList();
    }
    return entries;
  }

  void _preview(String title, List<StatusEntry> entries) {
    setState(() {
      _previewTitle = title;
      _previewData = entries;
    });
  }

  Future<void> _exportCsv(String csv, String filename) async {
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$filename');
      await file.writeAsString(csv);
      await Share.shareXFiles([XFile(file.path)], subject: filename.replaceAll('.csv', ''));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loadingData) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(40),
        child: CircularProgressIndicator(color: AppColors.primary),
      ));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Employee Report
          _ReportCard(
            title: 'Download Employee Report',
            icon: Icons.person,
            color: AppColors.primary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Employee *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                const SizedBox(height: 6),
                _buildDropdown(
                  value: _selectedEmployee,
                  hint: '-- Select Employee --',
                  items: _employeeNames,
                  onChanged: (v) => setState(() => _selectedEmployee = v),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _dateField('From Date *', _empFrom, () => _pickDate(true, 'employee'))),
                  const SizedBox(width: 10),
                  Expanded(child: _dateField('To Date *', _empTo, () => _pickDate(false, 'employee'))),
                ]),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: _actionButton('Preview', const Color(0xFF1A3A4A), () {
                    if (_selectedEmployee == null) return;
                    final entries = _filterEntries(employee: _selectedEmployee, from: _empFrom, to: _empTo);
                    _preview('Employee: $_selectedEmployee', entries);
                  })),
                  const SizedBox(width: 10),
                  Expanded(child: _actionButton('Download CSV', const Color(0xFF10B981), () {
                    if (_selectedEmployee == null) return;
                    final entries = _filterEntries(employee: _selectedEmployee, from: _empFrom, to: _empTo);
                    _exportCsv(AttendanceCsvService.employeeDailyCsv(entries), 'employee_${_selectedEmployee!.replaceAll(' ', '_')}.csv');
                  })),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Site-wise Report
          _ReportCard(
            title: 'Site-wise Report',
            icon: Icons.location_on,
            color: const Color(0xFF10B981),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Site Name *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                const SizedBox(height: 6),
                _buildDropdown(
                  value: _selectedSite,
                  hint: 'Search site name or ID...',
                  items: _siteNames,
                  onChanged: (v) => setState(() => _selectedSite = v),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _dateField('From Date *', _siteFrom, () => _pickDate(true, 'site'))),
                  const SizedBox(width: 10),
                  Expanded(child: _dateField('To Date *', _siteTo, () => _pickDate(false, 'site'))),
                ]),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: _actionButton('Preview', const Color(0xFF1A3A4A), () {
                    if (_selectedSite == null) return;
                    final entries = _filterEntries(site: _selectedSite, from: _siteFrom, to: _siteTo);
                    _preview('Site: $_selectedSite', entries);
                  })),
                  const SizedBox(width: 10),
                  Expanded(child: _actionButton('Download CSV', const Color(0xFF10B981), () {
                    if (_selectedSite == null) return;
                    final entries = _filterEntries(site: _selectedSite, from: _siteFrom, to: _siteTo);
                    _exportCsv(AttendanceCsvService.siteCsv(entries, _selectedSite!), 'site_${_selectedSite!.replaceAll(' ', '_')}.csv');
                  })),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Work Type Report
          _ReportCard(
            title: 'Work Type Report',
            icon: Icons.work,
            color: const Color(0xFF8B5CF6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Type of Work *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                const SizedBox(height: 6),
                _buildDropdown(
                  value: _selectedWorkType,
                  hint: '-- Select Type --',
                  items: FluxgenApi.workTypes,
                  onChanged: (v) => setState(() => _selectedWorkType = v),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _dateField('From Date *', _workFrom, () => _pickDate(true, 'work'))),
                  const SizedBox(width: 10),
                  Expanded(child: _dateField('To Date *', _workTo, () => _pickDate(false, 'work'))),
                ]),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: _actionButton('Preview', const Color(0xFF1A3A4A), () {
                    if (_selectedWorkType == null) return;
                    final entries = _filterEntries(workType: _selectedWorkType, from: _workFrom, to: _workTo);
                    _preview('Work Type: $_selectedWorkType', entries);
                  })),
                  const SizedBox(width: 10),
                  Expanded(child: _actionButton('Download CSV', const Color(0xFF10B981), () {
                    if (_selectedWorkType == null) return;
                    final entries = _filterEntries(workType: _selectedWorkType, from: _workFrom, to: _workTo);
                    _exportCsv(AttendanceCsvService.workTypeCsv(entries, _selectedWorkType!), 'worktype_${_selectedWorkType!.replaceAll(' ', '_')}.csv');
                  })),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Preview section
          if (_previewData != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('Preview: $_previewTitle', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Text('${_previewData!.length} records', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => setState(() => _previewData = null),
                        child: const Icon(Icons.close, size: 18, color: Color(0xFF9CA3AF)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_previewData!.isEmpty)
                    const Center(child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text('No records found for this filter', style: TextStyle(color: Color(0xFF9CA3AF))),
                    ))
                  else
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        columnSpacing: 14,
                        headingRowHeight: 36,
                        dataRowMinHeight: 34,
                        dataRowMaxHeight: 38,
                        columns: const [
                          DataColumn(label: Text('#', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          DataColumn(label: Text('Employee', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          DataColumn(label: Text('Date', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          DataColumn(label: Text('Site', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                          DataColumn(label: Text('Work Type', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11))),
                        ],
                        rows: [
                          for (int i = 0; i < _previewData!.length && i < 50; i++)
                            DataRow(cells: [
                              DataCell(Text('${i + 1}', style: const TextStyle(fontSize: 11))),
                              DataCell(Text(_previewData![i].empName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600))),
                              DataCell(Text(_previewData![i].date, style: const TextStyle(fontSize: 11))),
                              DataCell(Text(_previewData![i].status.label, style: const TextStyle(fontSize: 11))),
                              DataCell(Text(_previewData![i].siteName, style: const TextStyle(fontSize: 11))),
                              DataCell(Text(_previewData![i].workType, style: const TextStyle(fontSize: 11))),
                            ]),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildDropdown({String? value, required String hint, required List<String> items, required ValueChanged<String?> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          items: items.map((i) => DropdownMenuItem(value: i, child: Text(i, style: const TextStyle(fontSize: 13)))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _dateField(String label, DateTime? date, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                Expanded(child: Text(
                  date != null ? _dateFmt.format(date) : 'dd-mm-yyyy',
                  style: TextStyle(fontSize: 13, color: date != null ? const Color(0xFF191C1E) : const Color(0xFF9CA3AF)),
                )),
                const Icon(Icons.calendar_today, size: 16, color: Color(0xFF9CA3AF)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _actionButton(String label, Color color, VoidCallback onTap) {
    return SizedBox(
      height: 44,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: 0,
        ),
        child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.title, required this.icon, required this.color, required this.child});
  final String title;
  final IconData icon;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFB),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
          ]),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}
