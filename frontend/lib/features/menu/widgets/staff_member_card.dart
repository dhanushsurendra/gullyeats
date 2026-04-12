import 'package:flutter/material.dart';
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
    print(staffId);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: Colors.orange.shade50,
            child: Text(
              name.isNotEmpty 
                  ? name.split(' ').map((l) => l[0]).take(2).join().toUpperCase() 
                  : "?",
              style: TextStyle(
                color: Colors.orange.shade900,
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
                Text(name, style: AppTextStyles.heading3),
                Text(
                  phone,
                  style: AppTextStyles.body.copyWith(
                    color: Colors.grey.shade600, 
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
            style: IconButton.styleFrom(backgroundColor: Colors.red.shade50),
          ),
        ],
      ),
    );
  }
}