import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';
import 'package:gullyeats/features/menu/providers/menu_provider.dart';
import 'package:gullyeats/features/menu/widgets/edit_menu_dialog.dart';
import 'package:gullyeats/features/menu/widgets/menu_review_card.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';

class MenuReviewScreen extends StatefulWidget {
  final List<MenuItemModel> menuItems;

  const MenuReviewScreen({super.key, required this.menuItems});

  const MenuReviewScreen.empty({super.key}) : menuItems = const [];

  @override
  State<MenuReviewScreen> createState() => _MenuReviewScreenState();
}

class _MenuReviewScreenState extends State<MenuReviewScreen> {
  bool isLoading = false;

  void _openEditDialog(MenuItemModel item, int index) async {
    final result = await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
      ),
      builder: (context) => EditMenuDialog(
        initialName: item.name,
        initialPrice: item.price,
        initialIsVeg: item.isVeg,
      ),
    );

    if (result != null && mounted) {
      setState(() {
        widget.menuItems[index] = MenuItemModel(
          name: result['name'],
          price: result['price'].toDouble(),
          isVeg: result['isVeg'],
        );
      });
    }
  }

  void _handleSaveMenu() async {

    setState(() => isLoading = true);

    try {
      final menuProvider = Provider.of<MenuProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final result = await menuProvider.saveMenu(
        auth.token,
        widget.menuItems,
        cartProvider.cartId!,
      );

      if (result && mounted) {
        Navigator.pushNamed(context, "/operating-setup");  
      } else {
        throw Exception("Failed to save menu");
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      AppSnackBar.show(context, message: message, isError: true);
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: "Menu Review",
      subtitle: "Check your menu items before confirming.",
      expandToFullHeight: true,
      onBack: () => Navigator.pop(context, widget.menuItems),
      bottomNavigationBar: _buildFooter(),
      child: ListView.separated(
        padding: const EdgeInsets.only(bottom: 16),
        itemCount: widget.menuItems.length,
        separatorBuilder: (_, _) => AppGaps.h16,
        itemBuilder: (context, index) {
          final item = widget.menuItems[index];
          return MenuReviewCard(
            name: item.name,
            price: item.price,
            isVeg: item.isVeg,
            onEdit: () => _openEditDialog(item, index),
            onDelete: () {
              setState(() => widget.menuItems.removeAt(index));
            },
          );
        },
      ),
    );
  }

  Widget _buildFooter() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppButton(
              label: '+ ADD MORE ITEMS',
              onPressed: () {
                Navigator.pop(context, widget.menuItems);
              },
              backgroundColor: AppColors.white,
              borderColor: AppColors.primary,
              textColor: AppColors.primary,
            ),
            AppGaps.h12,
            AppButton(
              label: "CONTINUE",
              isLoading: isLoading,
              onPressed: widget.menuItems.isEmpty ? null : _handleSaveMenu,
            ),
          ],
        ),
      ),
    );
  }
}
