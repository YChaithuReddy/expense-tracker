import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../providers/fluxgen_provider.dart';
import '../attendance_shell.dart';

/// Glassmorphic floating pill shown on Home (employee) and Overview (admin).
/// - Green dot: today's status submitted
/// - Amber dot: not submitted; pulses if before 10 AM
/// Tap → pushes AttendanceShell route.
class AttendancePill extends ConsumerWidget {
  const AttendancePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today      = fluxgenTodayStr();
    final statusAsync = ref.watch(todayStatusProvider(today));
    final myEmpId    = ref.watch(myEmpIdProvider);

    final submitted = statusAsync.valueOrNull?.any(
          (e) => myEmpId != null && e.empId == myEmpId,
        ) ??
        false;
    final shouldPulse = !submitted && DateTime.now().hour < 10;

    return Positioned(
      bottom: 88, // above the bottom nav (56px nav + 16px safe + 16px gap)
      right: 16,
      child: SafeArea(
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AttendanceShell()),
              );
            },
            borderRadius: BorderRadius.circular(28),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.4),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.18),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _StatusDot(submitted: submitted, pulse: shouldPulse),
                      const SizedBox(width: 10),
                      Text(
                        'Attendance',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.submitted, required this.pulse});
  final bool submitted;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    final color = submitted
        ? const Color(0xFF10B981)
        : const Color(0xFFF59E0B);
    Widget dot = Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    if (pulse) {
      dot = dot
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scaleXY(
              begin: 1.0, end: 1.5, duration: 900.ms, curve: Curves.easeInOut);
    }
    return dot;
  }
}
