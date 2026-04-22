import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

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
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
  }

  @override
  void dispose() {
    _siteCtrl.dispose();
    _scopeCtrl.dispose();
    super.dispose();
  }

  String get _selectedDateApiStr =>
      '${_selectedDate.year}-'
      '${_selectedDate.month.toString().padLeft(2, '0')}-'
      '${_selectedDate.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 30)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: AppColors.primary,
              ),
        ),
        child: child!,
      ),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
    }
  }

  bool get _needsSiteFields =>
      _status == AttendanceStatus.onSite;
  bool get _needsWorkFields =>
      _status == AttendanceStatus.onSite ||
      _status == AttendanceStatus.inOffice ||
      _status == AttendanceStatus.workFromHome;

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
      date: _selectedDateApiStr,
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

    final dateLabel = DateFormat('EEE, d MMM yyyy').format(_selectedDate);
    final today = DateUtils.dateOnly(DateTime.now());
    final target = DateUtils.dateOnly(_selectedDate);
    final dayDelta = target.difference(today).inDays;
    final String dateSuffix;
    if (dayDelta == 0) {
      dateSuffix = ' · Today';
    } else if (dayDelta == 1) {
      dateSuffix = ' · Tomorrow';
    } else if (dayDelta > 1) {
      dateSuffix = ' · In $dayDelta days';
    } else {
      dateSuffix = '';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          const Icon(Icons.how_to_reg_rounded,
              size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Pick status for ${widget.empName}',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.onSurfaceVariant,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        // Date picker row — 30 days back (history) to 30 days forward (planning).
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.18),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded,
                      size: 16, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Status for',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$dateLabel$dateSuffix',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF1A1A2E),
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.expand_more_rounded,
                      size: 18, color: AppColors.primary),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
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
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [AppColors.primary, Color(0xFF00456B)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: FilledButton.icon(
            key: const Key('submit_btn'),
            onPressed: widget.isSubmitting ? null : _onTapSubmit,
            icon: widget.isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_rounded, size: 20),
            label: Text(
              widget.isSubmitting ? 'Saving…' : 'Submit status',
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w700),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
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
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        gradient: selected
            ? LinearGradient(
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.08),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: selected ? null : const Color(0xFFF3F5F8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: selected ? color : Colors.transparent,
          width: 1.8,
        ),
        boxShadow: selected
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.30),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: selected ? color : color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    icon,
                    color: selected ? Colors.white : color,
                    size: 20,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    letterSpacing: -0.1,
                    color: selected
                        ? color
                        : Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
