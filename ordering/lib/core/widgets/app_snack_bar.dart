import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';

class AppSnackBar {
  static Future<void> show(
    BuildContext context, {
    required String message,
    SnackBarAction? action,
    bool isError = false,
    bool isInfo = false,
    double marginBottom = 116,
  }) async {
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    scaffoldMessenger.hideCurrentSnackBar();

    final controller = scaffoldMessenger.showSnackBar(
      SnackBar(
        action: action,
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: isInfo ? AppColors.black : isError ? Colors.redAccent[700] : Colors.green[800],
        duration: const Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
        margin: EdgeInsets.only(bottom: marginBottom, left: 16, right: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 4,
      ),
    );

    await controller.closed; 
  }
}
