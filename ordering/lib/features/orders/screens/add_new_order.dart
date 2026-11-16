import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/core/utils/payment_lock.dart';

class AddNewOrder extends StatefulWidget {
  final OrderModel? existingOrder;

  /// A new order to start from (menu item id -> quantity), with a parcel
  /// charge: what a voice order heard, opened here to change.
  final Map<String, int>? prefill;
  final double prefillParcel;

  const AddNewOrder({
    super.key,
    this.existingOrder,
    this.prefill,
    this.prefillParcel = 0,
  });

  bool get isEditing => existingOrder != null;

  @override
  State<AddNewOrder> createState() => _AddNewOrderState();
}

class _AddNewOrderState extends State<AddNewOrder> {
  String searchQuery = '';

  bool _isSubmitting = false;
  bool _isMarkingPaid = false;

  late OrderProvider _orderProvider;
  late CartProvider _cartProvider;
  late AuthProvider _authProvider;
  late TextEditingController parcelChargeController;

  List<MenuItemModel> displayMenu = [];

  @override
  void initState() {
    super.initState();

    parcelChargeController = TextEditingController(
      // Empty, not "0": the hint shows 0, and typing never makes "060".
      text: (widget.existingOrder?.parcelCharge ?? 0) > 0
          ? widget.existingOrder!.parcelCharge.toStringAsFixed(0)
          : '',
    );

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      _orderProvider = context.read<OrderProvider>();

      _cartProvider = context.read<CartProvider>();
      _authProvider = context.read<AuthProvider>();
      await _orderProvider.loadMenu(
        _authProvider.token!,
        _cartProvider.selectedCart!.id,
      );

      if (!mounted) return;

      // Populate existing order first
      if (widget.isEditing) {
        _orderProvider.startEditing(widget.existingOrder!);
      } else {
        _orderProvider.clearOrder();
        final prefill = widget.prefill;
        if (prefill != null) {
          for (final item in _orderProvider.menu) {
            for (var n = prefill[item.id] ?? 0; n > 0; n--) {
              _orderProvider.addItem(item);
            }
          }
          if (widget.prefillParcel > 0) {
            _orderProvider.setParcelPrice(widget.prefillParcel);
            parcelChargeController.text = widget.prefillParcel.toStringAsFixed(
              0,
            );
          }
        }
      }

      if (!mounted) return;

      // IMPORTANT:
      // Take the snapshot only AFTER selected items
      // have been added to the cart.
      setState(() {
        displayMenu = _orderProvider.getMenuWithSelectedItemsOnTop();
      });
    });
  }

  @override
  void dispose() {
    parcelChargeController.dispose();

    super.dispose();
  }

  // ============================================================
  // CREATE ORDER
  // ============================================================

  Future<void> _createOrder(
    bool isPaid,
    OrderProvider provider,
    String? token,
    String? cartId,
  ) async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _isMarkingPaid = isPaid;
    });

    // The server prices the order from the menu; only items, quantities
    // and the parcel charge matter.
    final orderData = {
      "cartId": cartId,
      "orderType": "MANUAL",
      "status": isPaid ? "PAID" : "PENDING",
      "orderItems": provider.orderItems,
      "parcelCharge": provider.parcelPrice,
    };

    try {
      await provider.createOrder(token, orderData);

      provider.clearOrder();

      if (!mounted) return;

      Navigator.pop(context);

      AppSnackBar.show(
        context,
        message: isPaid
            ? context.l10n.orderCreatedPaid
            : context.l10n.orderCreated,
      );
    } catch (e) {
      if (!mounted) return;

      // 403: the server refused the order because the cart is locked for an
      // unpaid fee. Show the lock screen instead of only an error.
      if (e is ApiException && e.statusCode == 403) {
        await checkPaymentLock(context);
        if (!mounted) return;
      }

      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _isMarkingPaid = false;
        });
      }
    }
  }

  // ============================================================
  // UPDATE ORDER
  // ============================================================

  Future<void> _deleteOrder(String? token, String orderId) async {
    final provider = context.read<OrderProvider>();
    final messenger = ScaffoldMessenger.of(context);

    try {
      await provider.deleteOrder(token, orderId);

      if (!mounted) return;

      messenger.clearSnackBars();

      AppSnackBar.show(
        context,
        isInfo: true,
        message: context.l10n.orderDeleted,
      );

      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: message, isError: true);
    }
  }

  Future<void> _updateOrder(OrderProvider provider, String? token) async {
    final currentItems = provider.orderItems;

    final oldOrder = widget.existingOrder!;

    // Compare items
    final oldItems = oldOrder.orderItems
        .map(
          (item) => {
            "menuItemId": item.menuItemId,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
          },
        )
        .toList();

    final newItems = currentItems
        .map(
          (item) => {
            "menuItemId": item["menuItemId"],
            "name": item["name"],
            "price": item["price"],
            "quantity": item["quantity"],
          },
        )
        .toList();

    final itemsChanged = !_areOrderItemsEqual(oldItems, newItems);

    final parcelChanged = provider.parcelPrice != oldOrder.parcelCharge;

    final platformChanged = provider.platformFee != oldOrder.platformFee;

    final newTotal = provider.total;

    final totalChanged = newTotal != oldOrder.totalPrice;

    // Nothing changed → don't make API request
    if (!itemsChanged && !parcelChanged && !platformChanged && !totalChanged) {
      if (mounted) {
        Navigator.pop(context);
      }
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final orderData = {
        "orderItems": currentItems,
        "parcelCharge": provider.parcelPrice,
      };

      final updatedOrder = await provider.updateOrder(
        token,
        oldOrder.id,
        orderData,
      );

      if (!mounted) return;

      Navigator.pop(context, updatedOrder);

      AppSnackBar.show(context, message: context.l10n.orderUpdated);
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: message, isError: true);
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  bool _areOrderItemsEqual(
    List<Map<String, dynamic>> oldItems,
    List<Map<String, dynamic>> newItems,
  ) {
    if (oldItems.length != newItems.length) {
      return false;
    }

    final oldMap = {for (final item in oldItems) item["menuItemId"]: item};

    final newMap = {for (final item in newItems) item["menuItemId"]: item};

    if (oldMap.length != newMap.length) {
      return false;
    }

    for (final id in oldMap.keys) {
      final oldItem = oldMap[id];
      final newItem = newMap[id];

      if (newItem == null) {
        return false;
      }

      if (oldItem?["quantity"] != newItem["quantity"] ||
          oldItem?["price"] != newItem["price"] ||
          oldItem?["name"] != newItem["name"]) {
        return false;
      }
    }

    return true;
  }

  // ============================================================
  // SEARCH
  // ============================================================

  void _onSearchChanged(String value) {
    setState(() {
      searchQuery = value;
    });
  }

  // ============================================================
  // BUILD
  // ============================================================

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();

    final menu = displayMenu;

    final filteredMenu =
        menu.where((item) => item.matches(searchQuery)).toList()
          // Out-of-stock items sink to the bottom (a stable sort keeps the rest
          // in menu order).
          ..sort((a, b) => (a.isInStock ? 0 : 1) - (b.isInStock ? 0 : 1));

    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),

            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ------------------------------------------------
                    // SEARCH
                    // ------------------------------------------------
                    Padding(
                      padding: AppPadding.horizontalScreen,
                      child: AppSearchBar(
                        hintText: context.l10n.searchItems,
                        onChanged: _onSearchChanged,
                      ),
                    ),
                    AppGaps.h24,
                    Padding(
                      padding: AppPadding.horizontalScreen,
                      child: Text(
                        context.l10n.menuItems,
                        style: AppTextStyles.heading2,
                      ),
                    ),

                    AppGaps.h12,

                    // ------------------------------------------------
                    // MENU
                    // ------------------------------------------------
                    provider.isMenuLoading
                        // Same side padding as the menu list it stands in for.
                        ? Padding(
                            padding: AppPadding.horizontalScreen,
                            child: Skeleton.rows(count: 5, height: 72),
                          )
                        : filteredMenu.isEmpty
                        ? ListMessage(
                            icon: searchQuery.isEmpty
                                ? Icons.restaurant_menu
                                : Icons.search_off_rounded,
                            message: context.l10n.noMenuItemsFound,
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            padding: AppPadding.horizontalScreen,
                            itemCount: filteredMenu.length,
                            separatorBuilder: (_, _) => AppGaps.h12,
                            itemBuilder: (_, index) {
                              final item = filteredMenu[index];

                              final count = provider.getCount(item);

                              return _buildMenuItem(item, count, provider);
                            },
                          ),

                    AppGaps.h12,

                    // ------------------------------------------------
                    // PARCEL
                    // ------------------------------------------------
                    _buildParcelToggle(provider),

                    AppGaps.h24,
                  ],
                ),
              ),
            ),

            // --------------------------------------------------------
            // SUMMARY
            // --------------------------------------------------------
            _buildSummary(
              provider,
              authProvider.token,
              widget.existingOrder?.id ?? "",
              cartProvider.selectedCart?.id,
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // HEADER
  // ============================================================

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 24, 16),
      child: Row(
        children: [
          IconButton(
            onPressed: _isSubmitting
                ? null
                : () {
                    context.read<OrderProvider>().clearOrder();
                    Navigator.pop(context);
                  },
            icon: Icon(Icons.close, color: AppColors.grey600),
          ),
          AppGaps.w8,
          Expanded(
            child: Text(
              widget.isEditing
                  ? context.l10n.updateOrder
                  : context.l10n.createOrder,
              style: AppTextStyles.heading2,
            ),
          ),
          AppGaps.w8,
          Container(
            padding: AppPadding.chip,
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              widget.isEditing
                  ? "#${widget.existingOrder!.orderNumber}"
                  : context.l10n.manual.toUpperCase(),
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.grey600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // MENU ITEM
  // ============================================================

  Widget _buildMenuItem(MenuItemModel item, int count, OrderProvider provider) {
    final isSelected = count > 0;
    // Out of stock and not already in this order: the server would refuse
    // it, so it can't be added. One already in an order being edited keeps
    // its stepper, so the vendor can still change or remove it.
    final unavailable = !item.isInStock && count == 0;

    final card = AppCard(
      padding: const EdgeInsets.all(16),
      border: Border.all(
        color: isSelected
            ? AppColors.primary.withValues(alpha: 0.5)
            : AppColors.grey200,
        width: isSelected ? 1.5 : 1,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.displayName,
                  style: AppTextStyles.heading3.copyWith(
                    color: AppColors.black,
                  ),
                ),

                AppGaps.h4,

                Text(
                  "₹${formatPrice(item.price)}",
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          AppGaps.w8,
          // Just "+" until the item is in the order, then the full stepper.
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            alignment: Alignment.centerRight,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (unavailable)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.grey100,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      context.l10n.outOfStock,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.grey600,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else ...[
                  if (count > 0) ...[
                    _qtyBtn(
                      Icons.remove,
                      () => provider.removeItem(item),
                      false,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        transitionBuilder: (child, animation) =>
                            ScaleTransition(scale: animation, child: child),
                        child: Text(
                          "$count",
                          key: ValueKey(count),
                          style: AppTextStyles.heading3.copyWith(
                            color: AppColors.black,
                          ),
                        ),
                      ),
                    ),
                  ],
                  _qtyBtn(Icons.add, () => provider.addItem(item), true),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    // Greyed out, and announced as unavailable to screen readers.
    return unavailable
        ? Semantics(
            label: context.l10n.outOfStock,
            child: Opacity(opacity: 0.55, child: card),
          )
        : card;
  }

  // ============================================================
  // QUANTITY BUTTON
  // ============================================================

  Widget _qtyBtn(IconData icon, VoidCallback? onTap, bool isAdd) {
    return InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              onTap();
            },
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isAdd ? AppColors.primary : AppColors.surface,
          border: isAdd ? null : Border.all(color: AppColors.grey200),
        ),
        child: Icon(
          icon,
          size: 18,
          color: isAdd ? AppColors.white : AppColors.grey600,
        ),
      ),
    );
  }

  // ============================================================
  // PARCEL
  // ============================================================

  Widget _buildParcelToggle(OrderProvider provider) {
    return Container(
      padding: AppPadding.horizontalScreen,
      child: Row(
        children: [
          Expanded(
            child: Text(
              context.l10n.parcelCharges,
              style: AppTextStyles.heading3,
            ),
          ),
          AppGaps.w8,
          SizedBox(
            width: 110,
            child: AppInput(
              controller: parcelChargeController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                noLeadingZeros,
              ],
              hint: "0",
              prefix: Padding(
                padding: const EdgeInsets.only(left: 16, right: 8),
                child: Text("₹", style: AppTextStyles.heading3),
              ),
              onChanged: (value) {
                provider.setParcelPrice(double.tryParse(value) ?? 0);
              },
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // SUMMARY
  // ============================================================

  Widget _buildSummary(
    OrderProvider provider,
    String? token,
    String orderId,
    String? cartId,
  ) {
    final oldTotal = widget.existingOrder?.totalPrice ?? 0.0;
    final paidAmount = widget.existingOrder?.paidAmount ?? 0.0;

    final newTotal = provider.total;

    // Same rule as the server: only money already collected is settled.
    final difference = paidAmount > 0 ? newTotal - paidAmount : 0.0;

    // The same shape as AppFooter: white, soft top shadow, safe-area padding.
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _row(context.l10n.subtotal, "₹${formatPrice(provider.subtotal)}"),

            AppGaps.h4,

            _row(
              context.l10n.platformFee,
              "₹${formatPrice(provider.platformFee)}",
            ),

            AppGaps.h4,

            _row(context.l10n.parcel, "₹${formatPrice(provider.parcelPrice)}"),

            if (widget.isEditing) ...[
              AppGaps.h8,

              _row(context.l10n.previousTotal, "₹${formatPrice(oldTotal)}"),
            ],

            AppGaps.h12,

            Divider(height: 1, color: AppColors.grey200),

            AppGaps.h12,

            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.isEditing
                        ? context.l10n.newTotalCaps
                        : context.l10n.total.toUpperCase(),
                    style: AppTextStyles.heading3,
                  ),
                ),
                Text(
                  "₹${formatPrice(newTotal)}",
                  style: AppTextStyles.heading1.copyWith(
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),

            if (widget.isEditing && difference != 0) ...[
              AppGaps.h12,
              _buildDifference(difference),
            ],

            AppGaps.h16,

            // --------------------------------------------------------
            // CREATE MODE
            // --------------------------------------------------------
            if (!widget.isEditing)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Side by side: stacked, they'd leave little room for the menu
                  // on small phones. Creating unpaid is the secondary action.
                  Expanded(
                    child: AppButton(
                      disabled: provider.orderItems.isEmpty || _isSubmitting,
                      label: context.l10n.skip.toUpperCase(),
                      isLoading: _isSubmitting && !_isMarkingPaid,
                      backgroundColor: AppColors.surface,
                      borderColor: AppColors.primary,
                      textColor: AppColors.primary,
                      onPressed: () async {
                        await _createOrder(false, provider, token, cartId);
                      },
                    ),
                  ),
                  AppGaps.w12,
                  Expanded(
                    child: AppButton(
                      disabled: provider.orderItems.isEmpty || _isSubmitting,
                      label: context.l10n.markAsPaidCaps,
                      isLoading: _isSubmitting && _isMarkingPaid,
                      onPressed: () async {
                        await _createOrder(true, provider, token, cartId);
                      },
                    ),
                  ),
                ],
              ),

            if (widget.isEditing)
              AppButton(
                disabled: _isSubmitting,
                label: provider.orderItems.isEmpty
                    ? context.l10n.deleteOrderCaps
                    : context.l10n.updateOrderCaps,
                isLoading: _isSubmitting,
                onPressed: () async {
                  if (provider.orderItems.isEmpty) {
                    await _deleteOrder(token, orderId);
                  } else {
                    await _updateOrder(provider, token);
                  }
                },
              ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // AMOUNT DIFFERENCE
  // ============================================================

  Widget _buildDifference(double difference) {
    final isCollect = difference > 0;
    final amount = difference.abs();

    final color = isCollect ? AppColors.warning : AppColors.success;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(
            isCollect
                ? Icons.arrow_upward_rounded
                : Icons.arrow_downward_rounded,
            size: 18,
            color: color,
          ),

          AppGaps.w8,
          Expanded(
            child: Text(
              isCollect
                  ? context.l10n.customerNeedsToPay(formatPrice(amount))
                  : context.l10n.giveBackToCustomer(formatPrice(amount)),
              style: AppTextStyles.caption.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // ROW
  // ============================================================

  Widget _row(String title, String value) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: AppTextStyles.body.copyWith(color: AppColors.grey500),
          ),
        ),
        AppGaps.w8,
        Text(
          value,
          style: AppTextStyles.body.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.grey600,
          ),
        ),
      ],
    );
  }
}

/// "060" -> "60" (a lone "0" stays), keeping the cursor at the end.
final noLeadingZeros = TextInputFormatter.withFunction((old, value) {
  final t = value.text.replaceFirst(RegExp(r'^0+(?=\d)'), '');
  return t == value.text
      ? value
      : TextEditingValue(
          text: t,
          selection: TextSelection.collapsed(offset: t.length),
        );
});
