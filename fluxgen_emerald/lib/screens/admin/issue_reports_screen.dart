import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import 'package:emerald/widgets/notification_bell.dart';

/// Admin screen to view, filter, and manage user-submitted issue reports.
class IssueReportsScreen extends StatefulWidget {
  const IssueReportsScreen({super.key});

  @override
  State<IssueReportsScreen> createState() => _IssueReportsScreenState();
}

class _IssueReportsScreenState extends State<IssueReportsScreen> {
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;
  String _statusFilter = 'all';

  static const _statuses = ['all', 'open', 'in_progress', 'resolved', 'closed'];
  final _dateFormat = DateFormat('dd MMM yyyy, hh:mm a');

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() => _loading = true);
    try {
      var query = Supabase.instance.client
          .from('issue_reports')
          .select('*, profiles!issue_reports_user_id_fkey(name, email, employee_id)')
          .order('created_at', ascending: false);

      if (_statusFilter != 'all') {
        query = Supabase.instance.client
            .from('issue_reports')
            .select('*, profiles!issue_reports_user_id_fkey(name, email, employee_id)')
            .eq('status', _statusFilter)
            .order('created_at', ascending: false);
      }

      final data = await query;

      if (mounted) {
        setState(() {
          _reports = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        // Fallback: try without FK join (table might not have FK)
        try {
          var query = Supabase.instance.client
              .from('issue_reports')
              .select()
              .order('created_at', ascending: false);

          if (_statusFilter != 'all') {
            query = Supabase.instance.client
                .from('issue_reports')
                .select()
                .eq('status', _statusFilter)
                .order('created_at', ascending: false);
          }

          final data = await query;
          if (mounted) {
            setState(() {
              _reports = List<Map<String, dynamic>>.from(data);
              _loading = false;
            });
          }
        } catch (_) {}
      }
    }
  }

  Future<void> _updateStatus(String reportId, String newStatus) async {
    try {
      await Supabase.instance.client
          .from('issue_reports')
          .update({'status': newStatus, 'updated_at': DateTime.now().toUtc().toIso8601String()})
          .eq('id', reportId);

      _loadReports();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated to ${newStatus.replaceAll('_', ' ')}'),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update failed: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'open':
        return const Color(0xFFEF4444);
      case 'in_progress':
        return const Color(0xFFF59E0B);
      case 'resolved':
        return const Color(0xFF059669);
      case 'closed':
        return const Color(0xFF6B7280);
      default:
        return const Color(0xFF9CA3AF);
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'open':
        return const Color(0xFFFEF2F2);
      case 'in_progress':
        return const Color(0xFFFFFBEB);
      case 'resolved':
        return const Color(0xFFECFDF5);
      case 'closed':
        return const Color(0xFFF3F4F6);
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  Color _categoryColor(String? category) {
    switch (category) {
      case 'Bug':
        return const Color(0xFFEF4444);
      case 'Feature Request':
        return const Color(0xFF8B5CF6);
      case 'Performance':
        return const Color(0xFFF59E0B);
      case 'UI Issue':
        return const Color(0xFF0EA5E9);
      default:
        return const Color(0xFF6B7280);
    }
  }

  IconData _categoryIcon(String? category) {
    switch (category) {
      case 'Bug':
        return Icons.bug_report;
      case 'Feature Request':
        return Icons.lightbulb_outline;
      case 'Performance':
        return Icons.speed;
      case 'UI Issue':
        return Icons.palette_outlined;
      default:
        return Icons.help_outline;
    }
  }

  void _showDetail(Map<String, dynamic> report) {
    final profile = report['profiles'] as Map<String, dynamic>?;
    final userName = profile?['name'] as String? ?? 'Unknown User';
    final userEmail = profile?['email'] as String? ?? report['user_id']?.toString().substring(0, 8) ?? '';
    final status = report['status'] as String? ?? 'open';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.95,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2)),
              )),
              const SizedBox(height: 20),

              // Title + category badge
              Row(
                children: [
                  Icon(_categoryIcon(report['category'] as String?), color: _categoryColor(report['category'] as String?), size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(report['title'] as String? ?? 'No title',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Category + status badges
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _categoryColor(report['category'] as String?).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(report['category'] as String? ?? 'Other',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _categoryColor(report['category'] as String?))),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(6)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: _statusColor(status), shape: BoxShape.circle)),
                        const SizedBox(width: 4),
                        Text(status.toUpperCase().replaceAll('_', ' '),
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: _statusColor(status))),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Reporter info
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(10)),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline, size: 18, color: Color(0xFF6B7280)),
                    const SizedBox(width: 8),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(userName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF191C1E))),
                        Text(userEmail, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                      ],
                    )),
                    Text(_formatDate(report['created_at'] as String?),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Description
              const Text('DESCRIPTION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
              const SizedBox(height: 6),
              Text(report['description'] as String? ?? 'No description',
                  style: const TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF444653))),
              const SizedBox(height: 16),

              // Device info
              const Text('DEVICE INFO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
              const SizedBox(height: 6),
              _detailRow('Device', report['device_model'] as String? ?? 'N/A'),
              _detailRow('OS', report['os_version'] as String? ?? 'N/A'),
              _detailRow('App Version', report['app_version'] as String? ?? 'N/A'),

              // Screenshot
              if (report['screenshot_url'] != null && (report['screenshot_url'] as String).isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('SCREENSHOT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(report['screenshot_url'] as String, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Text('Failed to load screenshot')),
                ),
              ],

              const SizedBox(height: 24),

              // Status update buttons
              const Text('UPDATE STATUS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF9CA3AF))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: ['open', 'in_progress', 'resolved', 'closed'].map((s) {
                  final isActive = status == s;
                  return ChoiceChip(
                    label: Text(s.replaceAll('_', ' ').toUpperCase(),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                            color: isActive ? Colors.white : _statusColor(s))),
                    selected: isActive,
                    selectedColor: _statusColor(s),
                    backgroundColor: _statusBg(s),
                    side: BorderSide.none,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    showCheckmark: false,
                    onSelected: isActive
                        ? null
                        : (_) {
                            Navigator.pop(ctx);
                            _updateStatus(report['id'].toString(), s);
                          },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    try {
      return _dateFormat.format(DateTime.parse(iso).toLocal());
    } catch (_) {
      return '';
    }
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(width: 90, child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280)))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12, color: Color(0xFF444653)))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final openCount = _reports.where((r) => r['status'] == 'open').length;
    final inProgressCount = _reports.where((r) => r['status'] == 'in_progress').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        onRefresh: _loadReports,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              backgroundColor: Colors.white.withValues(alpha: 0.95),
              surfaceTintColor: Colors.transparent,
              title: const Text('Issue Reports',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1E))),
              actions: const [NotificationBell()],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Stats row
                  Row(
                    children: [
                      _statCard('Open', '$openCount', const Color(0xFFEF4444)),
                      const SizedBox(width: 10),
                      _statCard('In Progress', '$inProgressCount', const Color(0xFFF59E0B)),
                      const SizedBox(width: 10),
                      _statCard('Total', '${_reports.length}', const Color(0xFF006699)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Filter chips
                  SizedBox(
                    height: 36,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _statuses.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, index) {
                        final status = _statuses[index];
                        final isSelected = _statusFilter == status;
                        return ChoiceChip(
                          label: Text(
                            status == 'all' ? 'All' : status.replaceAll('_', ' ').toUpperCase(),
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : const Color(0xFF444653)),
                          ),
                          selected: isSelected,
                          selectedColor: const Color(0xFF006699),
                          backgroundColor: Colors.white,
                          side: isSelected ? BorderSide.none : const BorderSide(color: Color(0xFFE5E7EB)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          showCheckmark: false,
                          onSelected: (_) {
                            setState(() => _statusFilter = status);
                            _loadReports();
                          },
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Reports list
                  if (_loading)
                    const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                  else if (_reports.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: const Column(children: [
                        Icon(Icons.check_circle_outline, size: 48, color: Color(0xFF059669)),
                        SizedBox(height: 12),
                        Text('No reports found', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                        SizedBox(height: 4),
                        Text('All clear!', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                      ]),
                    )
                  else
                    ...List.generate(_reports.length, (i) {
                      final report = _reports[i];
                      final status = report['status'] as String? ?? 'open';
                      final category = report['category'] as String?;
                      final profile = report['profiles'] as Map<String, dynamic>?;
                      final userName = profile?['name'] as String? ?? 'User';

                      return Padding(
                        padding: EdgeInsets.only(bottom: i < _reports.length - 1 ? 10 : 0),
                        child: GestureDetector(
                          onTap: () => _showDetail(report),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [BoxShadow(color: const Color(0xFF191C1E).withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 4))],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(_categoryIcon(category), size: 18, color: _categoryColor(category)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(report['title'] as String? ?? 'No title',
                                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF191C1E)),
                                          maxLines: 1, overflow: TextOverflow.ellipsis),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(6)),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(width: 5, height: 5, decoration: BoxDecoration(color: _statusColor(status), shape: BoxShape.circle)),
                                          const SizedBox(width: 4),
                                          Text(status.toUpperCase().replaceAll('_', ' '),
                                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _statusColor(status))),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(report['description'] as String? ?? '',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                                    maxLines: 2, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Text(userName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF9CA3AF))),
                                    const SizedBox(width: 8),
                                    Text('•', style: TextStyle(color: const Color(0xFF9CA3AF).withValues(alpha: 0.5))),
                                    const SizedBox(width: 8),
                                    Text(report['device_model'] as String? ?? '', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                                    const Spacer(),
                                    Text(_formatDate(report['created_at'] as String?),
                                        style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                                  ],
                                ),
                                if (report['screenshot_url'] != null && (report['screenshot_url'] as String).isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Row(
                                      children: [
                                        Icon(Icons.image, size: 14, color: const Color(0xFF006699).withValues(alpha: 0.6)),
                                        const SizedBox(width: 4),
                                        Text('Screenshot attached', style: TextStyle(fontSize: 10, color: const Color(0xFF006699).withValues(alpha: 0.6))),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}
