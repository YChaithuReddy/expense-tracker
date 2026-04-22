import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
import '../../providers/fluxgen_provider.dart';

/// Admin-only screen pushed via Navigator to manage the Employees sheet.
/// Supports add / edit / delete with optimistic UI feedback.
///
/// When [embedded] is true, renders without Scaffold/AppBar so it can live
/// inside a TabBarView tab (the parent already owns the hero header).
class ManageEmployeesScreen extends ConsumerStatefulWidget {
  const ManageEmployeesScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  ConsumerState<ManageEmployeesScreen> createState() =>
      _ManageEmployeesScreenState();
}

class _ManageEmployeesScreenState
    extends ConsumerState<ManageEmployeesScreen> {
  // ── Add employee ──────────────────────────────────────────────────────

  Future<void> _showAddDialog() async {
    final empIdCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final roleCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _EmployeeFormDialog(
        title: 'Add Employee',
        empIdCtrl: empIdCtrl,
        nameCtrl: nameCtrl,
        roleCtrl: roleCtrl,
        formKey: formKey,
        empIdEditable: true,
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(fluxgenApiProvider).addEmployee(
            empId: empIdCtrl.text.trim(),
            empName: nameCtrl.text.trim(),
            role: roleCtrl.text.trim(),
          );
      ref.invalidate(employeesProvider);
      if (mounted) {
        _showSnack('Employee added successfully');
      }
    } catch (e) {
      if (mounted) _showSnack('Error: $e', isError: true);
    }
  }

  // ── Edit employee ─────────────────────────────────────────────────────

  Future<void> _showEditDialog(FluxgenEmployee emp) async {
    final nameCtrl = TextEditingController(text: emp.name);
    final roleCtrl = TextEditingController(text: emp.role);
    final formKey = GlobalKey<FormState>();
    // EmpID shown read-only — pass a locked controller
    final empIdCtrl = TextEditingController(text: emp.id);

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _EmployeeFormDialog(
        title: 'Edit Employee',
        empIdCtrl: empIdCtrl,
        nameCtrl: nameCtrl,
        roleCtrl: roleCtrl,
        formKey: formKey,
        empIdEditable: false,
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(fluxgenApiProvider).editEmployee(
            empId: emp.id,
            empName: nameCtrl.text.trim(),
            role: roleCtrl.text.trim(),
          );
      ref.invalidate(employeesProvider);
      if (mounted) _showSnack('Employee updated');
    } catch (e) {
      if (mounted) _showSnack('Error: $e', isError: true);
    }
  }

  // ── Delete employee ───────────────────────────────────────────────────

  Future<void> _confirmDelete(FluxgenEmployee emp) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Employee',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        content: RichText(
          text: TextSpan(
            style: TextStyle(
                fontSize: 14,
                color: AppColors.onSurface,
                height: 1.5),
            children: [
              const TextSpan(text: 'Remove '),
              TextSpan(
                text: emp.name,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const TextSpan(
                  text: ' from the Employees sheet? This cannot be undone.'),
            ],
          ),
        ),
        actionsPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.error),
              foregroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(fluxgenApiProvider).deleteEmployee(empId: emp.id);
      ref.invalidate(employeesProvider);
      if (mounted) _showSnack('${emp.name} removed');
    } catch (e) {
      if (mounted) _showSnack('Error: $e', isError: true);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.error : AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final employeesAsync = ref.watch(employeesProvider);

    final listArea = RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(employeesProvider),
      child: employeesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => _ErrorView(
          message: err.toString(),
          onRetry: () => ref.invalidate(employeesProvider),
        ),
        data: (employees) => employees.isEmpty
            ? _EmptyView(onAdd: _showAddDialog)
            : _EmployeeList(
                employees: employees,
                onEdit: _showEditDialog,
                onDelete: _confirmDelete,
              ),
      ),
    );

    if (widget.embedded) {
      // Rendered inside a TabBarView — no Scaffold/AppBar, keep FAB as overlay.
      return Stack(
        children: [
          Positioned.fill(child: listArea),
          Positioned(
            right: 16,
            bottom: 16,
            child: _GradientFab(
              tooltip: 'Add employee',
              icon: Icons.person_add_outlined,
              onPressed: _showAddDialog,
            ),
          ),
        ],
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FB),
      body: SafeArea(
        child: Column(
          children: [
            _GradientAppBar(
              title: 'Manage Employees',
              onBack: () => Navigator.maybePop(context),
            ),
            Expanded(child: listArea),
          ],
        ),
      ),
      floatingActionButton: _GradientFab(
        tooltip: 'Add employee',
        icon: Icons.person_add_outlined,
        onPressed: _showAddDialog,
      ),
    );
  }
}

// ─── Employee list ────────────────────────────────────────────────────────────

class _EmployeeList extends StatelessWidget {
  const _EmployeeList({
    required this.employees,
    required this.onEdit,
    required this.onDelete,
  });

