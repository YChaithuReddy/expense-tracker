import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/widgets/notification_bell.dart';
import 'package:emerald/services/activity_log_service.dart';

/// Full-featured employee management screen for admins.
///
/// Features:
///   - Search bar (name, email, employee_id)
///   - Role filter chips (All / Employee / Manager / Accountant / Admin)
///   - Employee cards with role badges, department, status
///   - Tap card -> bottom sheet to edit role, department, designation, or remove
///   - Pull-to-refresh
///   - Activity logging on role changes
class AdminEmployeesScreen extends StatefulWidget {
  const AdminEmployeesScreen({super.key});

  @override
  State<AdminEmployeesScreen> createState() => _AdminEmployeesScreenState();
}

class _AdminEmployeesScreenState extends State<AdminEmployeesScreen> {
  final _supabase = Supabase.instance.client;
  final _searchController = TextEditingController();

  bool _loading = true;
  String? _orgId;
  List<Map<String, dynamic>> _employees = [];
  String _searchQuery = '';
  String _activeFilter = 'all'; // all, employee, manager, accountant, admin

  static const _roles = ['employee', 'manager', 'accountant', 'admin'];

  static const _filterOptions = [
    ('all', 'All'),
    ('employee', 'Employee'),
    ('manager', 'Manager'),
    ('accountant', 'Accountant'),
    ('admin', 'Admin'),
  ];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.trim().toLowerCase());
    });
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ── Data Loading ──────────────────────────────────────────────────────

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      final profile = await _supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      _orgId = profile?['organization_id'] as String?;
      if (_orgId == null || _orgId!.isEmpty) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      await _loadEmployees();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadEmployees() async {
    if (_orgId == null) return;

    // Source of truth = employee_whitelist (matches website /admin.html).
    // profiles only contains signed-up users, so querying it drops every
    // whitelisted employee who hasn't logged in yet.
    final data = await _supabase
        .from('employee_whitelist')
        .select('id, name, email, employee_id, role, department, '
            'designation, is_active')
        .eq('organization_id', _orgId!)
        .order('name', ascending: true);

    if (mounted) {
      setState(() {
        _employees = List<Map<String, dynamic>>.from(data);
      });
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────

  List<Map<String, dynamic>> get _filteredEmployees {
    var list = _employees;

    // Role filter
    if (_activeFilter != 'all') {
      list = list.where((e) => (e['role'] as String?) == _activeFilter).toList();
    }

    // Search filter
    if (_searchQuery.isNotEmpty) {
      list = list.where((e) {
        final name = (e['name'] as String? ?? '').toLowerCase();
        final email = (e['email'] as String? ?? '').toLowerCase();
        final empId = (e['employee_id'] as String? ?? '').toLowerCase();
        return name.contains(_searchQuery) ||
            email.contains(_searchQuery) ||
            empId.contains(_searchQuery);
      }).toList();
    }

    return list;
  }

  // ── Actions ───────────────────────────────────────────────────────────

  Future<void> _updateRole(
      String whitelistId, String email, String oldRole, String newRole) async {
    try {
      // Source of truth: employee_whitelist row for this employee.
      await _supabase
          .from('employee_whitelist')
          .update({'role': newRole})
          .eq('id', whitelistId);

      // Mirror to profiles (if the user has signed up) so their session role
      // flips without waiting for re-login. No-op for unsigned-up members.
      if (email.isNotEmpty && _orgId != null) {
        await _supabase
            .from('profiles')
            .update({'role': newRole})
            .eq('email', email)
            .eq('organization_id', _orgId!);
      }

      // Find employee name for the activity log
      final emp = _employees.firstWhere(
        (e) => e['id'] == whitelistId,
        orElse: () => <String, dynamic>{},
      );
      final empName = emp['name'] as String? ?? 'Unknown';

      await ActivityLogService.log(
        'employee_role_changed',
        'Changed $empName role from $oldRole to $newRole',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$empName role updated to $newRole'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }

      await _loadEmployees();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update role: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  Future<void> _updateProfile(
    String whitelistId,
    String email, {
    String? department,
    String? designation,
  }) async {
    try {
      final updates = <String, dynamic>{};
      if (department != null) updates['department'] = department;
      if (designation != null) updates['designation'] = designation;
      if (updates.isEmpty) return;

      await _supabase
          .from('employee_whitelist')
          .update(updates)
          .eq('id', whitelistId);

      if (email.isNotEmpty && _orgId != null) {
        await _supabase
            .from('profiles')
            .update(updates)
            .eq('email', email)
            .eq('organization_id', _orgId!);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }

      await _loadEmployees();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  Future<void> _removeFromOrganization(
      String whitelistId, String email, String empName) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Remove Employee',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        content: Text(
          'Are you sure you want to remove $empName from the organization? '
          'This will unlink their account.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Remove',
              style: TextStyle(
                color: Color(0xFFBA1A1A),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      // Deactivate in whitelist (preserves CSV import history) + unlink any
      // live profile so the user loses org access.
      await _supabase
          .from('employee_whitelist')
          .update({'is_active': false})
          .eq('id', whitelistId);

      if (email.isNotEmpty && _orgId != null) {
        await _supabase
            .from('profiles')
            .update({'organization_id': null})
            .eq('email', email)
            .eq('organization_id', _orgId!);
      }

      await ActivityLogService.log(
        'employee_removed',
        'Removed $empName from the organization',
      );

      if (mounted) {
        Navigator.pop(context); // close the bottom sheet
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$empName removed from organization'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }

      await _loadEmployees();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  // ── Bottom Sheet ──────────────────────────────────────────────────────

  void _showEmployeeDetail(Map<String, dynamic> emp) {
    final profileId = emp['id'] as String;
    final name = emp['name'] as String? ?? 'Unknown';
    final email = emp['email'] as String? ?? '';
    final empId = emp['employee_id'] as String? ?? '';
    final role = emp['role'] as String? ?? 'employee';
    final department = emp['department'] as String? ?? '';
    final designation = emp['designation'] as String? ?? '';

    String selectedRole = _roles.contains(role) ? role : 'employee';
    final deptController = TextEditingController(text: department);
    final desigController = TextEditingController(text: designation);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD1D5DB),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Avatar + name header
                  Row(
                    children: [
                      _buildAvatar(name, 48, 18),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF191C1E),
                              ),
                            ),
                            if (empId.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF3F4F6),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  empId,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF6B7280),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      _roleBadge(selectedRole),
                    ],
                  ),

                  const SizedBox(height: 8),
                  // Email
                  Row(
                    children: [
                      const Icon(Icons.email_outlined,
                          size: 16, color: Color(0xFF9CA3AF)),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          email,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  const Divider(height: 1, color: Color(0xFFF3F4F6)),
                  const SizedBox(height: 20),

                  // Role dropdown
                  const Text(
                    'ROLE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: selectedRole,
                        isExpanded: true,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF191C1E),
                        ),
                        icon: const Icon(Icons.expand_more,
                            color: Color(0xFF006699)),
                        items: _roles.map((r) {
                          return DropdownMenuItem(
                            value: r,
                            child: Row(
                              children: [
                                _roleIcon(r),
                                const SizedBox(width: 10),
                                Text(r[0].toUpperCase() + r.substring(1)),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (newRole) {
                          if (newRole != null && newRole != selectedRole) {
                            final oldRole = selectedRole;
                            setSheetState(() => selectedRole = newRole);
                            _updateRole(profileId, email, oldRole, newRole);
                          }
                        },
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Department
                  const Text(
                    'DEPARTMENT',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildTextField(
                    controller: deptController,
                    hint: 'e.g., Engineering',
                  ),

                  const SizedBox(height: 16),

                  // Designation
                  const Text(
                    'DESIGNATION',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildTextField(
                    controller: desigController,
                    hint: 'e.g., Senior Engineer',
                  ),

                  const SizedBox(height: 16),

                  // Save department/designation button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        _updateProfile(
                          profileId,
                          email,
                          department: deptController.text.trim(),
                          designation: desigController.text.trim(),
                        );
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF006699),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Save Changes',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Remove from organization button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          _removeFromOrganization(profileId, email, name),
                      icon: const Icon(Icons.person_remove_outlined, size: 18),
                      label: const Text('Remove from Organization'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFBA1A1A),
                        side: const BorderSide(
                          color: Color(0xFFBA1A1A),
                          width: 1,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredEmployees;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Employees',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF191C1E)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: const [
          NotificationBell(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF006699)),
              )
            : Column(
                children: [
                  // Search bar + filters (non-scrollable header)
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: Column(
                      children: [
                        // Search bar
                        TextField(
                          controller: _searchController,
                          decoration: InputDecoration(
                            hintText: 'Search by name, email, or ID...',
                            hintStyle: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF9CA3AF),
                            ),
                            prefixIcon: const Icon(
                              Icons.search,
                              size: 20,
                              color: Color(0xFF9CA3AF),
                            ),
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.close, size: 18),
                                    onPressed: () =>
                                        _searchController.clear(),
                                  )
                                : null,
                            filled: true,
                            fillColor: const Color(0xFFF3F4F6),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Filter chips
                        SizedBox(
                          height: 34,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _filterOptions.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(width: 8),
                            itemBuilder: (_, i) {
                              final (value, label) = _filterOptions[i];
                              final isActive = _activeFilter == value;
                              final count = value == 'all'
                                  ? _employees.length
                                  : _employees
                                      .where(
                                          (e) => e['role'] == value)
                                      .length;

                              return GestureDetector(
                                onTap: () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _activeFilter = value);
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? const Color(0xFF006699)
                                        : Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isActive
                                          ? const Color(0xFF006699)
                                          : const Color(0xFFE5E7EB),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        label,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: isActive
                                              ? Colors.white
                                              : const Color(0xFF6B7280),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: isActive
                                              ? Colors.white
                                                  .withValues(alpha: 0.2)
                                              : const Color(0xFFF3F4F6),
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          '$count',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: isActive
                                                ? Colors.white
                                                : const Color(0xFF9CA3AF),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Employee list (scrollable)
                  Expanded(
                    child: filtered.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) =>
                                _buildEmployeeCard(filtered[i]),
                          ),
                  ),
                ],
              ),
      ),
    );
  }

  // ── Employee Card ─────────────────────────────────────────────────────

  Widget _buildEmployeeCard(Map<String, dynamic> emp) {
    final name = emp['name'] as String? ?? 'Unknown';
    final email = emp['email'] as String? ?? '';
    final empId = emp['employee_id'] as String? ?? '';
    final role = emp['role'] as String? ?? 'employee';
    final department = emp['department'] as String? ?? '';
    final designation = emp['designation'] as String? ?? '';

    final subtitleParts = <String>[];
    if (department.isNotEmpty) subtitleParts.add(department);
    if (designation.isNotEmpty) subtitleParts.add(designation);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          _showEmployeeDetail(emp);
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              // Avatar
              _buildAvatar(name, 44, 14),
              const SizedBox(width: 12),

              // Name, ID, email, dept+desig
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name row with employee ID badge
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF191C1E),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (empId.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              empId,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),

                    // Email
                    Text(
                      email,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Department and designation
                    if (subtitleParts.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitleParts.join(' \u00B7 '),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF6B7280),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(width: 10),
              // Role badge
              _roleBadge(role),
            ],
          ),
        ),
      ),
    );
  }

  // ── Empty State ───────────────────────────────────────────────────────

  Widget _buildEmptyState() {
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFF006699).withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.people_outline,
                  size: 40,
                  color: Color(0xFF006699),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                _searchQuery.isNotEmpty || _activeFilter != 'all'
                    ? 'No employees match your search'
                    : 'No employees yet',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _searchQuery.isNotEmpty || _activeFilter != 'all'
                    ? 'Try a different search or filter'
                    : 'Import employees via CSV or add them from Settings',
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF9CA3AF),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Shared Widgets ────────────────────────────────────────────────────

  Widget _buildAvatar(String name, double size, double fontSize) {
    final initials = name
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => w[0])
        .take(2)
        .join()
        .toUpperCase();

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFF006699).withValues(alpha: 0.1),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initials,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF006699),
          ),
        ),
      ),
    );
  }

  Widget _roleBadge(String role) {
    final (Color bg, Color fg) = switch (role) {
      'admin' => (const Color(0xFFFEF2F2), const Color(0xFFEF4444)),
      'manager' => (const Color(0xFFF0F9FF), const Color(0xFF0EA5E9)),
      'accountant' => (const Color(0xFFFFFBEB), const Color(0xFFF59E0B)),
      _ => (const Color(0xFFECFDF5), const Color(0xFF059669)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        role[0].toUpperCase() + role.substring(1),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _roleIcon(String role) {
    final (IconData icon, Color color) = switch (role) {
      'admin' => (Icons.shield_outlined, const Color(0xFFEF4444)),
      'manager' => (Icons.supervisor_account_outlined, const Color(0xFF0EA5E9)),
      'accountant' => (Icons.calculate_outlined, const Color(0xFFF59E0B)),
      _ => (Icons.person_outline, const Color(0xFF059669)),
    };

    return Icon(icon, size: 18, color: color);
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
  }) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
          fontSize: 13,
          color: Color(0xFF9CA3AF),
        ),
        filled: true,
        fillColor: const Color(0xFFF3F4F6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
      ),
    );
  }
}
