import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/widgets/cart_card.dart';
import 'package:provider/provider.dart';

class SwitchCartScreen extends StatefulWidget {
  final bool isDraggable;

  const SwitchCartScreen({super.key, required this.isDraggable});

  @override
  State<SwitchCartScreen> createState() => _SwitchCartScreenState();
}

class _SwitchCartScreenState extends State<SwitchCartScreen> {
  String? selectedId;
  String searchQuery = "";

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Set the currently selected cart immediately.
      final cartProvider = context.read<CartProvider>();

      if (mounted) {
        setState(() {
          selectedId = cartProvider.selectedCart?.id;
        });
      }

      await _loadCarts();
    });
  }

  // ==========================================================================
  // LOAD CARTS
  // ==========================================================================

  Future<void> _loadCarts() async {
    try {
      final cartProvider = context.read<CartProvider>();

      final auth = context.read<AuthProvider>();

      await auth.loadToken();
      await auth.loadUser();

      await cartProvider.loadCarts(auth.token ?? "", auth.user?["id"] ?? "");

      if (!mounted) return;

      // Re-select the current cart after carts are loaded.
      setState(() {
        selectedId = cartProvider.selectedCart?.id;
      });
    } catch (e) {
      final errorMessage = AppExceptionHandler.getMessage(e);

      if (mounted) {
        AppSnackBar.show(context, message: errorMessage, isError: true);
      }
    }
  }

  // ==========================================================================
  // CONTENT
  // ==========================================================================

  Widget _buildContent(
    BuildContext context,
    ScrollController? controller,
    List<CartModel> filteredCarts,
  ) {
    final cartProvider = context.watch<CartProvider>();

    final currentCartId = cartProvider.selectedCart?.id;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: widget.isDraggable
            ? const BorderRadius.vertical(top: Radius.circular(20))
            : BorderRadius.zero,
      ),
      child: Column(
        children: [
          // ====================================================================
          // DRAG HANDLE
          // ====================================================================
          if (widget.isDraggable)
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.grey300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),

          // ====================================================================
          // HEADER
          // ====================================================================
          Padding(
            padding: AppPadding.horizontalScreen,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Switch Cart", style: AppTextStyles.heading2),
                    Text(
                      "Choose which cart to switch",
                      style: AppTextStyles.caption,
                    ),
                  ],
                ),

                widget.isDraggable
                    ? IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close, color: AppColors.grey600),
                      )
                    : const SizedBox.shrink(),
              ],
            ),
          ),

          // ====================================================================
          // SEARCH
          // ====================================================================
          Padding(
            padding: const EdgeInsets.all(16),
            child: AppSearchBar(
              hintText: "Search carts...",
              onChanged: (value) {
                setState(() {
                  searchQuery = value;
                });
              },
            ),
          ),

          // ====================================================================
          // CART LIST
          // ====================================================================
          Expanded(
            child: cartProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: controller,
                    padding: AppPadding.horizontalScreen,
                    itemCount: filteredCarts.length,
                    itemBuilder: (context, index) {
                      final cart = filteredCarts[index];

                      final isSelected = selectedId == cart.id;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              selectedId = cart.id;
                            });
                          },
                          child: CartCard(cart: cart, isSelected: isSelected),
                        ),
                      );
                    },
                  ),
          ),

          // ====================================================================
          // SWITCH BUTTON
          // ====================================================================
          Padding(
            padding: const EdgeInsets.all(16),
            child: AppButton(
              label: "SWITCH CART",

              // Disable button when:
              // 1. Nothing is selected
              // 2. Selected cart is already the current cart
              disabled: selectedId == null || selectedId == currentCartId,

              onPressed: () async {
                // ==============================================================
                // SAFETY CHECK
                //
                // If user tries to switch to the same cart,
                // DO ABSOLUTELY NOTHING.
                // No API call.
                // No navigation.
                // ==============================================================

                if (selectedId == null || selectedId == currentCartId) {
                  return;
                }

                final cartProvider = context.read<CartProvider>();

                final selectedCart = cartProvider.carts.firstWhere(
                  (cart) => cart.id == selectedId,
                );

                // ==============================================================
                // ACTUALLY SWITCH CART
                // ==============================================================

                await cartProvider.selectCart(selectedCart);

                if (!context.mounted) return;

                Navigator.of(context).pushReplacementNamed(AppRoutes.welcome);
              },
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================================================
  // BUILD
  // ==========================================================================

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CartProvider>();

    final currentCartId = provider.selectedCart?.id;

    final filteredCarts = provider.carts.where((cart) {
      return cart.cartName.toLowerCase().contains(searchQuery.toLowerCase());
    }).toList();

    // Always put the currently selected cart first.
    if (currentCartId != null) {
      filteredCarts.sort((a, b) {
        if (a.id == currentCartId) return -1;
        if (b.id == currentCartId) return 1;
        return 0;
      });
    }

    // Keep selectedId synchronized with
    // the actual selected cart.
    if (selectedId == null && currentCartId != null) {
      selectedId = currentCartId;
    }

    if (widget.isDraggable) {
      return DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (_, controller) {
          return _buildContent(context, controller, filteredCarts);
        },
      );
    }

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(child: _buildContent(context, null, filteredCarts)),
    );
  }
}
