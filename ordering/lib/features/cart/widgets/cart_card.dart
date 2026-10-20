import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/cart/models/cart_model.dart';

class CartCard extends StatelessWidget {
  final CartModel cart;
  final bool isSelected;

  const CartCard({super.key, required this.cart, required this.isSelected});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,

      /// 🔶 ONLY border + selection styling
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: isSelected
            ? Border.all(color: AppColors.primary, width: 2)
            : null, // 👈 no border when not selected
      ),

      child: AppCard(
        padding: const EdgeInsets.all(16),

        /// 🔶 subtle selected background
        child: Container(
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primary.withOpacity(0.02)
                : AppColors.white,
            borderRadius: BorderRadius.circular(16),
          ),

          child: InkWell(
            borderRadius: BorderRadius.circular(16),

            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                /// 🔶 LEFT CONTENT
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cart.cartName,
                        style: AppTextStyles.heading3.copyWith(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.black,
                        ),
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
                          style: AppTextStyles.caption.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                AppGaps.w12,

                /// 🔶 STATUS CHIP
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: cart.isOpen
                        ? AppColors.success.withOpacity(0.1)
                        : AppColors.grey200,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    cart.isOpen ? "Open" : "Closed",
                    style: AppTextStyles.caption.copyWith(
                      fontWeight: FontWeight.w600,
                      color: cart.isOpen
                          ? AppColors.success
                          : AppColors.grey600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
