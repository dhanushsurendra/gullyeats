import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';

/// Sticky bar for a screen's main actions. Pass it as
/// `BaseScreen.bottomNavigationBar` so every step keeps its buttons in the
/// same place, visible while the content scrolls, with snackbars floating
/// above them instead of on top.
class AppFooter extends StatelessWidget {
  /// The buttons, primary action last.
  final List<Widget> children;

  /// Optional one-line helper text shown above the buttons.
  final String? note;

  const AppFooter({super.key, required this.children, this.note});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          // Same side padding as the screen body, so buttons line up with it.
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (note != null) ...[
                Text(
                  note!,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption.copyWith(color: AppColors.grey400),
                ),
                AppGaps.h12,
              ],
              for (final (i, child) in children.indexed) ...[
                if (i > 0) AppGaps.h12,
                child,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
