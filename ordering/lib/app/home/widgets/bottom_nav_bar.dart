import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

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
    // Staff get today's handover where the owner has Sales.
    final isStaff = context.watch<AuthProvider>().isStaff;
    return SafeArea(
      bottom: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        // A minimum height, so the bar grows with large system text.
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(vertical: 8),
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
                outlinedIcon: isStaff
                    ? CupertinoIcons.doc_text
                    : CupertinoIcons.graph_square,
                filledIcon: isStaff
                    ? CupertinoIcons.doc_text_fill
                    : CupertinoIcons.graph_square_fill,
                label: isStaff ? context.l10n.handover : context.l10n.sales,
              ),
              _navItem(
                index: 1,
                outlinedIcon: CupertinoIcons.bag,
                filledIcon: CupertinoIcons.bag_fill,
                label: context.l10n.orders,
              ),
              _navItem(
                index: 2,
                outlinedIcon: CupertinoIcons.person,
                filledIcon: CupertinoIcons.person_fill,
                label: context.l10n.profile,
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
              mainAxisSize: MainAxisSize.min,
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
                // One line: a long translation shrinks rather than wraps.
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      label,
                      maxLines: 1,
                      style: AppTextStyles.caption.copyWith(
                        color: color,
                        fontWeight: value > 0.5
                            ? FontWeight.w600
                            : FontWeight.w400,
                        letterSpacing: 0.2,
                      ),
                    ),
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
