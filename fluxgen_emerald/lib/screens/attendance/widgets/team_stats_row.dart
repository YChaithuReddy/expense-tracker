import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/fluxgen_status.dart';

/// Tappable 2×2 grid of stat cards. Tapping a card sets the filter;
/// tapping the already-selected card clears it (null).
class TeamStatsRow extends StatelessWidget {
  const TeamStatsRow({
    super.key,
    required this.onSiteCount,
    required this.inOfficeCount,
    required this.onLeaveCount,
    required this.availableCount,
    required this.activeFilter,
    required this.onFilter,
  });

  final int onSiteCount;
  final int inOfficeCount;
  final int onLeaveCount;
  final int availableCount;

  /// When non-null, that stat is considered selected. `available` is
  /// represented by `AttendanceStatus.unknown`.
  final AttendanceStatus? activeFilter;
  final void Function(AttendanceStatus? status) onFilter;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      // 2.0 gives ~119px card height — fits the 22pt number + 11pt label
      // without the 8.8px overflow we saw at 2.4.
      childAspectRatio: 2.0,
      children: [
        _card(context, AttendanceStatus.onSite,       'On Site',    onSiteCount),
        _card(context, AttendanceStatus.inOffice,     'In Office',  inOfficeCount),
        _card(context, AttendanceStatus.onLeave,      'On Leave',   onLeaveCount),
        _card(context, AttendanceStatus.unknown,      'Available',  availableCount),
      ],
    );
  }

  Widget _card(BuildContext context, AttendanceStatus status, String label, int count) {
    final color = AppColors.forAttendanceStatus(status);
    final isActive = activeFilter == status;
    return Material(
      color: isActive
          ? color.withValues(alpha: 0.18)
          : Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onFilter(isActive ? null : status);
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isActive ? color : Colors.transparent,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 32,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$count',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
