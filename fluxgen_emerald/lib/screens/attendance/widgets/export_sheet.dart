import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/constants/fluxgen_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';
import '../../../services/attendance_csv_service.dart';

class ExportSheet extends StatelessWidget {
  const ExportSheet({super.key, required this.entries});
  final List<StatusEntry> entries;

  static Future<void> show(BuildContext context,
      {required List<StatusEntry> entries}) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => ExportSheet(entries: entries),
    );
  }

  Future<void> _export(BuildContext context, String csv, String filename) async {
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$filename');
      await file.writeAsString(csv);
      await Share.shareXFiles([XFile(file.path)],
          subject: filename.replaceAll('.csv', ''));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'),
              backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<String?> _showFilterDialog(
      BuildContext context, String title, List<String> options) async {
    String? selected;
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(title),
          content: DropdownButtonFormField<String>(
            value: selected,
            hint: const Text('Select'),
            isExpanded: true,
            items: [
              for (final o in options)
                DropdownMenuItem(value: o, child: Text(o))
            ],
            onChanged: (v) => setState(() => selected = v),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: selected == null ? null : () => Navigator.pop(ctx, selected),
              child: const Text('Export'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(child: Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2)),
          )),
          const Text('Export Reports',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          _ExportTile(
            icon: Icons.person,
            label: 'Employee Daily Report',
            color: AppColors.primary,
            onTap: () => _export(context,
                AttendanceCsvService.employeeDailyCsv(entries),
                'employee_report.csv'),
          ),
          _ExportTile(
            icon: Icons.location_on,
            label: 'Site-Wise Report',
            color: const Color(0xFF10B981),
            onTap: () async {
              final sites = entries
                  .map((e) => e.siteName)
                  .where((s) => s.isNotEmpty)
                  .toSet()
                  .toList()
                ..sort();
              if (sites.isEmpty) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('No site data to export')),
                  );
                }
                return;
              }
              final picked =
                  await _showFilterDialog(context, 'Select Site', sites);
              if (picked != null && context.mounted) {
                _export(
                  context,
                  AttendanceCsvService.siteCsv(entries, picked),
                  'site_${picked.replaceAll(' ', '_')}_report.csv',
                );
              }
            },
          ),
          _ExportTile(
            icon: Icons.work,
            label: 'Work Type Report',
            color: const Color(0xFF8B5CF6),
            onTap: () async {
              final picked = await _showFilterDialog(
                context,
                'Select Work Type',
                FluxgenApi.workTypes,
              );
              if (picked != null && context.mounted) {
                _export(
                  context,
                  AttendanceCsvService.workTypeCsv(entries, picked),
                  'worktype_${picked.replaceAll(' ', '_')}_report.csv',
                );
              }
            },
          ),
          _ExportTile(
            icon: Icons.insights,
            label: 'Team Efficiency Report',
            color: const Color(0xFFF59E0B),
            onTap: () => _export(context,
                AttendanceCsvService.efficiencyCsv(entries),
                'efficiency_report.csv'),
          ),
        ],
      ),
    );
  }
}

class _ExportTile extends StatelessWidget {
  const _ExportTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(label,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700))),
                Icon(Icons.share_rounded, color: AppColors.onSurfaceVariant, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
