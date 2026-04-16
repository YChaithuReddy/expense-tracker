import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../providers/fluxgen_provider.dart';

/// Admin-only screen pushed via Navigator to manage the Users sheet.
/// Supports add / delete; editing users is not exposed by the backend.
class ManageUsersScreen extends ConsumerStatefulWidget {
  const ManageUsersScreen({super.key});

  @override
  ConsumerState<ManageUsersScreen> createState() => _ManageUsersScreenState();
}

class _ManageUsersScreenState extends ConsumerState<ManageUsersScreen> {
  static const _superAdmin = 'anil';

  // ── Add user ──────────────────────────────────────────────────────────

  Future<void> _showAddDialog() async {
    final usernameCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final displayNameCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    String selectedRole = 'user';

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setInner) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          actionsPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          title: const Text(
            'Add User',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _FilledField(
                  controller: displayNameCtrl,
                  label: 'Display Name',
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                _FilledField(
                  controller: usernameCtrl,
                  label: 'Username',
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Required';
                    if (v.trim() == _superAdmin) {
                      return '"$_superAdmin" is a protected account';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                _FilledField(
                  controller: passwordCtrl,
                  label: 'Password',
                  obscureText: true,
                  validator: (v) => (v == null || v.isEmpty)
                      ? 'Required'
                      : null,
                ),
                const SizedBox(height: 12),
                _RoleDropdown(
                  value: selectedRole,
                  onChanged: (v) {
                    if (v != null) setInner(() => selectedRole = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            _GradientButton(
              label: 'Save',
              onPressed: () {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.pop(ctx, true);
                }
              },
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(fluxgenApiProvider).addUser(
            username: usernameCtrl.text.trim(),
            password: passwordCtrl.text,
            role: selectedRole,
            displayName: displayNameCtrl.text.trim(),
          );
      ref.invalidate(usersProvider);
      if (mounted) _showSnack('User added successfully');
    } catch (e) {
      if (mounted) _showSnack('Error: $e', isError: true);
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────

  Future<void> _confirmDelete(Map<String, dynamic> user) async {
    final username = (user['username'] as String?) ?? '';
    final displayName =
        (user['displayName'] as String?) ?? username;

    if (username == _superAdmin) {
      _showSnack('Cannot delete the "$_superAdmin" super-admin account',
          isError: true);
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Delete User',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        content: RichText(
          text: TextSpan(
            style: TextStyle(
                fontSize: 14,
                color: AppColors.onSurface,
                height: 1.5),
            children: [
              const TextSpan(text: 'Remove '),
              TextSpan(
                text: displayName,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              TextSpan(
                  text: ' (@$username) from the Users sheet? This cannot be undone.'),
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
      await ref.read(fluxgenApiProvider).deleteUser(username: username);
      ref.invalidate(usersProvider);
      if (mounted) _showSnack('$displayName removed');
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
    final usersAsync = ref.watch(usersProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FB),
      body: SafeArea(
        child: Column(
          children: [
            _GradientAppBar(
              title: 'Manage Users',
              onBack: () => Navigator.maybePop(context),
            ),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(usersProvider),
                child: usersAsync.when(
                  loading: () => const Center(
                    child:
                        CircularProgressIndicator(color: AppColors.primary),
                  ),
                  error: (err, _) => _ErrorView(
                    message: err.toString(),
                    onRetry: () => ref.invalidate(usersProvider),
                  ),
                  data: (users) => users.isEmpty
                      ? _EmptyView(onAdd: _showAddDialog)
                      : _UserList(
                          users: users,
                          onDelete: _confirmDelete,
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: _GradientFab(
        tooltip: 'Add user',
        icon: Icons.person_add_outlined,
        onPressed: _showAddDialog,
      ),
    );
  }
}

// ─── User list ────────────────────────────────────────────────────────────────

class _UserList extends StatelessWidget {
  const _UserList({required this.users, required this.onDelete});
  final List<Map<String, dynamic>> users;
  final void Function(Map<String, dynamic>) onDelete;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: users.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _UserRow(user: users[i], onDelete: onDelete),
    );
  }
}

class _UserRow extends StatelessWidget {
  const _UserRow({required this.user, required this.onDelete});
  final Map<String, dynamic> user;
  final void Function(Map<String, dynamic>) onDelete;

  static const _superAdmin = 'anil';

  Color get _avatarColor {
    const colors = [
      Color(0xFF006699),
      Color(0xFF10B981),
      Color(0xFF8B5CF6),
      Color(0xFFF59E0B),
      Color(0xFF3B82F6),
      Color(0xFFEF4444),
    ];
    final username = (user['username'] as String?) ?? '';
    final idx = username.hashCode.abs() % colors.length;
    return colors[idx];
  }

  @override
  Widget build(BuildContext context) {
    final username = (user['username'] as String?) ?? '';
    final displayName = (user['displayName'] as String?) ??
        (user['display_name'] as String?) ??
        username;
    final role = (user['role'] as String?) ?? 'user';
    final isSuperAdmin = username == _superAdmin;

    final color = _avatarColor;
    final initial = displayName.trim().isNotEmpty
        ? displayName.trim()[0].toUpperCase()
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
            initial,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: color,
            ),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                displayName,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
            if (isSuperAdmin)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Super Admin',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFF59E0B),
                  ),
                ),
              ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            children: [
              Text(
                '@$username',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                '·',
                style: TextStyle(color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(width: 6),
              _RoleChip(role: role, color: color),
            ],
          ),
        ),
        trailing: isSuperAdmin
            ? const Tooltip(
                message: 'Protected account',
                child: Icon(Icons.lock_outline,
                    size: 18, color: AppColors.onSurfaceVariant),
              )
            : IconButton(
                icon: const Icon(Icons.delete_outline,
                    size: 20, color: AppColors.error),
                tooltip: 'Delete user',
                visualDensity: VisualDensity.compact,
                onPressed: () => onDelete(user),
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
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        role.isEmpty ? 'user' : role,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ─── Role dropdown ────────────────────────────────────────────────────────────

class _RoleDropdown extends StatelessWidget {
  const _RoleDropdown({required this.value, required this.onChanged});
  final String value;
  final void Function(String?) onChanged;

  static const _roles = ['user', 'manager', 'admin'];

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: 'Role',
        filled: true,
        fillColor: AppColors.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
              color: AppColors.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.primary, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        labelStyle: const TextStyle(
            color: AppColors.onSurfaceVariant, fontSize: 13),
      ),
      items: _roles
          .map((r) => DropdownMenuItem(
                value: r,
                child: Text(
                  r[0].toUpperCase() + r.substring(1),
                  style: const TextStyle(fontSize: 14),
                ),
              ))
          .toList(),
      onChanged: onChanged,
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
            constraints:
                const BoxConstraints(minWidth: 36, minHeight: 36),
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
    this.validator,
    this.obscureText = false,
  });
  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final bool obscureText;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: AppColors.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
              color: AppColors.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        labelStyle: const TextStyle(
            color: AppColors.onSurfaceVariant, fontSize: 13),
      ),
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
            Icon(Icons.manage_accounts_outlined,
                size: 48, color: AppColors.onSurfaceVariant),
            const SizedBox(height: 16),
            const Text(
              'No users yet',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.onSurface),
            ),
            const SizedBox(height: 8),
            Text(
              'Tap the + button to add the first user.',
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
