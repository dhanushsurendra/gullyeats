import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

/// The grey hint box used across the app: one line per entry, each led by
/// [icon]. For notes and short lists, not for errors (use AppSnackBar).
class InfoBox extends StatelessWidget {
  final List<String> lines;
  final IconData icon;

  const InfoBox({super.key, required this.lines, this.icon = Icons.info_outline});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          for (final (i, line) in lines.indexed) ...[
            if (i > 0) AppGaps.h12,
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 18, color: AppColors.primary),
                AppGaps.w12,
                Expanded(
                  child: Text(
                    line,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.grey600,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
