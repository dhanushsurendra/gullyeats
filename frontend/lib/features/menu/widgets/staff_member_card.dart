import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';

class StaffMemberCard extends StatelessWidget {
  final String name;
  final String phone;
  final String staffId;
  final Function(String staffId) onDelete;

  const StaffMemberCard({
    super.key,
    required this.name,
    required this.phone,
    required this.staffId,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: AppColors.lightOrange,
            child: Text(
              name.isNotEmpty 
                  ? name.split(' ').map((l) => l[0]).take(2).join().toUpperCase() 
                  : "?",
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ),
          AppGaps.w16,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTextStyles.heading3,
                  // Two lines max: the phone number below identifies the person.
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  phone,
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.grey600, 
                    fontSize: 13
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => onDelete(staffId),
            icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
            constraints: const BoxConstraints(),
            padding: const EdgeInsets.all(8),
            style: IconButton.styleFrom(backgroundColor: AppColors.lightRed),
          ),
        ],
      ),
    );
  }
}