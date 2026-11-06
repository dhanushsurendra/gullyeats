import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:provider/provider.dart';

/// The selected cart's name and address; tapping opens the cart switcher.
/// Hidden for vendors with a single cart, who have nothing to switch to.
class CartSelector extends StatelessWidget {
  const CartSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final cartProvider = context.watch<CartProvider>();
    final cart = cartProvider.selectedCart;
    if (cart == null || cartProvider.carts.length == 1) {
      return const SizedBox.shrink();
    }

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const SwitchCartScreen(isDraggable: true),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 180),
        padding: AppPadding.smallCard,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.grey200),
          borderRadius: BorderRadius.circular(12),
          color: AppColors.white,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    cart.cartName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.black,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (cart.address.isNotEmpty)
                    Text(
                      cart.address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption,
                    ),
                ],
              ),
            ),
            AppGaps.w8,
            const Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.grey500),
          ],
        ),
      ),
    );
  }
}
