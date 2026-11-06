import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/l10n/l10n.dart';

/// A list's empty or failed state, drawn the same way everywhere: a large grey
/// icon, one line of text, and a Retry button when [onRetry] is given.
class ListMessage extends StatelessWidget {
  final IconData icon;
  final String message;
  final VoidCallback? onRetry;

  const ListMessage({
    super.key,
    required this.icon,
    required this.message,
    this.onRetry,
  });

  /// The failed state: a cloud icon, [message] and Retry.
  const ListMessage.failed({super.key, required this.message, required this.onRetry})
      : icon = Icons.cloud_off_outlined;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: AppColors.grey300),
            AppGaps.h16,
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(color: AppColors.grey400),
            ),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: Text(context.l10n.retry)),
          ],
        ),
      ),
    );
  }
}
