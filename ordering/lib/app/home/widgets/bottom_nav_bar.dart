import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        child: Container(
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(35),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 20,
                spreadRadius: 2,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(
                index: 0,
                outlinedIcon: CupertinoIcons.graph_square,
                filledIcon: CupertinoIcons.graph_square_fill,
                label: "Sales",
              ),
              _navItem(
                index: 1,
                outlinedIcon: CupertinoIcons.bag,
                filledIcon: CupertinoIcons.bag_fill,
                label: "Orders",
              ),
              _navItem(
                index: 2,
                outlinedIcon: CupertinoIcons.person,
                filledIcon: CupertinoIcons.person_fill,
                label: "Profile",
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem({
    required int index,
    required IconData outlinedIcon,
    required IconData filledIcon,
    required String label,
  }) {
    final isActive = currentIndex == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        behavior: HitTestBehavior.opaque,
        child: TweenAnimationBuilder<double>(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOutCubic,
          tween: Tween(begin: 0.0, end: isActive ? 1.0 : 0.0),
          builder: (context, value, child) {
            final color = Color.lerp(
              AppColors.grey400,
              AppColors.primary,
              value,
            )!;

            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Transform.scale(
                  scale: 1 + (0.12 * value),
                  child: Icon(
                    value > 0.5 ? filledIcon : outlinedIcon,
                    color: color,
                    size: 24,
                    shadows: [
                      Shadow(
                        blurRadius: value * 4.0,
                        color: color.withValues(alpha: value * 0.4),
                        offset: Offset.zero,
                      ),
                      if (value > 0.5)
                        Shadow(
                          blurRadius: value * 2.0,
                          color: color.withValues(alpha: 0.3),
                          offset: Offset.zero,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: AppTextStyles.body.copyWith(
                    fontSize: 12,
                    color: color,
                    fontWeight: value > 0.5 ? FontWeight.w600 : FontWeight.w400,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
