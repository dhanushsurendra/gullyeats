import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/widgets/status_badge.dart';

class CartCard extends StatelessWidget {
  final CartModel cart;
  final bool isSelected;

  const CartCard({
    super.key,
    required this.cart,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.primary.withValues(alpha: 0.02)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.grey200,
          width: isSelected ? 2 : 1,
        ),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      cart.cartName,
                      style: AppTextStyles.heading3.copyWith(
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.grey500,
                      ),
                    ),
                  ),
                  StatusBadge(
                    label: cart.isActive ? "ACTIVE" : "INACTIVE",
                    isSuccess: cart.isActive,
                  ),
                ],
              ),
              AppGaps.h12,
              Text(
                cart.address,
                style: AppTextStyles.body.copyWith(
                  color: AppColors.grey400,
                  fontSize: 13,
                ),
              ),
              AppGaps.h12,
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.grey100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      "ID: ${cart.cartId}",
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 4,
                        backgroundColor: cart.isActive
                            ? Colors.green
                            : Colors.grey,
                      ),
                      AppGaps.w8,
                      Text(
                        cart.isOpen ? "Currently Open" : "Closed for now",
                        style: TextStyle(
                          color: cart.isOpen ? Colors.green : Colors.grey,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
