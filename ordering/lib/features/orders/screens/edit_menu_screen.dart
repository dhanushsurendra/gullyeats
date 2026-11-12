import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:provider/provider.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/screens/add_new_item.dart';
import 'package:ordering/features/orders/widgets/edit_menu_dialog.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/utils/format_price.dart';

class EditMenuScreen extends StatefulWidget {
  const EditMenuScreen({super.key});

  @override
  State<EditMenuScreen> createState() => _EditMenuScreenState();
}

class _EditMenuScreenState extends State<EditMenuScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _query = "";
  bool _isInit = false;

  bool _loadFailed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInit) {
      _isInit = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loadFailed = false);
    try {
      await context.read<MenuProvider>().fetchMenuItems(
        context.read<AuthProvider>().token,
        context.read<CartProvider>().selectedCart?.id ?? "",
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadFailed = true);
      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        marginBottom: 0,
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final provider = context.watch<MenuProvider>();
    // Derived on every build so edits, adds and deletes show up while a
    // search is active.
    final items = provider.searchMenuItem(_query);

    return BaseScreen(
      title: l10n.editMenuItems,
      subtitle: l10n.editMenuSubtitle,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: AppFooter(
        children: [
          AppButton(
            label: "+ ${l10n.addItem.toUpperCase()}",
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const AddItemScreen()),
            ),
          ),
        ],
      ),
      child: Column(
        children: [
          AppSearchBar(
            controller: _searchController,
            hintText: l10n.searchMenuItems,
            onChanged: (value) => setState(() => _query = value),
          ),
          AppGaps.h16,
          Expanded(
            child: provider.isLoading && provider.menuItems.isEmpty
                ? Skeleton.rows(count: 6, height: 88)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      children: [
                        if (_loadFailed && provider.menuItems.isEmpty)
                          ListMessage.failed(
                            message: l10n.couldntLoadMenu,
                            onRetry: _load,
                          )
                        else if (items.isEmpty)
                          ListMessage(
                            icon: _query.isEmpty
                                ? Icons.restaurant_menu
                                : Icons.search_off_rounded,
                            message: l10n.noMenuItemsFound,
                          )
                        else
                          for (final item in items) ...[
                            _buildMenuItem(item),
                            AppGaps.h12,
                          ],
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  // Same card as the onboarding app's menu review, plus the stock badge.
  Widget _buildMenuItem(MenuItemModel item) {
    final vegColor = item.isVeg ? AppColors.success : AppColors.error;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.displayName, style: AppTextStyles.heading3),
                AppGaps.h4,
                // Wrap: the tags move under the price on narrow cards.
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      "₹${formatPrice(item.price)}",
                      style: AppTextStyles.heading3.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle, size: 8, color: vegColor),
                        AppGaps.w4,
                        Text(
                          item.isVeg ? context.l10n.veg : context.l10n.nonVeg,
                          style: AppTextStyles.caption.copyWith(
                            color: vegColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    _buildStockBadge(item.isInStock),
                  ],
                ),
              ],
            ),
          ),
          AppGaps.w8,
          _actionIcon(Icons.edit_outlined, AppColors.grey500, () => _openEditDialog(item)),
          AppGaps.w8,
          _actionIcon(
            Icons.delete_outline,
            AppColors.error,
            () => _confirmDelete(context, item.id, item.cartId),
          ),
        ],
      ),
    );
  }

  Future<void> _openEditDialog(MenuItemModel item) async {
    await showModalBottomSheet<MenuItemModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => EditMenuDialog(
        initialName: item.name,
        initialPrice: item.price,
        initialIsVeg: item.isVeg,
        initialInStock: item.isInStock,
        id: item.id,
        cartId: item.cartId,
        initialImageUrl: item.imageUrl,
        defaultImageUrl: item.defaultImage,
        initialNames: item.names,
      ),
    );
  }

  void _confirmDelete(BuildContext context, String id, String cartId) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.deleteItemQuestion, style: AppTextStyles.heading3),
        content: Text(context.l10n.confirmRemoveItem),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(context.l10n.cancel.toUpperCase(), style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600, color: AppColors.grey500)),
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
                  message: context.l10n.itemDeleted,
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
            child: Text(
              context.l10n.delete.toUpperCase(),
              style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600, color: AppColors.error),
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
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        isInStock ? context.l10n.inStockCaps : context.l10n.outOfStockCaps,
        style: AppTextStyles.tag.copyWith(color: color),
      ),
    );
  }

  Widget _actionIcon(IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, size: 20, color: color),
      ),
    );
  }
}
