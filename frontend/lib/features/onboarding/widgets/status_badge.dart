import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final bool isSuccess;

  const StatusBadge({super.key, required this.label, required this.isSuccess});

  @override
  Widget build(BuildContext context) {
    final color = isSuccess ? Colors.green : AppColors.grey400;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color, 
          fontSize: 10, 
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}