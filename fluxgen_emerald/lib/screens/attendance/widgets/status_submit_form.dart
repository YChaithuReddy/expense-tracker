import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/fluxgen_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

class StatusSubmitPayload {
  const StatusSubmitPayload({
    required this.status,
    required this.date,
    required this.siteName,
    required this.workType,
    required this.scopeOfWork,
  });
  final AttendanceStatus status;
  final String date;
  final String siteName;
  final String workType;
  final String scopeOfWork;
}

class StatusSubmitForm extends StatefulWidget {
  const StatusSubmitForm({
    super.key,
    required this.empName,
    required this.onSubmit,
    this.isSubmitting = false,
  });
  final String empName;
  final Future<void> Function(StatusSubmitPayload) onSubmit;
  final bool isSubmitting;

  @override
  State<StatusSubmitForm> createState() => _StatusSubmitFormState();
}

class _StatusSubmitFormState extends State<StatusSubmitForm> {
  AttendanceStatus? _status;
  final _siteCtrl  = TextEditingController();
  final _scopeCtrl = TextEditingController();
  String? _workType;
  String? _validationMsg;

  @override
  void dispose() {
    _siteCtrl.dispose();
    _scopeCtrl.dispose();
    super.dispose();
  }

  bool get _needsSiteFields =>
      _status == AttendanceStatus.onSite;
  bool get _needsWorkFields =>
      _status == AttendanceStatus.onSite ||
      _status == AttendanceStatus.inOffice ||
      _status == AttendanceStatus.workFromHome;

  String _today() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  void _onSelectStatus(AttendanceStatus s) {
    HapticFeedback.lightImpact();
    setState(() {
      _status = s;
      _validationMsg = null;
    });
  }

  Future<void> _onTapSubmit() async {
    if (_status == null) {
      setState(() => _validationMsg = 'Pick a status first');
      return;
    }
    if (_needsSiteFields && _siteCtrl.text.trim().isEmpty) {
      setState(() => _validationMsg = 'Site Name is required for On Site');
      return;
    }
    if (_needsWorkFields) {
      if (_workType == null) {
        setState(() => _validationMsg = 'Pick a Work Type');
        return;
      }
      if (_scopeCtrl.text.trim().isEmpty) {
        setState(() => _validationMsg = 'Scope of Work is required');
        return;
      }
    }
    setState(() => _validationMsg = null);
    await widget.onSubmit(StatusSubmitPayload(
      status: _status!,
      date: _today(),
      siteName: _siteCtrl.text.trim(),
      workType: _workType ?? '',
      scopeOfWork: _scopeCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    const statuses = [
      (AttendanceStatus.onSite,       Icons.construction,        'On Site'),
      (AttendanceStatus.inOffice,     Icons.business,            'In Office'),
      (AttendanceStatus.workFromHome, Icons.home_work_outlined,  'WFH'),
      (AttendanceStatus.onLeave,      Icons.beach_access,        'Leave'),
      (AttendanceStatus.holiday,      Icons.celebration_outlined,'Holiday'),
      (AttendanceStatus.weekend,      Icons.weekend_outlined,    'Weekend'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Submitting as ${widget.empName}',
          style: TextStyle(
            fontSize: 13,
            color: AppColors.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          // Cards are ~1.15x wider than tall — enough vertical room for
          // icon + label without overflow, still feels like a square tile.
          childAspectRatio: 1.15,
          children: [
            for (final (status, icon, label) in statuses)
              _StatusCard(
                key: Key('status_card_${status.name}'),
                status: status,
                icon: icon,
                label: label,
                selected: _status == status,
                onTap: () => _onSelectStatus(status),
              ),
          ],
        ),
        const SizedBox(height: 8),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_needsSiteFields) ...[
                TextField(
                  key: const Key('site_name_field'),
                  controller: _siteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Site Name',
                    hintText: 'e.g. Biocon Bangalore',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_needsWorkFields) ...[
                DropdownButtonFormField<String>(
                  key: const Key('work_type_field'),
                  value: _workType,
                  decoration: const InputDecoration(labelText: 'Work Type'),
                  items: [
                    for (final wt in FluxgenApi.workTypes)
                      DropdownMenuItem(value: wt, child: Text(wt)),
                  ],
                  onChanged: (v) => setState(() => _workType = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('scope_field'),
                  controller: _scopeCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Scope of Work',
                    hintText: 'What are you working on?',
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        if (_validationMsg != null) ...[
          Text(_validationMsg!,
              style: TextStyle(color: AppColors.error, fontSize: 12)),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 4),
        FilledButton.icon(
          key: const Key('submit_btn'),
          onPressed: widget.isSubmitting ? null : _onTapSubmit,
          icon: widget.isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.check),
          label: Text(widget.isSubmitting ? 'Submitting…' : 'Submit Status'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            backgroundColor: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    super.key,
    required this.status,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final AttendanceStatus status;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forAttendanceStatus(status);
    return Material(
      color: selected
          ? color.withValues(alpha: 0.16)
          : Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? color : Colors.transparent,
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
