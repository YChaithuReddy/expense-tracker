import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../services/activity_log_service.dart';

class AdvanceFormSheet extends StatefulWidget {
  const AdvanceFormSheet({super.key});

  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const AdvanceFormSheet(),
    );
  }

  @override
  State<AdvanceFormSheet> createState() => _AdvanceFormSheetState();
}

class _AdvanceFormSheetState extends State<AdvanceFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _projectNameController = TextEditingController();
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();

  static const _visitTypes = ['Project', 'Service', 'Survey'];
  int _selectedVisitType = 0;
  bool _isSubmitting = false;

  String? _organizationId;
  List<Map<String, dynamic>> _managers = [];
  List<Map<String, dynamic>> _accountants = [];
  String? _selectedManagerId;
  String? _selectedAccountantId;
  bool _loadingOrg = true;

  @override
  void initState() {
    super.initState();
    _loadOrgMembers();
  }

  Future<void> _loadOrgMembers() async {
    try {
      final user = Supabase.instance.client.auth.currentUser!;
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

      final orgId = profile?['organization_id'] as String?;
      if (orgId == null) {
        if (mounted) setState(() => _loadingOrg = false);
        return;
      }

      final members = await Supabase.instance.client
          .from('profiles')
          .select('id, name, email, role')
          .eq('organization_id', orgId)
          .inFilter('role', ['manager', 'accountant', 'admin']);

      if (mounted) {
        setState(() {
          _organizationId = orgId;
          _managers = List<Map<String, dynamic>>.from(members)
              .where((m) => m['role'] == 'manager' || m['role'] == 'admin').toList();
          _accountants = List<Map<String, dynamic>>.from(members)
              .where((a) => a['role'] == 'accountant' || a['role'] == 'admin').toList();
          _loadingOrg = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingOrg = false);
    }
  }

  @override
  void dispose() {
    _projectNameController.dispose();
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_organizationId != null && _selectedManagerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a manager'), backgroundColor: Color(0xFFBA1A1A)),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      final amount = double.parse(_amountController.text.trim().replaceAll(',', ''));

      // Status logic matches web: pending_manager only if BOTH manager AND accountant selected
      final isCompanyWithApprovers = _selectedManagerId != null && _selectedAccountantId != null;
      final status = isCompanyWithApprovers ? 'pending_manager' : 'active';

      final data = <String, dynamic>{
        'user_id': userId,
        'project_name': _projectNameController.text.trim(),
        'amount': amount,
        'visit_type': _visitTypes[_selectedVisitType].toLowerCase(),
        'notes': _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        'status': status,
        if (isCompanyWithApprovers) 'submitted_at': DateTime.now().toUtc().toIso8601String(),
        if (_organizationId != null) 'organization_id': _organizationId,
        if (_selectedManagerId != null) 'manager_id': _selectedManagerId,
        if (_selectedAccountantId != null) 'accountant_id': _selectedAccountantId,
      };

      final inserted = await Supabase.instance.client.from('advances').insert(data).select().single();

      // Insert advance_history
      try {
        await Supabase.instance.client.from('advance_history').insert({
          'advance_id': inserted['id'],
          'action': 'submitted',
          'acted_by': userId,
        });
      } catch (_) {}

      if (!mounted) return;

      // Log activity
      final logAmount = _amountController.text.trim();
      final logProject = _projectNameController.text.trim();
      ActivityLogService.log('advance_submitted', 'Requested advance \u20B9$logAmount for $logProject');

      // Notify the manager
      if (_selectedManagerId != null) {
        try {
          await Supabase.instance.client.from('notifications').insert({
            'user_id': _selectedManagerId,
            'type': 'advance_submitted',
            'title': 'New advance request',
            'message': 'Advance of \u20B9${amount.toStringAsFixed(0)} for ${_projectNameController.text.trim()} needs approval.',
            'is_read': false,
            'reference_id': inserted['id'],
            'reference_type': 'advance',
          });
        } catch (_) {}
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Advance request submitted successfully'),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );

      if (!mounted) return;
      Navigator.pop(context, true);
    } on PostgrestException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Database error: ${e.message}'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isCompanyMode = _organizationId != null;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2)),
                )),
                const SizedBox(height: 20),
                const Text('Request Advance', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF191C1E), letterSpacing: -0.3)),
                const SizedBox(height: 4),
                const Text('Fill in the details for your advance request', style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 24),

                if (_loadingOrg)
                  const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
                else ...[
                  // Project Name
                  _buildLabel('Project Name'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _projectNameController,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDecoration(hint: 'e.g. Site Survey - Hyderabad', icon: Icons.folder_outlined),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Project name is required' : null,
                  ),
                  const SizedBox(height: 20),

                  // Amount
                  _buildLabel('Amount'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textInputAction: TextInputAction.next,
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))],
                    decoration: _inputDecoration(hint: '0.00', icon: Icons.currency_rupee),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Amount is required';
                      final amt = double.tryParse(v.trim().replaceAll(',', ''));
                      if (amt == null || amt <= 0) return 'Enter a valid amount';
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),

                  // Visit Type
                  _buildLabel('Visit Type'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.all(4),
                    child: Row(children: List.generate(_visitTypes.length, (i) {
                      final selected = _selectedVisitType == i;
                      return Expanded(child: GestureDetector(
                        onTap: () => setState(() => _selectedVisitType = i),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: selected ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: selected ? [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))] : null,
                          ),
                          child: Text(_visitTypes[i], textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w600 : FontWeight.w500, color: selected ? const Color(0xFF006699) : const Color(0xFF9CA3AF))),
                        ),
                      ));
                    })),
                  ),
                  const SizedBox(height: 20),

                  // Manager & Accountant dropdowns (company mode only)
                  if (isCompanyMode) ...[
                    _buildLabel('Approving Manager *'),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedManagerId,
                          isExpanded: true,
                          hint: const Text('Select manager', style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
                          items: _managers.map((m) => DropdownMenuItem<String>(
                            value: m['id'] as String,
                            child: Text('${m['name']} (${m['email']})', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                          )).toList(),
                          onChanged: (v) => setState(() => _selectedManagerId = v),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    _buildLabel('Verifying Accountant'),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedAccountantId,
                          isExpanded: true,
                          hint: const Text('Select accountant (optional)', style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
                          items: _accountants.map((a) => DropdownMenuItem<String>(
                            value: a['id'] as String,
                            child: Text('${a['name']} (${a['email']})', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                          )).toList(),
                          onChanged: (v) => setState(() => _selectedAccountantId = v),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Notes
                  _buildLabel('Notes'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _notesController,
                    maxLines: 3,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: _inputDecoration(hint: 'Additional details (optional)', icon: Icons.notes_outlined),
                  ),
                  const SizedBox(height: 28),

                  // Submit
                  SizedBox(
                    width: double.infinity, height: 52,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF006699), Color(0xFF1E40AF)]),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [BoxShadow(color: const Color(0xFF006699).withValues(alpha: 0.25), blurRadius: 12, offset: const Offset(0, 4))],
                      ),
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submit,
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        child: _isSubmitting
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                            : const Text('Submit Request', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.3)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) => Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF444653)));

  InputDecoration _inputDecoration({required String hint, required IconData icon}) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20, color: const Color(0xFF9CA3AF)),
      filled: true,
      fillColor: const Color(0xFFF3F4F6),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF006699), width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFBA1A1A), width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}
