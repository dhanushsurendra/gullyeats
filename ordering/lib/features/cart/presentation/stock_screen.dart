import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/app_tab_filter.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/utils/format_price.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  String selectedTab = "All Items";
  String searchQuery = "";
  bool _loadFailed = false;

  final List<String> tabs = ["All Items", "In Stock", "Out of Stock"];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    final cartId = context.read<CartProvider>().selectedCart?.id;
    if (cartId == null) return;
    setState(() => _loadFailed = false);
    try {
      await context.read<MenuProvider>().fetchMenuItems(
        context.read<AuthProvider>().token,
        cartId,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadFailed = true);
      _showError(e);
    }
  }

  void _showError(Object e) {
    AppSnackBar.show(
      context,
      message: AppExceptionHandler.getMessage(e),
      marginBottom: 0,
      isError: true,
    );
  }

  Future<void> _setStock(MenuItemModel item, bool value) async {
    try {
      await context.read<MenuProvider>().toggleStock(
        context.read<AuthProvider>().token,
        item.id,
        item.cartId,
        value,
      );
    } catch (e) {
      if (mounted) _showError(e);
    }
  }

  void onTabSelected(String value) {
    setState(() {
      selectedTab = value;
    });
  }

  void onSearchChanged(String value) {
    setState(() {
      searchQuery = value;
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MenuProvider>();

    final filteredMenu = provider.menuItems.where((item) {
      final matchesSearch = item.name.toLowerCase().contains(
        searchQuery.toLowerCase(),
      );

      final matchesStock =
          selectedTab == "All Items" ||
          (selectedTab == "In Stock" && item.isInStock) ||
          (selectedTab == "Out of Stock" && !item.isInStock);

      return matchesSearch && matchesStock;
    }).toList();

    return BaseScreen(
      title: context.l10n.stockControl,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      child: Column(
        children: [
          AppSearchBar(
            hintText: context.l10n.searchItems,
            onChanged: onSearchChanged,
          ),
          AppGaps.h16,
          AppTabFilter(
            tabs: tabs,
            labelOf: (tab) => switch (tab) {
              "In Stock" => context.l10n.inStock,
              "Out of Stock" => context.l10n.outOfStock,
              _ => context.l10n.allItems,
            },
            selectedTab: selectedTab,
            onTabSelected: onTabSelected,
          ),
          AppGaps.h16,
          Expanded(
            child: provider.isLoading && provider.menuItems.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      children: [
                        if (_loadFailed && provider.menuItems.isEmpty)
                          ListMessage.failed(
                            message: context.l10n.couldntLoadMenu,
                            onRetry: _load,
                          )
                        else if (filteredMenu.isEmpty)
                          ListMessage(
                            icon: searchQuery.isEmpty
                                ? Icons.restaurant_menu
                                : Icons.search_off_rounded,
                            message: context.l10n.noMenuItemsFound,
                          )
                        else
                          for (final item in filteredMenu) _itemCard(item, provider),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _itemCard(MenuItemModel item, MenuProvider provider) {
    final isOut = !item.isInStock;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: AppPadding.card,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isOut ? AppColors.error : AppColors.grey200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                    decoration: isOut ? TextDecoration.lineThrough : null,
                  ),
                ),
                AppGaps.h4,

                Container(
                  padding: AppPadding.chip,
                  decoration: BoxDecoration(
                    color: item.isInStock
                        ? AppColors.success.withAlpha(26)
                        : AppColors.error.withAlpha(26),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.isInStock ? context.l10n.inStockCaps : context.l10n.outOfStockCaps,
                    style: AppTextStyles.tag.copyWith(
                      color: item.isInStock
                          ? AppColors.success
                          : AppColors.error,
                    ),
                  ),
                ),

                AppGaps.h4,
                Text("₹${formatPrice(item.price)}", style: AppTextStyles.caption),
              ],
            ),
          ),

          AppGaps.w8,
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.grey200,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _segment(
                  context.l10n.stockIn,
                  item.isInStock,
                  () => _setStock(item, true),
                  AppColors.success,
                ),
                _segment(
                  context.l10n.stockOut,
                  !item.isInStock,
                  () => _setStock(item, false),
                  AppColors.error,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _segment(String label, bool active, VoidCallback onTap, Color color) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: active ? AppColors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: active ? color : AppColors.grey600,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
