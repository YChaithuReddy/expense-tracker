import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

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
      // Refresh the cached status for whichever date we just submitted,
      // plus today's (hero pill) and the current week table.
      ref.invalidate(todayStatusProvider(payload.date));
      if (payload.date != fluxgenTodayStr()) {
        ref.invalidate(todayStatusProvider(fluxgenTodayStr()));
      }
      ref.invalidate(weekStatusProvider);
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
      // After a successful employee-mode submit, offer to open Asanify
      // for clock-in. Skipped for leave/holiday/weekend and for admins
      // submitting on behalf of someone else.
      if (!widget.isAdmin || ref.read(viewModeProvider) == ViewMode.employee) {
        await _promptAsanifyClockIn(payload.status);
      }
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

  /// Asks the user if they want to open Asanify to clock in after submitting
  /// a working status. Only prompts once per day — the answer is remembered
  /// in SharedPreferences as `asanify_prompt_YYYY-MM-DD`.
  Future<void> _promptAsanifyClockIn(AttendanceStatus status) async {
    // Skip for non-working statuses
    if (status == AttendanceStatus.onLeave ||
        status == AttendanceStatus.holiday ||
        status == AttendanceStatus.weekend ||
        status == AttendanceStatus.unknown) {
      return;
    }

    // Only prompt once per day
    final prefs = await SharedPreferences.getInstance();
    final key = 'asanify_prompt_${fluxgenTodayStr()}';
    if (prefs.getBool(key) == true) return;

    if (!mounted) return;
    final shouldOpen = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.schedule_rounded,
                color: Color(0xFF10B981), size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(child: Text('Clock in on Asanify?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
        ]),
        content: const Text(
          "You've logged your status — open Asanify in your browser to clock in for today.",
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Skip'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.open_in_new_rounded, size: 16),
            label: const Text('Open Asanify'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ],
      ),
    );

    // Remember the choice for today so we don't nag
    await prefs.setBool(key, true);

    if (shouldOpen == true) {
      final uri = Uri.parse('https://secure.asanify.com/Home/Dashboard');
      await launchUrl(uri, mode: LaunchMode.externalApplication);
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
