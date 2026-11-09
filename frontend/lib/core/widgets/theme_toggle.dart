import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import '../theme/theme_provider.dart';

/// Switches between the light and dark theme. Sits at the top right of every
/// step screen (BaseScreen), styled like the back button.
class ThemeToggle extends StatelessWidget {
  const ThemeToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = AppColors.dark;
    return Tooltip(
      message: dark ? 'Light theme' : 'Dark theme',
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.read<ThemeProvider>().setDark(!dark),
        child: Container(
          height: 40,
          width: 40,
          decoration: BoxDecoration(
            color: AppColors.grey100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            size: 18,
            color: AppColors.black,
          ),
        ),
      ),
    );
  }
}
