import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';

/// Blocking modal shown the first time a user opens Attendance with no
/// EmpID mapping stored. Admins may skip (barrierDismissible); employees
/// cannot.
class EmpIdSetupDialog extends ConsumerStatefulWidget {
  const EmpIdSetupDialog({super.key, required this.isAdmin});
  final bool isAdmin;

  static Future<void> show(
    BuildContext context, {
    required bool isAdmin,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: isAdmin,
      builder: (_) => EmpIdSetupDialog(isAdmin: isAdmin),
    );
  }

  @override
  ConsumerState<EmpIdSetupDialog> createState() => _EmpIdSetupDialogState();
}

class _EmpIdSetupDialogState extends ConsumerState<EmpIdSetupDialog> {
  FluxgenEmployee? _selected;

  @override
  Widget build(BuildContext context) {
    final employeesAsync = ref.watch(employeesProvider);

    return AlertDialog(
      title: const Text('Who are you?'),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Pick your name from the team list — one time only.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            employeesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primary, strokeWidth: 2.5)),
              ),
              error: (e, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Could not load team list: $e',
                      style: TextStyle(color: AppColors.error, fontSize: 12)),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => ref.invalidate(employeesProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
              data: (list) => DropdownButtonFormField<FluxgenEmployee>(
                value: _selected,
                hint: const Text('Select your name'),
                isExpanded: true,
                items: [
                  for (final emp in list)
                    DropdownMenuItem(
                      value: emp,
                      child: Text(
                        emp.role.isEmpty
                            ? emp.name
                            : '${emp.name} · ${emp.role}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _selected = v),
              ),
            ),
          ],
        ),
      ),
      actions: [
        if (widget.isAdmin)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Skip'),
          ),
        FilledButton(
          onPressed: _selected == null
              ? null
              : () async {
                  await ref
                      .read(myEmpIdProvider.notifier)
                      .set(_selected!.id, _selected!.name);
                  if (context.mounted) Navigator.of(context).pop();
                },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
