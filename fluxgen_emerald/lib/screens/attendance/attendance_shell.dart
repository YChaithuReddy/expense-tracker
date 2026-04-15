import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/fluxgen_provider.dart';
import 'attendance_team_tab.dart';
import 'attendance_update_tab.dart';
import 'attendance_weekly_tab.dart';

class AttendanceShell extends ConsumerStatefulWidget {
  const AttendanceShell({super.key});
  @override
  ConsumerState<AttendanceShell> createState() => _AttendanceShellState();
}

class _AttendanceShellState extends ConsumerState<AttendanceShell>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final isAdmin = profileAsync.valueOrNull?.isAdmin ?? false;
    final mode = ref.watch(viewModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        bottom: TabBar(
          controller: _tab,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.onSurfaceVariant,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Update'),
            Tab(text: 'Weekly'),
            Tab(text: 'Team'),
          ],
        ),
      ),
      body: Column(
        children: [
          if (isAdmin)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: SegmentedButton<ViewMode>(
                      segments: const [
                        ButtonSegment(
                          value: ViewMode.employee,
                          icon: Icon(Icons.person_outline, size: 18),
                          label: Text('My view'),
                        ),
                        ButtonSegment(
                          value: ViewMode.admin,
                          icon: Icon(Icons.groups_outlined, size: 18),
                          label: Text('Admin'),
                        ),
                      ],
                      selected: {mode},
                      onSelectionChanged: (s) => ref
                          .read(viewModeProvider.notifier)
                          .state = s.first,
                      style: SegmentedButton.styleFrom(
                        selectedBackgroundColor: AppColors.primary,
                        selectedForegroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tab,
              children: [
                AttendanceUpdateTab(isAdmin: isAdmin),
                AttendanceWeeklyTab(isAdmin: isAdmin),
                AttendanceTeamTab(isAdmin: isAdmin),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
