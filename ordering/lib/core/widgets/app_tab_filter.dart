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
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final isSelected = selectedTab == tab;

          return Center(
            child: GestureDetector(
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
            ),
          );
        },
      ),
    );
  }
}