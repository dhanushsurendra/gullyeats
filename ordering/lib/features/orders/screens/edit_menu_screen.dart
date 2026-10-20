import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:provider/provider.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_back_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/screens/add_new_item.dart';
import 'package:ordering/features/orders/widgets/edit_menu_dialog.dart';

class EditMenuScreen extends StatefulWidget {
  const EditMenuScreen({super.key});

  @override
  State<EditMenuScreen> createState() => _EditMenuScreenState();
}

class _EditMenuScreenState extends State<EditMenuScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<MenuItemModel> filteredItems = [];
  bool _isInit = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInit) {
      _isInit = true;
      final authProvider = context.read<AuthProvider>();
      final cartProvider = context.read<CartProvider>();

      context
          .read<MenuProvider>()
          .fetchMenuItems(authProvider.token!, cartProvider.selectedCart?.id ?? "")
          .then((_) {
            setState(() {
              filteredItems = context.read<MenuProvider>().menuItems;
            });
          });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: AppPadding.screen,
          child: Column(
            children: [
              _buildHeader(context),
              AppGaps.h16,
              AppSearchBar(
                controller: _searchController,
                hintText: "Search menu items",
                onChanged: (value) {
                  setState(() {
                    filteredItems = context.read<MenuProvider>().searchMenuItem(
                      value,
                    );
                  });
                },
              ),
              AppGaps.h16,
              Expanded(
                child: Consumer<MenuProvider>(
                  builder: (context, provider, child) {
                    if (provider.isLoading) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    if (filteredItems.isEmpty) {
                      return const Center(child: Text("No menu items found"));
                    }

                    return ListView.separated(
                      itemCount: filteredItems.length,
                      separatorBuilder: (_, _) => AppGaps.h12,
                      itemBuilder: (context, index) {
                        final item = filteredItems[index];

                        return _buildMenuItem(
                          name: item.name,
                          price: item.price.toString(),
                          isInStock: item.isInStock,
                          id: item.id,
                          isVeg: item.isVeg,
                          cartId: item.cartId,
                          imageUrl: item.imageUrl
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [AppBackButton(), _addItemButton()],
        ),
        AppGaps.h24,
        Text("Edit Menu Items", style: AppTextStyles.heading2),
        AppGaps.h4,
        Text(
          "Add, remove or update your cart menu.",
          style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
        ),
      ],
    );
  }

  Widget _addItemButton() {
    return OutlinedButton.icon(
      onPressed: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const AddItemScreen()),
      ),
      icon: const Icon(Icons.add, size: 16),
      label: const Text("Add Item", style: TextStyle(fontSize: 14)),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.primary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
    );
  }

  Widget _buildMenuItem({
    required String name,
    required String price,
    required bool isInStock,
    required String id,
    required String cartId,
    required String imageUrl,
    bool isVeg = true,
  }) {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(name, style: AppTextStyles.heading3),
              _buildStockBadge(isInStock),
            ],
          ),
          AppGaps.h12,
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "₹$price",
                style: AppTextStyles.heading3.copyWith(
                  color: AppColors.grey600,
                ),
              ),
              Row(
                children: [
                  _actionIcon(
                    Icons.edit_outlined,
                    AppColors.grey500,
                    () => _openEditDialog(
                      context,
                      name,
                      price,
                      isVeg,
                      isInStock,
                      id,
                      cartId,
                      imageUrl
                    ),
                  ),
                  AppGaps.w12,
                  _actionIcon(
                    Icons.delete_outline,
                    AppColors.error,
                    () => _confirmDelete(context, id, cartId),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openEditDialog(
    BuildContext context,
    String name,
    String price,
    bool isVeg,
    bool isInStock,
    String id,
    String cartId,
    String imageUrl
  ) async {
    await showModalBottomSheet<MenuItemModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => EditMenuDialog(
        initialName: name,
        initialPrice: double.tryParse(price) ?? 0.0,
        initialIsVeg: isVeg,
        initialInStock: isInStock,
        id: id,
        cartId: cartId,
        initialImageUrl: imageUrl
      ),
    );
  }

  void _confirmDelete(BuildContext context, String id, String cartId) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text("Delete Item?", style: AppTextStyles.heading3),
        content: Text("Are you sure you want to remove this item?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text("CANCEL", style: TextStyle(color: AppColors.grey500)),
          ),
          TextButton(
            onPressed: () async {
              try {
                final authProvider = context.read<AuthProvider>();
                Navigator.pop(dialogContext);

                await context.read<MenuProvider>().deleteMenuItem(
                  authProvider.token!,
                  id,
                  cartId,
                );

                if (!context.mounted) return;

                AppSnackBar.show(
                  context,
                  message: "Item deleted successfully!",
                  marginBottom: 0,
                );
              } catch (e) {
                if (!context.mounted) return;

                final message = AppExceptionHandler.getMessage(e);

                AppSnackBar.show(
                  context,
                  message: message,
                  marginBottom: 0,
                  isError: true,
                );
              }
            },
            child: const Text(
              "DELETE",
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockBadge(bool isInStock) {
    final color = isInStock ? AppColors.success : AppColors.error;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        isInStock ? "IN STOCK" : "OUT STOCK",
        style: AppTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 10,
        ),
      ),
    );
  }

  Widget _actionIcon(IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 20, color: color),
      ),
    );
  }
}
