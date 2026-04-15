import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/fluxgen_status.dart';
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
      backgroundColor: const Color(0xFFF6F8FB),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _HeroHeader(isAdmin: isAdmin, mode: mode),
            _TabsBar(
              controller: _tab,
              tabs: const ['Update', 'Weekly', 'Team'],
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
      ),
    );
  }
}

// ─── Hero header: greeting + today's status chip + admin toggle ─────────────

class _HeroHeader extends ConsumerWidget {
  const _HeroHeader({required this.isAdmin, required this.mode});
  final bool isAdmin;
  final ViewMode mode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final myEmpId = ref.watch(myEmpIdProvider);
    final statusAsync = ref.watch(todayStatusProvider(fluxgenTodayStr()));
    StatusEntry? my;
    final entries = statusAsync.valueOrNull;
    if (entries != null && myEmpId != null) {
      for (final e in entries) {
        if (e.empId == myEmpId) {
          my = e;
          break;
        }
      }
    }

    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(18),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                visualDensity: VisualDensity.compact,
                onPressed: () => Navigator.maybePop(context),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Attendance',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                  ),
                ),
              ),
              if (isAdmin) _AdminModePill(mode: mode),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            greeting,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.75),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 4),
          _TodayLine(entry: my),
        ],
      ),
    );
  }
}

class _TodayLine extends StatelessWidget {
  const _TodayLine({required this.entry});
  final StatusEntry? entry;

  @override
  Widget build(BuildContext context) {
    if (entry == null) {
      return Row(
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 4, right: 8),
            decoration: const BoxDecoration(
              color: Color(0xFFF59E0B),
              shape: BoxShape.circle,
            ),
          ),
          const Expanded(
            child: Text(
              "Let's log today's status",
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
              ),
            ),
          ),
        ],
      );
    }
    final color = AppColors.forAttendanceStatus(entry!.status);
    final detail = <String>[];
    if (entry!.siteName.isNotEmpty) detail.add(entry!.siteName);
    if (entry!.workType.isNotEmpty) detail.add(entry!.workType);
    final subtitle = detail.isEmpty ? entry!.date : detail.join(' · ');

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.5), width: 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                entry!.status.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            subtitle,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _AdminModePill extends ConsumerWidget {
  const _AdminModePill({required this.mode});
  final ViewMode mode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAdmin = mode == ViewMode.admin;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => ref.read(viewModeProvider.notifier).state =
            isAdmin ? ViewMode.employee : ViewMode.admin,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isAdmin
                ? Colors.white
                : Colors.white.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isAdmin ? Icons.groups : Icons.person_outline,
                size: 14,
                color: isAdmin ? AppColors.primary : Colors.white,
              ),
              const SizedBox(width: 6),
              Text(
                isAdmin ? 'Admin' : 'Me',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: isAdmin ? AppColors.primary : Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Tabs bar with pill-style indicator ─────────────────────────────────────

class _TabsBar extends StatelessWidget {
  const _TabsBar({required this.controller, required this.tabs});
  final TabController controller;
  final List<String> tabs;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TabBar(
        controller: controller,
        labelColor: Colors.white,
        unselectedLabelColor: AppColors.onSurfaceVariant,
        labelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, Color(0xFF00456B)],
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        splashBorderRadius: BorderRadius.circular(12),
        tabs: [for (final t in tabs) Tab(text: t, height: 38)],
      ),
    );
  }
}
