import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Admin Settings screen with sections for:
///   - Organization Info
///   - Employee Management (list, role change, invite)
///   - Project Management (list, add, delete)
///   - Tally Settings (payment ledger name)
///
/// All data is fetched directly from Supabase using `Supabase.instance.client`.
class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  bool _loading = true;

  // Organization
  String _orgName = '';
  String _orgDomain = '';
  String? _orgId;

  // Employees
  List<Map<String, dynamic>> _employees = [];

  // Projects
  List<Map<String, dynamic>> _projects = [];

  // Tally Settings
  final _paymentLedgerController = TextEditingController();

  static const _roles = ['employee', 'manager', 'accountant', 'admin'];

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _paymentLedgerController.dispose();
    super.dispose();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      await Future.wait([
        _loadOrganization(),
        _loadTallySettings(),
      ]);
      // Employees & projects depend on _orgId being set
      if (_orgId != null) {
        await Future.wait([
          _loadEmployees(),
          _loadProjects(),
        ]);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadOrganization() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    final profile = await Supabase.instance.client
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

    final orgId = profile?['organization_id'] as String?;
    if (orgId == null) return;

    final org = await Supabase.instance.client
        .from('organizations')
        .select('id, name, domain')
        .eq('id', orgId)
        .maybeSingle();

    if (org != null && mounted) {
      _orgId = org['id'] as String;
      _orgName = org['name'] as String? ?? '';
      _orgDomain = org['domain'] as String? ?? '';
    }
  }

  Future<void> _loadEmployees() async {
    if (_orgId == null) return;
    final data = await Supabase.instance.client
        .from('profiles')
        .select('id, name, email, employee_id, role')
        .eq('organization_id', _orgId!)
        .order('name', ascending: true);

    if (mounted) {
      _employees = List<Map<String, dynamic>>.from(data);
    }
  }

  Future<void> _loadProjects() async {
    if (_orgId == null) return;
    final data = await Supabase.instance.client
        .from('projects')
        .select('id, project_code, project_name, client_name')
        .eq('organization_id', _orgId!)
        .order('project_code', ascending: true);

    if (mounted) {
      _projects = List<Map<String, dynamic>>.from(data);
    }
  }

  Future<void> _loadTallySettings() async {
    final prefs = await SharedPreferences.getInstance();
    final ledger = prefs.getString('tally_payment_ledger') ?? '';
    if (mounted) {
      _paymentLedgerController.text = ledger;
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  Future<void> _changeRole(String profileId, String newRole) async {
    try {
      await Supabase.instance.client
          .from('profiles')
          .update({'role': newRole})
          .eq('id', profileId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Role updated successfully'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        _loadEmployees().then((_) {
          if (mounted) setState(() {});
        });
      }
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

  void _showInviteDialog() {
    final emailController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Invite Employee',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        content: TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'employee@company.com',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final email = emailController.text.trim();
              if (email.isEmpty || !email.contains('@')) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter a valid email'),
                    backgroundColor: Color(0xFFBA1A1A),
                  ),
                );
                return;
              }
              Navigator.pop(ctx);
              await _inviteEmployee(email);
            },
            child: const Text('Invite'),
          ),
        ],
      ),
    );
  }

  Future<void> _inviteEmployee(String email) async {
    if (_orgId == null) return;
    try {
      // Check if a profile with this email already exists in the org
      final existing = await Supabase.instance.client
          .from('profiles')
          .select('id')
          .eq('email', email)
          .eq('organization_id', _orgId!)
          .maybeSingle();

      if (existing != null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('This employee is already in your organization'),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
        return;
      }

      // Update profile if it exists (user signed up but not in org)
      // or show a message that the user needs to sign up first
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

      if (profile != null) {
        await Supabase.instance.client
            .from('profiles')
            .update({'organization_id': _orgId!})
            .eq('id', profile['id']);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Employee added to organization'),
              backgroundColor: Color(0xFF059669),
            ),
          );
          _loadEmployees().then((_) {
            if (mounted) setState(() {});
          });
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'No account found. The user must sign up first, then you can add them.'),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to invite: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  void _showAddProjectDialog() {
    final codeController = TextEditingController();
    final nameController = TextEditingController();
    final clientController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Add Project',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: codeController,
              decoration: const InputDecoration(labelText: 'Project Code'),
              textCapitalization: TextCapitalization.characters,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Project Name'),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: clientController,
              decoration: const InputDecoration(labelText: 'Client Name'),
              textCapitalization: TextCapitalization.words,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final code = codeController.text.trim();
              final name = nameController.text.trim();
              final client = clientController.text.trim();
              if (code.isEmpty || name.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Code and name are required'),
                    backgroundColor: Color(0xFFBA1A1A),
                  ),
                );
                return;
              }
              Navigator.pop(ctx);
              await _addProject(code, name, client);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _addProject(String code, String name, String client) async {
    if (_orgId == null) return;
    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      await Supabase.instance.client.from('projects').insert({
        'organization_id': _orgId!,
        'project_code': code,
        'project_name': name,
        if (client.isNotEmpty) 'client_name': client,
        if (userId != null) 'created_by': userId,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Project added'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        _loadProjects().then((_) {
          if (mounted) setState(() {});
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add project: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  Future<void> _deleteProject(String projectId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Project',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        content: const Text(
          'Are you sure you want to delete this project? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
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
      await Supabase.instance.client
          .from('projects')
          .delete()
          .eq('id', projectId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Project deleted'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        _loadProjects().then((_) {
          if (mounted) setState(() {});
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete project: $e'),
            backgroundColor: const Color(0xFFBA1A1A),
          ),
        );
      }
    }
  }

  Future<void> _saveTallySettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'tally_payment_ledger',
      _paymentLedgerController.text.trim(),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tally settings saved'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadAll,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              title: const Text(
                'Admin Settings',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E),
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFF006699)),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // ── Organization Info ───────────────────────────
                    _sectionHeader('ORGANIZATION INFO'),
                    const SizedBox(height: 8),
                    _buildOrgCard(),
                    const SizedBox(height: 24),

                    // ── Employee Management ────────────────────────
                    _sectionHeaderWithAction(
                      'EMPLOYEE MANAGEMENT',
                      'Add Employee',
                      _showInviteDialog,
                    ),
                    const SizedBox(height: 8),
                    if (_employees.isEmpty)
                      _buildEmptyCard(
                        Icons.people_outline,
                        'No employees found',
                      )
                    else
                      _buildEmployeeList(),
                    const SizedBox(height: 24),

                    // ── Project Management ─────────────────────────
                    _sectionHeaderWithAction(
                      'PROJECT MANAGEMENT',
                      'Add Project',
                      _showAddProjectDialog,
                    ),
                    const SizedBox(height: 8),
                    if (_projects.isEmpty)
                      _buildEmptyCard(
                        Icons.folder_outlined,
                        'No projects found',
                      )
                    else
                      _buildProjectList(),
                    const SizedBox(height: 24),

                    // ── Tally Settings ─────────────────────────────
                    _sectionHeader('TALLY SETTINGS'),
                    const SizedBox(height: 8),
                    _buildTallyCard(),
                    const SizedBox(height: 32),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Section Headers ────────────────────────────────────────────────────

  Widget _sectionHeader(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Color(0xFF9CA3AF),
      ),
    );
  }

  Widget _sectionHeaderWithAction(
    String label,
    String actionLabel,
    VoidCallback onAction,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: Color(0xFF9CA3AF),
          ),
        ),
        GestureDetector(
          onTap: onAction,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.add_circle_outline,
                  size: 16, color: Color(0xFF006699)),
              const SizedBox(width: 4),
              Text(
                actionLabel,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF006699),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Organization Card ──────────────────────────────────────────────────

  Widget _buildOrgCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          _infoRow(Icons.business, 'Organization', _orgName.isEmpty ? '-' : _orgName),
          const Divider(height: 20, color: Color(0xFFF3F4F6)),
          _infoRow(Icons.language, 'Domain', _orgDomain.isEmpty ? '-' : _orgDomain),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFF006699).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: const Color(0xFF006699)),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
                color: Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF191C1E),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── Employee List ──────────────────────────────────────────────────────

  Widget _buildEmployeeList() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: List.generate(_employees.length, (i) {
          final emp = _employees[i];
          final name = emp['name'] as String? ?? 'Unknown';
          final email = emp['email'] as String? ?? '';
          final empId = emp['employee_id'] as String? ?? '';
          final role = emp['role'] as String? ?? 'employee';
          final profileId = emp['id'] as String;

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    // Avatar
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFF006699).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Text(
                          name
                              .split(' ')
                              .map((w) => w.isNotEmpty ? w[0] : '')
                              .take(2)
                              .join()
                              .toUpperCase(),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF006699),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Name & email
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF191C1E),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            email,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (empId.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              empId,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Role dropdown
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _roles.contains(role) ? role : 'employee',
                          isDense: true,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF006699),
                          ),
                          icon: const Icon(
                            Icons.expand_more,
                            size: 16,
                            color: Color(0xFF006699),
                          ),
                          items: _roles.map((r) {
                            return DropdownMenuItem(
                              value: r,
                              child: Text(
                                r[0].toUpperCase() + r.substring(1),
                              ),
                            );
                          }).toList(),
                          onChanged: (newRole) {
                            if (newRole != null && newRole != role) {
                              _changeRole(profileId, newRole);
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (i < _employees.length - 1)
                const Divider(
                  height: 1,
                  indent: 68,
                  color: Color(0xFFF3F4F6),
                ),
            ],
          );
        }),
      ),
    );
  }

  // ── Project List ───────────────────────────────────────────────────────

  Widget _buildProjectList() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: List.generate(_projects.length, (i) {
          final proj = _projects[i];
          final code = proj['project_code'] as String? ?? '';
          final name = proj['project_name'] as String? ?? '';
          final client = proj['client_name'] as String? ?? '';
          final projId = proj['id'] as String;

          return Column(
            children: [
              GestureDetector(
                onLongPress: () => _deleteProject(projId),
                child: Dismissible(
                  key: ValueKey(projId),
                  direction: DismissDirection.endToStart,
                  confirmDismiss: (_) async {
                    _deleteProject(projId);
                    return false; // We handle deletion in _deleteProject
                  },
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFBA1A1A),
                      borderRadius: i == 0 && _projects.length == 1
                          ? BorderRadius.circular(16)
                          : i == 0
                              ? const BorderRadius.vertical(
                                  top: Radius.circular(16))
                              : i == _projects.length - 1
                                  ? const BorderRadius.vertical(
                                      bottom: Radius.circular(16))
                                  : BorderRadius.zero,
                    ),
                    child: const Icon(
                      Icons.delete_outline,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        // Code badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF006699)
                                .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            code,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006699),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Name & client
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF191C1E),
                                ),
                              ),
                              if (client.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  client,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF9CA3AF),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        // Delete hint
                        const Icon(
                          Icons.chevron_left,
                          size: 16,
                          color: Color(0xFFD1D5DB),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (i < _projects.length - 1)
                const Divider(
                  height: 1,
                  indent: 16,
                  color: Color(0xFFF3F4F6),
                ),
            ],
          );
        }),
      ),
    );
  }

  // ── Tally Card ─────────────────────────────────────────────────────────

  Widget _buildTallyCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payment Ledger Name',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _paymentLedgerController,
            decoration: InputDecoration(
              hintText: 'e.g., Cash in Hand, Bank Account',
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF9CA3AF),
              ),
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saveTallySettings,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006699),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: const Text(
                'Save',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Empty Card ─────────────────────────────────────────────────────────

  Widget _buildEmptyCard(IconData icon, String message) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: const Color(0xFF9CA3AF)),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}
