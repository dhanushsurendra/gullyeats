import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';

/// Shown on Enable Location when the cart is right next to a main road
/// (backend utils/mainRoads.js). A risk hint for staff, never a ruling on
/// whether the spot is allowed, and it never blocks onboarding.
class MainRoadWarning extends StatelessWidget {
  /// The road's name, or '' when OpenStreetMap has none.
  final String road;

  const MainRoadWarning({super.key, required this.road});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.error),
          AppGaps.w12,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  road.isEmpty
                      ? 'Near a main road'
                      : 'Near a main road · $road',
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
                AppGaps.h4,
                Text(
                  'Eviction drives and footpath clearances are common on main '
                  'roads. If the vendor can, an inner lane is usually safer.',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
