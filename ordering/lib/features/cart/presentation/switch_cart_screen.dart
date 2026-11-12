import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/widgets/cart_card.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/theme/app_gaps.dart';

class SwitchCartScreen extends StatefulWidget {
  final bool isDraggable;

  const SwitchCartScreen({super.key, required this.isDraggable});

  @override
  State<SwitchCartScreen> createState() => _SwitchCartScreenState();
}

class _SwitchCartScreenState extends State<SwitchCartScreen> {
  String? selectedId;
  String searchQuery = "";
  bool _loadFailed = false;

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
    setState(() => _loadFailed = false);
    try {
      final cartProvider = context.read<CartProvider>();

      final auth = context.read<AuthProvider>();

      await auth.loadToken();
      await auth.loadUser();
      if (cartProvider.selectedCart == null) {
        await cartProvider.loadSelectedCart();
      }

      final carts = await cartProvider.loadCarts(
        auth.token ?? "",
        auth.user?["id"] ?? "",
      );

      if (!mounted) return;

      // On app start the vendor picks a cart every time (the last one is
      // preselected below), unless there is only one to choose.
      if (!widget.isDraggable && carts.length == 1) {
        await cartProvider.selectCart(carts.first);
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(AppRoutes.welcome);
        return;
      }

      // Re-select the current cart after carts are loaded.
      setState(() {
        selectedId = cartProvider.selectedCart?.id;
      });
    } catch (e) {
      final errorMessage = AppExceptionHandler.getMessage(e);

      if (mounted) {
        setState(() => _loadFailed = true);
        AppSnackBar.show(
          context,
          message: errorMessage,
          marginBottom: 0,
          isError: true,
        );
      }
    }
  }

  // ==========================================================================
  // LIST + BUTTON (shared by the start-up screen and the sheet)
  // ==========================================================================

  Widget _cartList(ScrollController? controller, List<CartModel> filteredCarts) {
    final cartProvider = context.watch<CartProvider>();
    final carts = cartProvider.carts;

    return ListView(
      controller: controller,
      children: [
        if (carts.length > 3) ...[
          AppSearchBar(
            hintText: context.l10n.searchCarts,
            onChanged: (value) => setState(() => searchQuery = value),
          ),
          AppGaps.h16,
        ],
        if (cartProvider.isLoading && carts.isEmpty)
          Skeleton.rows(count: 4, height: 84)
        else if (_loadFailed && carts.isEmpty)
          ListMessage.failed(message: context.l10n.couldntLoadCarts, onRetry: _loadCarts)
        else if (carts.isEmpty)
          ListMessage(icon: Icons.storefront_outlined, message: context.l10n.noCartsAssigned)
        else if (filteredCarts.isEmpty)
          ListMessage(icon: Icons.search_off_rounded, message: context.l10n.noCartsAvailable)
        else
          for (final cart in filteredCarts) ...[
            CartCard(
              cart: cart,
              isSelected: selectedId == cart.id,
              onTap: () => setState(() => selectedId = cart.id),
            ),
            AppGaps.h12,
          ],
      ],
    );
  }

  Widget _switchButton() {
    final cartProvider = context.watch<CartProvider>();
    final currentCartId = cartProvider.selectedCart?.id;
    // In the sheet, picking the current cart again does nothing; on app
    // start the current cart can be picked.
    final unchanged = widget.isDraggable && selectedId == currentCartId;

    return AppButton(
      label: context.l10n.switchCartCaps,
      disabled: selectedId == null || unchanged,
      onPressed: () async {
        if (selectedId == null || unchanged) return;
        final selectedCart = cartProvider.carts.firstWhere(
          (cart) => cart.id == selectedId,
        );
        await cartProvider.selectCart(selectedCart);
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(AppRoutes.welcome);
      },
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

    // Keep selectedId synchronized with the actual selected cart.
    if (selectedId == null && currentCartId != null) {
      selectedId = currentCartId;
    }

    final l10n = context.l10n;

    if (!widget.isDraggable) {
      return BaseScreen(
        showBackButton: false,
        header: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.switchCart, style: AppTextStyles.heading1),
                  AppGaps.h4,
                  Text(
                    l10n.chooseCartToSwitch,
                    style: AppTextStyles.body.copyWith(color: AppColors.grey400),
                  ),
                ],
              ),
            ),
            TextButton.icon(
              onPressed: () => signOut(context),
              icon: const Icon(Icons.logout, size: 18),
              label: Text(l10n.logout),
            ),
          ],
        ),
        expandToFullHeight: true,
        bottomNavigationBar: AppFooter(children: [_switchButton()]),
        child: _cartList(null, filteredCarts),
      );
    }

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.grey300,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l10n.switchCart, style: AppTextStyles.heading2),
                          AppGaps.h4,
                          Text(l10n.chooseCartToSwitch, style: AppTextStyles.caption),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close, color: AppColors.grey600),
                    ),
                  ],
                ),
                AppGaps.h16,
                Expanded(child: _cartList(controller, filteredCarts)),
                AppGaps.h12,
                _switchButton(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
