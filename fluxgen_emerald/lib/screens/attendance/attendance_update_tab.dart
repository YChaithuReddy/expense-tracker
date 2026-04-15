import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'emp_id_setup_dialog.dart';
import 'widgets/status_submit_form.dart';

class AttendanceUpdateTab extends ConsumerStatefulWidget {
  const AttendanceUpdateTab({super.key, required this.isAdmin});
  final bool isAdmin;

  @override
  ConsumerState<AttendanceUpdateTab> createState() =>
      _AttendanceUpdateTabState();
}

class _AttendanceUpdateTabState extends ConsumerState<AttendanceUpdateTab> {
  FluxgenEmployee? _adminSelectedEmployee;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowEmpIdDialog());
  }

  Future<void> _maybeShowEmpIdDialog() async {
    final current = ref.read(myEmpIdProvider);
    if (current != null) return;
    // StateNotifier loads async — give it a moment.
    await Future.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    final again = ref.read(myEmpIdProvider);
    if (again != null) return;
    if (!mounted) return;
    await EmpIdSetupDialog.show(context, isAdmin: widget.isAdmin);
  }

  Future<void> _submit(
    StatusSubmitPayload payload,
    FluxgenEmployee target,
  ) async {
    setState(() => _isSubmitting = true);
    try {
      await ref.read(fluxgenApiProvider).submitStatus(
            empId: target.id,
            empName: target.name,
            role: target.role,
            status: payload.status,
            date: payload.date,
            siteName: payload.siteName,
            workType: payload.workType,
            scopeOfWork: payload.scopeOfWork,
          );
      ref.invalidate(todayStatusProvider(fluxgenTodayStr()));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Status submitted for ${target.name}'),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Submit failed: $e'),
          backgroundColor: AppColors.error,
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () => _submit(payload, target),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(viewModeProvider);
    final isAdminSubmit = widget.isAdmin && mode == ViewMode.admin;

    final employeesAsync = ref.watch(employeesProvider);
    final myEmpId = ref.watch(myEmpIdProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(employeesProvider);
        await ref.read(employeesProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (isAdminSubmit) ...[
            Text(
              'Submitting status for:',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            employeesAsync.when(
              loading: () => const LinearProgressIndicator(minHeight: 2),
              error: (e, _) => Text('Load error: $e'),
              data: (list) {
                _adminSelectedEmployee ??= list.isNotEmpty ? list.first : null;
                return DropdownButtonFormField<FluxgenEmployee>(
                  value: _adminSelectedEmployee,
                  isExpanded: true,
                  items: [
                    for (final e in list)
                      DropdownMenuItem(value: e, child: Text('${e.name} (${e.id})')),
                  ],
                  onChanged: (v) => setState(() => _adminSelectedEmployee = v),
                );
              },
            ),
            const SizedBox(height: 16),
          ],
          _buildForm(employeesAsync, myEmpId, isAdminSubmit),
        ],
      ),
    );
  }

  Widget _buildForm(
    AsyncValue<List<FluxgenEmployee>> employeesAsync,
    String? myEmpId,
    bool isAdminSubmit,
  ) {
    FluxgenEmployee? target;
    final list = employeesAsync.valueOrNull ?? const [];
    if (isAdminSubmit) {
      target = _adminSelectedEmployee ?? (list.isNotEmpty ? list.first : null);
    } else if (myEmpId != null) {
      for (final e in list) {
        if (e.id == myEmpId) { target = e; break; }
      }
    }
    if (target == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            Icon(Icons.person_off, size: 48, color: AppColors.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(
              myEmpId == null
                  ? 'Tap below to link your employee record'
                  : 'Your employee record could not be found',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _maybeShowEmpIdDialog,
              child: const Text('Link employee'),
            ),
          ],
        ),
      );
    }
    return StatusSubmitForm(
      empName: target.name,
      isSubmitting: _isSubmitting,
      onSubmit: (p) => _submit(p, target!),
    );
  }
}
