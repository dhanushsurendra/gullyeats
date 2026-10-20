import 'package:flutter/material.dart';
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

class AddNewOrder extends StatefulWidget {
  final OrderModel? existingOrder;

  const AddNewOrder({super.key, this.existingOrder});

  bool get isEditing => existingOrder != null;

  @override
  State<AddNewOrder> createState() => _AddNewOrderState();
}

class _AddNewOrderState extends State<AddNewOrder> {
  String searchQuery = '';

  bool _editOrderInitialized = false;
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
      text: widget.existingOrder?.parcelCharge.toStringAsFixed(0) ?? '0',
    );

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      _orderProvider = context.read<OrderProvider>();
      _orderProvider.addListener(_handleProviderChange);

      _cartProvider = context.read<CartProvider>();
      _authProvider = context.read<AuthProvider>();
      await _orderProvider.loadMenu(
        _authProvider.token!,
        _cartProvider.selectedCart!.id,
      );

      if (!mounted) return;

      // Populate existing order first
      if (widget.isEditing) {
        _initializeEditOrder(_orderProvider.menu, _orderProvider);
      } else {
        _orderProvider.clearOrder();
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

  void _handleProviderChange() {
    if (!mounted) return;

    // If there are no items, reset parcel charge
    if (_orderProvider.orderItems.isEmpty &&
        parcelChargeController.text != '0') {
      parcelChargeController.text = '0';
    }
  }

  @override
  void dispose() {
    _orderProvider.removeListener(_handleProviderChange);
    parcelChargeController.dispose();

    super.dispose();
  }

  // ============================================================
  // INITIALIZE EDIT ORDER
  // ============================================================

  void _initializeEditOrder(List<MenuItemModel> menu, OrderProvider provider) {
    if (!widget.isEditing || _editOrderInitialized) {
      return;
    }

    if (provider.isLoading || menu.isEmpty) {
      return;
    }

    _editOrderInitialized = true;

    provider.clearOrder();

    final order = widget.existingOrder!;

    for (final orderItem in order.orderItems) {
      final matches = menu.where((item) => item.id == orderItem.menuItemId);

      if (matches.isEmpty) {
        continue;
      }

      final item = matches.first;

      for (int i = 0; i < orderItem.quantity; i++) {
        provider.addItem(item);
      }
    }

    provider.setParcelPrice(order.parcelCharge);

    parcelChargeController.text = order.parcelCharge.toStringAsFixed(0);
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

    final orderData = {
      "cartId": cartId,
      "orderType": "MANUAL",
      "status": isPaid ? "PAID" : "PENDING",
      "orderItems": provider.orderItems,
      "subtotal": provider.subtotal,
      "platformFee": provider.platformFee,
      "totalPrice": provider.total,
      "parcelCharge": provider.parcelPrice > 0 ? provider.parcelPrice : 0,
    };

    try {
      await provider.createOrder(token, orderData);

      provider.clearOrder();

      if (!mounted) return;

      Navigator.pop(context);

      AppSnackBar.show(
        context,
        message: isPaid
            ? "Order created and marked as paid."
            : "Order created successfully.",
      );
    } catch (e) {
      if (!mounted) return;

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

      AppSnackBar.show(context, isInfo: true, message: "Order deleted");

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
        "subtotal": provider.subtotal,
        "parcelCharge": provider.parcelPrice,
        "platformFee": provider.platformFee,
        "totalPrice": newTotal,
      };

      final updatedOrder = await provider.updateOrder(
        token,
        oldOrder.id,
        orderData,
      );

      if (!mounted) return;

      Navigator.pop(context, updatedOrder);

      AppSnackBar.show(context, message: "Order updated successfully");
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

    // DELETE THIS BLOCK
    if (widget.isEditing &&
        !_editOrderInitialized &&
        !provider.isLoading &&
        menu.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _initializeEditOrder(menu, provider);
      });
    }

    final filteredMenu = menu
        .where(
          (item) => item.name.toLowerCase().contains(searchQuery.toLowerCase()),
        )
        .toList();

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
                      padding: const EdgeInsets.all(16),
                      child: AppSearchBar(
                        hintText: "Search items...",
                        onChanged: _onSearchChanged,
                      ),
                    ),

                    Padding(
                      padding: AppPadding.horizontalScreen,
                      child: Text(
                        "Menu Items",
                        style: AppTextStyles.heading2.copyWith(fontSize: 16),
                      ),
                    ),

                    AppGaps.h12,

                    // ------------------------------------------------
                    // MENU
                    // ------------------------------------------------
                    provider.isLoading
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.all(30),
                              child: CircularProgressIndicator(),
                            ),
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
      padding: AppPadding.screen.copyWith(bottom: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: _isSubmitting
                ? null
                : () {
                    context.read<OrderProvider>().clearOrder();
                    Navigator.pop(context);
                  },
            child: const Icon(Icons.close, size: 20, color: AppColors.grey600),
          ),

          const Spacer(),

          Text(
            widget.isEditing ? "Update Order" : "Create Order",
            style: AppTextStyles.heading2,
          ),

          const Spacer(),

          Container(
            padding: AppPadding.chip,
            decoration: BoxDecoration(
              color: AppColors.grey200,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Text(
              widget.isEditing
                  ? "#${widget.existingOrder!.orderNumber}"
                  : "MANUAL",
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.grey500,
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

    return AppCard(
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
                  item.name,
                  style: AppTextStyles.heading3.copyWith(
                    color: AppColors.black,
                  ),
                ),

                AppGaps.h4,

                Text(
                  "₹${item.price.toStringAsFixed(0)}",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey500,
                  ),
                ),
              ],
            ),
          ),

          Row(
            children: [
              _qtyBtn(
                Icons.remove,
                count > 0 ? () => provider.removeItem(item) : null,
                false,
              ),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  "$count",
                  style: AppTextStyles.heading3.copyWith(
                    color: AppColors.black,
                  ),
                ),
              ),

              _qtyBtn(Icons.add, () => provider.addItem(item), true),
            ],
          ),
        ],
      ),
    );
  }

  // ============================================================
  // QUANTITY BUTTON
  // ============================================================

  Widget _qtyBtn(IconData icon, VoidCallback? onTap, bool isAdd) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isAdd ? AppColors.primary : AppColors.white,
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            "Parcel Charges",
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w500),
          ),

          SizedBox(
            width: 100,
            child: AppInput(
              controller: parcelChargeController,
              keyboardType: TextInputType.number,
              prefix: const Align(
                alignment: Alignment.center,
                widthFactor: 1,
                heightFactor: 1,
                child: Text("₹"),
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
    final orderStatus = widget.existingOrder?.status ?? "PENDING";

    final newTotal = provider.total;

    final difference = widget.isEditing ? newTotal - oldTotal : 0.0;

    return Container(
      padding: AppPadding.screen,
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.grey200)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _row("Subtotal", "₹${provider.subtotal.toStringAsFixed(0)}"),

          AppGaps.h4,

          _row("Platform Fee", "₹${provider.platformFee.toStringAsFixed(0)}"),

          AppGaps.h4,

          _row("Parcel", "₹${provider.parcelPrice.toStringAsFixed(0)}"),

          if (widget.isEditing) ...[
            AppGaps.h8,

            _row("Previous Total", "₹${oldTotal.toStringAsFixed(0)}"),
          ],

          AppGaps.h12,

          const Divider(height: 1, color: AppColors.grey200),

          AppGaps.h12,

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.isEditing ? "NEW TOTAL" : "TOTAL",
                style: AppTextStyles.heading2.copyWith(fontSize: 16),
              ),
              Text(
                "₹${newTotal.toStringAsFixed(0)}",
                style: AppTextStyles.heading1.copyWith(
                  color: AppColors.primary,
                  fontSize: 22,
                ),
              ),
            ],
          ),

          if (widget.isEditing && difference != 0 && orderStatus == "PAID") ...[
            AppGaps.h12,
            _buildDifference(difference),
          ],

          AppGaps.h16,

          // --------------------------------------------------------
          // CREATE MODE
          // --------------------------------------------------------
          if (!widget.isEditing)
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: AppButton(
                      disabled: provider.orderItems.isEmpty || _isSubmitting,
                      label: "SKIP",
                      isLoading: _isSubmitting && !_isMarkingPaid,
                      onPressed: () async {
                        await _createOrder(false, provider, token, cartId);
                      },
                    ),
                  ),
                ),

                AppGaps.w12,

                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: AppButton(
                      disabled: provider.orderItems.isEmpty || _isSubmitting,
                      label: "MARK AS PAID",
                      isLoading: _isSubmitting && _isMarkingPaid,
                      onPressed: () async {
                        await _createOrder(true, provider, token, cartId);
                      },
                    ),
                  ),
                ),
              ],
            ),

          // --------------------------------------------------------
          // EDIT MODE
          // --------------------------------------------------------
          if (widget.isEditing)
            SizedBox(
              width: double.infinity,
              height: 48,
              child: AppButton(
                disabled: _isSubmitting,
                label: provider.orderItems.isEmpty
                    ? "DELETE ORDER"
                    : "UPDATE ORDER",
                isLoading: _isSubmitting,
                onPressed: () async {
                  if (provider.orderItems.isEmpty) {
                    await _deleteOrder(token, orderId);
                  } else {
                    await _updateOrder(provider, token);
                  }
                },
              ),
            ),
        ],
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
        borderRadius: BorderRadius.circular(10),
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
                  ? "Customer needs to pay ₹${amount.toStringAsFixed(0)} more"
                  : "Give ₹${amount.toStringAsFixed(0)} back to customer",
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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: AppTextStyles.body.copyWith(color: AppColors.grey500),
        ),
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
