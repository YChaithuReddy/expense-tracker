import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';
import 'csr/csr_form_screen.dart';
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
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _maybeShowEmpIdDialog());
  }

  Future<void> _maybeShowEmpIdDialog() async {
    final current = ref.read(myEmpIdProvider);
    if (current != null) return;
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
          behavior: SnackBarBehavior.floating,
          content: Row(children: [
            const Icon(Icons.check_circle, color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Text('Saved — ${target.name}')),
          ]),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
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
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          if (isAdminSubmit) ...[
            _AdminPickerCard(
              selected: _adminSelectedEmployee,
              employeesAsync: employeesAsync,
              onChanged: (emp) =>
                  setState(() => _adminSelectedEmployee = emp),
            ),
            const SizedBox(height: 14),
          ],
          _formCard(employeesAsync, myEmpId, isAdminSubmit),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CsrFormScreen()),
            ),
            icon: const Icon(Icons.description_outlined, size: 18),
            label: const Text('Generate Service Report'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _formCard(
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
      return _UnlinkedCard(
        isFirstTime: myEmpId == null,
        onTap: _maybeShowEmpIdDialog,
      );
    }

    return _Card(
      child: StatusSubmitForm(
        empName: target.name,
        isSubmitting: _isSubmitting,
        onSubmit: (p) => _submit(p, target!),
      ),
    );
  }
}

// ─── Admin picker card ──────────────────────────────────────────────────────

class _AdminPickerCard extends StatelessWidget {
  const _AdminPickerCard({
    required this.selected,
    required this.employeesAsync,
    required this.onChanged,
  });
  final FluxgenEmployee? selected;
  final AsyncValue<List<FluxgenEmployee>> employeesAsync;
  final ValueChanged<FluxgenEmployee?> onChanged;

  @override
  Widget build(BuildContext context) {
    return _Card(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: employeesAsync.when(
        loading: () => const SizedBox(
          height: 44,
          child: Center(
            child: SizedBox(
              width: 18,
              height: 18,
              child:
                  CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
          ),
        ),
        error: (e, _) => Text('Load error: $e',
            style: TextStyle(color: AppColors.error, fontSize: 12)),
        data: (list) {
          if (list.isEmpty) {
            return const Text('No employees found',
                style: TextStyle(fontSize: 13));
          }
          final sel = selected ?? list.first;
          return Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.group_add_rounded,
                    size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Submitting for',
                      style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 0.4,
                        color: AppColors.onSurfaceVariant,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    DropdownButton<FluxgenEmployee>(
                      value: sel,
                      isExpanded: true,
                      underline: const SizedBox.shrink(),
                      icon: const Icon(Icons.keyboard_arrow_down_rounded),
                      isDense: true,
                      items: [
                        for (final e in list)
                          DropdownMenuItem(
                            value: e,
                            child: Text(
                              e.name,
                              style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w700),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: onChanged,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Unlinked state ─────────────────────────────────────────────────────────

class _UnlinkedCard extends StatelessWidget {
  const _UnlinkedCard({required this.isFirstTime, required this.onTap});
  final bool isFirstTime;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.badge_outlined,
                size: 36, color: AppColors.primary),
          ),
          const SizedBox(height: 14),
          Text(
            isFirstTime ? 'Link your employee record' : 'Record not found',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isFirstTime
                ? 'Pick your name once — we\'ll remember you.'
                : 'Pick your name from the team directory.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onTap,
            icon: const Icon(Icons.person_add_alt_1, size: 16),
            label: const Text('Link employee'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared card container ─────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding});
  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}
