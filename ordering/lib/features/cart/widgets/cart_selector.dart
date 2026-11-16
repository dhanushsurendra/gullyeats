import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

/// The selected cart's name and address; tapping opens the cart switcher.
/// Hidden for vendors with a single cart, who have nothing to switch to.
class CartSelector extends StatelessWidget {
  /// Stay on this screen after switching (see [SwitchCartScreen.stayOnScreen]).
  final bool stayOnScreen;

  const CartSelector({super.key, this.stayOnScreen = true});

  /// Whether the switcher shows: not for a vendor with a single cart.
  static bool shows(CartProvider p) =>
      p.selectedCart != null && p.carts.length != 1;

  @override
  Widget build(BuildContext context) {
    final cartProvider = context.watch<CartProvider>();
    final cart = cartProvider.selectedCart;
    if (cart == null || !shows(cartProvider)) {
      return const SizedBox.shrink();
    }

    // A slim one-line pill: the cart's name is enough to know which cart is
    // on; its address is on Profile and in the switch sheet.
    return Semantics(
      button: true,
      label: '${context.l10n.switchCart}: ${cart.cartName}',
      excludeSemantics: true,
      child: Material(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => SwitchCartScreen(
              isDraggable: true,
              stayOnScreen: stayOnScreen,
            ),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 200, minHeight: 40),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.storefront_rounded,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  AppGaps.w8,
                  Flexible(
                    child: Text(
                      cart.cartName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.black,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  AppGaps.w4,
                  Icon(
                    Icons.expand_more_rounded,
                    size: 20,
                    color: AppColors.grey500,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
