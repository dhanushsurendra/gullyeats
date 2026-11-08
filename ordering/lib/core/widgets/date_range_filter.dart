import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_tab_filter.dart';
import 'package:ordering/l10n/l10n.dart';

/// Start and end date boxes plus quick presets ("Today", "Last 7 Days", ...).
/// [presets] are keys for `rangeLabel`; [selectedPreset] is null after the
/// user picks dates by hand.
class DateRangeFilter extends StatelessWidget {
  final DateTime start;
  final DateTime end;
  final List<String> presets;
  final String? selectedPreset;
  final void Function(bool isStart) onPickDate;
  final ValueChanged<String> onPreset;

  const DateRangeFilter({
    super.key,
    required this.start,
    required this.end,
    required this.presets,
    required this.selectedPreset,
    required this.onPickDate,
    required this.onPreset,
  });

  @override
  Widget build(BuildContext context) {
    final format = DateFormat(
      'dd MMM yyyy',
      Localizations.localeOf(context).languageCode,
    );

    Widget dateBox(DateTime date, bool isStart) => InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onPickDate(isStart),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.grey200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.grey500),
            AppGaps.w8,
            Expanded(
              child: Text(
                format.format(date),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body,
              ),
            ),
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.dateRange, style: AppTextStyles.heading3),
        AppGaps.h8,
        Row(
          children: [
            Expanded(child: dateBox(start, true)),
            AppGaps.w8,
            Expanded(child: dateBox(end, false)),
          ],
        ),
        AppGaps.h12,
        AppTabFilter(
          tabs: presets,
          labelOf: context.l10n.rangeLabel,
          selectedTab: selectedPreset ?? '',
          onTabSelected: onPreset,
        ),
      ],
    );
  }
}
