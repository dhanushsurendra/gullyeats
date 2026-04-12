import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';

class MenuReviewCard extends StatelessWidget {
  final String name;
  final double price;
  final bool isVeg;
  final VoidCallback onEdit;   // Callback for editing
  final VoidCallback onDelete; // Callback for deleting

  const MenuReviewCard({
    super.key,
    required this.name,
    required this.price,
    required this.isVeg,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = isVeg ? Colors.green : Colors.redAccent;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppTextStyles.heading3),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text("₹$price", 
                      style: const TextStyle(
                        color: AppColors.primary, 
                        fontWeight: FontWeight.bold, 
                        fontSize: 16
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.circle, size: 8, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      isVeg ? "Veg" : "Non-Veg", 
                      style: TextStyle(
                        color: statusColor, 
                        fontSize: 12, 
                        fontWeight: FontWeight.w600
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onEdit, // Triggers parent function
            icon: Icon(Icons.edit_outlined, color: Colors.grey.shade400, size: 20),
            constraints: const BoxConstraints(),
            padding: const EdgeInsets.all(8),
            style: IconButton.styleFrom(backgroundColor: Colors.grey.shade50),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: onDelete, // Triggers parent function
            icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
            constraints: const BoxConstraints(),
            padding: const EdgeInsets.all(8),
            style: IconButton.styleFrom(backgroundColor: Colors.red.shade50),
          ),
        ],
      ),
    );
  }
}