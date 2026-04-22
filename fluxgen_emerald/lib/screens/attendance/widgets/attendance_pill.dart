import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../providers/fluxgen_provider.dart';
import '../attendance_shell.dart';

/// Floating attendance pill shown on Home (employee) and Overview (admin).
///
/// Two visual states:
/// - **Submitted** — deep-primary gradient, white text, steady green dot.
///   Signals "all good, nothing to do".
/// - **Pending** — white surface + amber accent + calendar glyph.
///   Before 10 AM the dot pulses to nudge the user.
/// Tap → pushes AttendanceShell route.
class AttendancePill extends ConsumerWidget {
  const AttendancePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = fluxgenTodayStr();
    final statusAsync = ref.watch(todayStatusProvider(today));
    final myEmpId = ref.watch(myEmpIdProvider);

    final submitted = statusAsync.valueOrNull?.any(
          (e) => myEmpId != null && e.empId == myEmpId,
        ) ??
        false;
    final shouldPulse = !submitted && DateTime.now().hour < 10;

    return Positioned(
      bottom: 88, // above the bottom nav (56px nav + 16px safe + 16px gap)
      right: 16,
      child: SafeArea(
        child: _PillBody(submitted: submitted, pulse: shouldPulse),
      ),
    );
  }
}

class _PillBody extends StatelessWidget {
  const _PillBody({required this.submitted, required this.pulse});
  final bool submitted;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    // Colour palette — two distinct states tied to primary + status colors.
    final gradient = submitted
        ? const LinearGradient(
            colors: [AppColors.primary, Color(0xFF00456B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : const LinearGradient(
            colors: [Color(0xFFFFFBEB), Color(0xFFFFF5D6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );
    final textColor = submitted ? Colors.white : const Color(0xFF6B4A00);
    final subText = submitted ? Colors.white.withValues(alpha: 0.78)
                              : const Color(0xFFB45309);
    final glowColor = submitted
        ? AppColors.primary.withValues(alpha: 0.35)
        : const Color(0xFFF59E0B).withValues(alpha: 0.30);
    final borderColor = submitted
        ? Colors.white.withValues(alpha: 0.18)
        : const Color(0xFFF59E0B).withValues(alpha: 0.35);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AttendanceShell()),
          );
        },
        borderRadius: BorderRadius.circular(26),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(26),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                gradient: gradient,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: borderColor, width: 1.2),
                boxShadow: [
                  BoxShadow(
                    color: glowColor,
                    blurRadius: 20,
                    spreadRadius: 0,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _StatusDot(submitted: submitted, pulse: pulse),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Attendance',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                          color: textColor,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        submitted ? 'Marked for today' : 'Tap to mark',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                          color: subText,
                          height: 1.1,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Icon(
                    submitted
                        ? Icons.check_circle_rounded
                        : Icons.arrow_forward_rounded,
                    size: 15,
                    color: submitted
                        ? const Color(0xFF10B981)
                        : const Color(0xFFB45309),
                  ),
                ],
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
    final dotColor =
        submitted ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    // Halo ring — gives the dot physical presence against the gradient.
    Widget dot = Container(
      width: 11,
      height: 11,
      decoration: BoxDecoration(
        color: dotColor,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: dotColor.withValues(alpha: 0.55),
            blurRadius: 8,
            spreadRadius: 1,
          ),
        ],
      ),
    );
    if (pulse) {
      dot = dot
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scaleXY(
              begin: 1.0,
              end: 1.45,
              duration: 900.ms,
              curve: Curves.easeInOut);
    }
    return dot;
  }
}
