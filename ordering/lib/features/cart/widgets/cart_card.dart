import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/widgets/status_badge.dart';
import 'package:ordering/l10n/l10n.dart';

/// A cart in a picker list; same look as the onboarding app's outlet card.
class CartCard extends StatelessWidget {
  final CartModel cart;
  final bool isSelected;
  final VoidCallback? onTap;

  const CartCard({
    super.key,
    required this.cart,
    required this.isSelected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.primary.withValues(alpha: 0.02)
            : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.grey200,
          width: isSelected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      cart.cartName,
                      style: AppTextStyles.heading3.copyWith(
                        color: isSelected ? AppColors.primary : AppColors.black,
                      ),
                    ),
                  ),
                  AppGaps.w8,
                  StatusBadge(
                    label: (cart.isOpen ? context.l10n.open : context.l10n.closed)
                        .toUpperCase(),
                    isSuccess: cart.isOpen,
                  ),
                ],
              ),
              if (cart.address.isNotEmpty) ...[
                AppGaps.h8,
                Text(
                  cart.address,
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.grey400,
                  ),
                ),
              ],
              AppGaps.h12,
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.grey100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "ID: ${cart.cartId}",
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
