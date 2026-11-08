import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AppBackButton extends StatelessWidget {
  /// Defaults to closing the current screen.
  final VoidCallback? onPressed;

  const AppBackButton({super.key, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onPressed ?? () => Navigator.maybePop(context),
      child: Container(
        height: 40,
        width: 40,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(Icons.arrow_back, size: 18, color: AppColors.black),
      ),
    );
  }
}
