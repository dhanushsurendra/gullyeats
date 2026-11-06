import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_spacing.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

class AppTabFilter extends StatelessWidget {
  final List<String> tabs;
  final String selectedTab;
  final Function(String) onTabSelected;
  final List<String>? navTabs;

  /// The text shown for a tab, when the tab value is an internal key.
  final String Function(String tab)? labelOf;

  const AppTabFilter({
    super.key,
    required this.tabs,
    required this.selectedTab,
    required this.onTabSelected,
    this.navTabs,
    this.labelOf,
  });

  @override
  Widget build(BuildContext context) {
    // No fixed height: the chips grow with large system text.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final (index, tab) in tabs.indexed) ...[
            if (index > 0) const SizedBox(width: 10),
            _chip(tab, selectedTab == tab),
          ],
        ],
      ),
    );
  }

  Widget _chip(String tab, bool isSelected) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onTabSelected(tab),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.grey200,
          ),
        ),
        child: Text(
          labelOf?.call(tab) ?? tab,
          style: AppTextStyles.body.copyWith(
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected ? AppColors.white : AppColors.grey600,
          ),
        ),
      ),
    );
  }
}
