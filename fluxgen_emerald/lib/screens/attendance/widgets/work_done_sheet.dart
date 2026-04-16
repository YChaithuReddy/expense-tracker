import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';
import '../../../providers/fluxgen_provider.dart';

/// Bottom sheet for editing work-done fields on a status entry.
class WorkDoneSheet extends ConsumerStatefulWidget {
  const WorkDoneSheet({
    super.key,
    required this.empId,
    required this.empName,
    required this.date,
    this.existing,
  });
  final String empId;
  final String empName;
  final String date;
  final StatusEntry? existing;

  static Future<void> show(
    BuildContext context, {
    required String empId,
    required String empName,
    required String date,
    StatusEntry? existing,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WorkDoneSheet(
        empId: empId,
        empName: empName,
        date: date,
        existing: existing,
      ),
    );
  }

  @override
  ConsumerState<WorkDoneSheet> createState() => _WorkDoneSheetState();
}

class _WorkDoneSheetState extends ConsumerState<WorkDoneSheet> {
  late final TextEditingController _descCtrl;
  late final TextEditingController _remarksCtrl;
  double _pct = 0;
  bool _nextVisit = false;
  String _nextDate = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descCtrl = TextEditingController(text: e?.workDone ?? '');
    _remarksCtrl = TextEditingController(text: e?.workRemarks ?? '');
    _pct = double.tryParse(e?.completionPct ?? '0') ?? 0;
    _nextVisit = e?.nextVisitRequired == 'Yes';
    _nextDate = e?.nextVisitDate ?? '';
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final desc = _descCtrl.text.trim();
    if (desc.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Work done description is required'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(fluxgenApiProvider).updateWorkDone(
            empId: widget.empId,
            date: widget.date,
            workDone: desc,
            completionPct: _pct.round(),
            workRemarks: _remarksCtrl.text.trim(),
            nextVisitRequired: _nextVisit,
            nextVisitDate: _nextDate,
          );
      ref.invalidate(todayStatusProvider(widget.date));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text('Work done saved'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text('Save failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: EdgeInsets.only(bottom: bottom),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              widget.empName,
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w800),
            ),
            Text(
              widget.date,
              style: TextStyle(
                  fontSize: 12, color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Work Done Description *',
                hintText: 'What was accomplished?',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Completion',
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                const Spacer(),
                Text(
                  '${_pct.round()}%',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: _pct >= 80
                        ? const Color(0xFF10B981)
                        : _pct >= 50
                            ? const Color(0xFFF59E0B)
                            : AppColors.error,
                  ),
                ),
              ],
            ),
            Slider(
              value: _pct,
              min: 0,
              max: 100,
              divisions: 20,
              activeColor: AppColors.primary,
              onChanged: (v) => setState(() => _pct = v),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _remarksCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Remarks',
                hintText: 'Any notes for the team',
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(
                  child: Text('Next visit required?',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                Switch.adaptive(
                  value: _nextVisit,
                  activeColor: AppColors.primary,
                  onChanged: (v) => setState(() => _nextVisit = v),
                ),
              ],
            ),
            if (_nextVisit) ...[
              const SizedBox(height: 6),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.tryParse(_nextDate) ??
                        DateTime.now().add(const Duration(days: 1)),
                    firstDate: DateTime.now(),
                    lastDate:
                        DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    setState(() => _nextDate = fluxgenDateFormat(picked));
                  }
                },
                borderRadius: BorderRadius.circular(12),
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Next Visit Date',
                    suffixIcon: Icon(Icons.calendar_today, size: 18),
                  ),
                  child: Text(
                    _nextDate.isEmpty ? 'Pick a date' : _nextDate,
                    style: TextStyle(
                      color: _nextDate.isEmpty
                          ? AppColors.onSurfaceVariant
                          : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [AppColors.primary, Color(0xFF00456B)],
                ),
              ),
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_rounded, size: 18),
                label: Text(_saving ? 'Saving\u2026' : 'Save work done'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  shadowColor: Colors.transparent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