  final List<FluxgenEmployee> employees;
  final void Function(FluxgenEmployee) onEdit;
  final void Function(FluxgenEmployee) onDelete;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: employees.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _EmployeeRow(
        employee: employees[i],
        onEdit: onEdit,
        onDelete: onDelete,
      ),
    );
  }
}

class _EmployeeRow extends StatelessWidget {
  const _EmployeeRow({
    required this.employee,
    required this.onEdit,
    required this.onDelete,
  });

  final FluxgenEmployee employee;
  final void Function(FluxgenEmployee) onEdit;
  final void Function(FluxgenEmployee) onDelete;

  Color get _avatarColor {
    const colors = [
      Color(0xFF006699),
      Color(0xFF10B981),
      Color(0xFF8B5CF6),
      Color(0xFFF59E0B),
      Color(0xFFEF4444),
      Color(0xFF3B82F6),
    ];
    final idx = employee.id.hashCode.abs() % colors.length;
    return colors[idx];
  }

  @override
  Widget build(BuildContext context) {
    final color = _avatarColor;
    final initials = employee.name.trim().isNotEmpty
        ? employee.name.trim().split(' ').map((w) => w[0]).take(2).join()
        : '?';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          radius: 22,
          backgroundColor: color.withValues(alpha: 0.16),
          child: Text(
            initials.toUpperCase(),
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: color,
            ),
          ),
        ),
        title: Text(
          employee.name,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _RoleChip(role: employee.role, color: color),
              const SizedBox(height: 4),
              Text(
                employee.id,
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _IconBtn(
              icon: Icons.edit_outlined,
              color: AppColors.primary,
              tooltip: 'Edit',
              onPressed: () => onEdit(employee),
            ),
            _IconBtn(
              icon: Icons.delete_outline,
              color: AppColors.error,
              tooltip: 'Delete',
              onPressed: () => onDelete(employee),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.role, required this.color});
  final String role;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      constraints: const BoxConstraints(maxWidth: 200),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        role.isEmpty ? 'No role' : role,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ─── Employee form dialog ─────────────────────────────────────────────────────

class _EmployeeFormDialog extends StatelessWidget {
  const _EmployeeFormDialog({
    required this.title,
    required this.empIdCtrl,
    required this.nameCtrl,
    required this.roleCtrl,
    required this.formKey,
    required this.empIdEditable,
  });

  final String title;
  final TextEditingController empIdCtrl;
  final TextEditingController nameCtrl;
  final TextEditingController roleCtrl;
  final GlobalKey<FormState> formKey;
  final bool empIdEditable;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      actionsPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
      ),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _FilledField(
              controller: empIdCtrl,
              label: 'Employee ID',
              readOnly: !empIdEditable,
              validator: empIdEditable
                  ? (v) => (v == null || v.trim().isEmpty)
                      ? 'Required'
                      : null
                  : null,
            ),
            const SizedBox(height: 12),
            _FilledField(
              controller: nameCtrl,
              label: 'Name',
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            _FilledField(
              controller: roleCtrl,
              label: 'Role',
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        _GradientButton(
          label: 'Save',
          onPressed: () {
            if (formKey.currentState?.validate() ?? false) {
              Navigator.pop(context, true);
            }
          },
        ),
      ],
    );
  }
}

// ─── Shared widgets ───────────────────────────────────────────────────────────

class _GradientAppBar extends StatelessWidget {
  const _GradientAppBar({required this.title, required this.onBack});
  final String title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF006699), Color(0xFF00456B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.28),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            visualDensity: VisualDensity.compact,
            onPressed: onBack,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientFab extends StatelessWidget {
  const _GradientFab({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
  });
  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF006699), Color(0xFF00456B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.4),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  const _GradientButton({required this.label, required this.onPressed});
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF006699), Color(0xFF00456B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

class _FilledField extends StatelessWidget {
  const _FilledField({
    required this.controller,
    required this.label,
    this.readOnly = false,
    this.validator,
  });
  final TextEditingController controller;
  final String label;
  final bool readOnly;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      readOnly: readOnly,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: readOnly
            ? AppColors.surfaceContainerLow
            : AppColors.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: AppColors.outlineVariant,
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.primary,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        labelStyle: TextStyle(
          color: readOnly
              ? AppColors.onSurfaceVariant
              : AppColors.onSurfaceVariant,
          fontSize: 13,
        ),
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onPressed,
  });
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, size: 20, color: color),
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      onPressed: onPressed,
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                color: AppColors.error, size: 40),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.group_outlined,
                size: 48, color: AppColors.onSurfaceVariant),
            const SizedBox(height: 16),
            const Text(
              'No employees yet',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.onSurface),
            ),
            const SizedBox(height: 8),
            Text(
              'Tap the + button to add the first employee.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13, color: AppColors.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
