import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/app_tab_filter.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  String selectedTab = "All Items";
  String searchQuery = "";

  final List<String> tabs = ["All Items", "In Stock", "Out of Stock"];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<MenuProvider>().fetchMenuItems(
        "",
        "69db91dd3766ae8b43dd50c7",
      );
    });
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

    return Scaffold(
      appBar: AppHeader(title: "Stock Control", showBack: true),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: AppSearchBar(
              hintText: "Search items...",
              onChanged: (value) => onSearchChanged(value),
            ),
          ),

          Padding(
            padding: AppPadding.horizontalScreen,
            child: AppTabFilter(
              tabs: tabs,
              selectedTab: selectedTab,
              onTabSelected: onTabSelected,
            ),
          ),

          AppGaps.h12,
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    padding: AppPadding.horizontalScreen,
                    itemCount: filteredMenu.length,
                    itemBuilder: (_, i) =>
                        _itemCard(filteredMenu[i], provider),
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
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.isInStock ? "IN STOCK" : "OUT OF STOCK",
                    style: TextStyle(
                      fontSize: 10,
                      color: item.isInStock
                          ? AppColors.success
                          : AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                AppGaps.h4,
                Text("₹${item.price}", style: AppTextStyles.caption),
              ],
            ),
          ),

          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.grey200,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                _segment(
                  "In",
                  item.isInStock,
                  () async => await provider.toggleStock(item.id, item.cartId, true),
                  AppColors.success,
                ),
                _segment(
                  "Out",
                  !item.isInStock,
                  () async => await provider.toggleStock(item.id, item.cartId, false),
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
