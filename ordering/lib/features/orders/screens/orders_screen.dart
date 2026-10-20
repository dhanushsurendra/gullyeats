import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/widgets/app_tab_filter.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/stock_screen.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';
import 'package:ordering/features/orders/widgets/order_card.dart';
import 'package:provider/provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  bool _isInit = false;
  String selectedTab = "Active";
  final tabs = ["All", "Active", "QR Orders", "Manual", "Stock"];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInit) {
      _isInit = true;
      _loadOrders();
    }
  }

  Future<void> _loadOrders() async {
    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    final orderProvider = context.read<OrderProvider>();

    await authProvider.loadToken();
    await cartProvider.loadSelectedCart();

    final token = authProvider.token;
    final cartId = cartProvider.selectedCart?.id;

    if (token == null || cartId == null) {
      return;
    }

    await orderProvider.loadOrders(token, cartId);
  }

  void _showCreateOrderSheet(BuildContext context) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const AddNewOrder(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(0.0, 1.0);
          const end = Offset.zero;
          const curve = Curves.easeOutExpo;

          var tween = Tween(
            begin: begin,
            end: end,
          ).chain(CurveTween(curve: curve));
          var offsetAnimation = animation.drive(tween);

          return SlideTransition(position: offsetAnimation, child: child);
        },
        opaque: false,
        barrierDismissible: true,
        barrierColor: Colors.black54,
      ),
    );
  }

  void openSwitchCartSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return SwitchCartScreen(isDraggable: true);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();
    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();

    List<OrderModel> filteredOrders;
    switch (selectedTab) {
      case "Active":
        filteredOrders = provider.orders
            .where((o) => o.status == "PENDING" || o.status == "PAID")
            .toList();
        break;
      case "QR Orders":
        filteredOrders = provider.orders.where((o) => o.isQrOrder).toList();
        break;
      case "Manual":
        filteredOrders = provider.orders.where((o) => !o.isQrOrder).toList();
        break;
      case "All":
      default:
        filteredOrders = provider.orders;
    }

    String getOrdersTitle(String selectedTab, List<OrderModel> orders) {
      late List<OrderModel> filteredOrders;

      switch (selectedTab) {
        case "Active":
          filteredOrders = orders
              .where(
                (order) => order.status == "PENDING" || order.status == "PAID",
              )
              .toList();
          break;

        case "QR":
          filteredOrders = orders
              .where((order) => order.orderType == "QR")
              .toList();
          break;

        case "Manual":
          filteredOrders = orders
              .where((order) => order.orderType == "MANUAL")
              .toList();
          break;

        case "All":
        default:
          filteredOrders = orders;
          break;
      }

      return "${selectedTab == "Active"
          ? "Active"
          : selectedTab == "All"
          ? "All"
          : selectedTab} Orders (${filteredOrders.length})";
    }

    Future<void> markOrderServed(String token, String orderId) async {
      try {
        final provider = context.read<OrderProvider>();

        await provider.serveOrder(token, orderId);

        if (!context.mounted) return;

        ScaffoldMessenger.of(context).clearSnackBars();

        AppSnackBar.show(
          context,
          isInfo: true,
          message: "Order marked as served",
          action: SnackBarAction(
            label: 'UNDO',
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.serveOrderUndo(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: 'Serve reverted');
                }
              } catch (e) {
                final message = AppExceptionHandler.getMessage(e);

                if (!context.mounted) return;

                AppSnackBar.show(context, message: message, isError: true);
              }
            },
          ),
        );

        final messenger = ScaffoldMessenger.of(context);

        Future.delayed(const Duration(seconds: 3), () {
          messenger.hideCurrentSnackBar();
        });
      } catch (e) {
        final message = AppExceptionHandler.getMessage(e);
        if (mounted) {
          AppSnackBar.show(context, message: message, isError: true);
        }
      }
    }

    Future<void> markOrderPaid(String token, String orderId) async {
      try {
        final provider = context.read<OrderProvider>();

        await provider.markOrderPaid(token, orderId);

        if (!context.mounted) return;

        ScaffoldMessenger.of(context).clearSnackBars();

        AppSnackBar.show(
          context,
          isInfo: true,
          message: "Order marked as paid",
          action: SnackBarAction(
            label: 'UNDO',
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.markOrderUnpaid(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: 'Payment reverted');
                }
              } catch (e) {
                final message = AppExceptionHandler.getMessage(e);

                if (!context.mounted) return;

                AppSnackBar.show(context, message: message, isError: true);
              }
            },
          ),
        );

        final messenger = ScaffoldMessenger.of(context);

        Future.delayed(const Duration(seconds: 3), () {
          messenger.hideCurrentSnackBar();
        });
      } catch (e) {
        final message = AppExceptionHandler.getMessage(e);
        if (mounted) {
          AppSnackBar.show(context, message: message, isError: true);
        }
      }
    }

    Future<void> deleteOrder(String token, String orderId) async {
      try {
        final provider = context.read<OrderProvider>();

        await provider.deleteOrder(token, orderId);

        if (!context.mounted) return;

        ScaffoldMessenger.of(context).clearSnackBars();

        AppSnackBar.show(
          context,
          isInfo: true,
          message: "Order cancelled",
          action: SnackBarAction(
            label: 'UNDO',
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.deleteOrderUndo(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: 'Order restored');
                }
              } catch (e) {
                final message = AppExceptionHandler.getMessage(e);

                if (!context.mounted) return;

                AppSnackBar.show(context, message: message, isError: true);
              }
            },
          ),
        );

        final messenger = ScaffoldMessenger.of(context);

        Future.delayed(const Duration(seconds: 3), () {
          messenger.hideCurrentSnackBar();
        });
      } catch (e) {
        final message = AppExceptionHandler.getMessage(e);

        if (mounted) {
          AppSnackBar.show(context, message: message, isError: true);
        }
      }
    }

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Padding(
                  padding: const EdgeInsets.only(
                    left: 16.0,
                    right: 16.0,
                    top: 16,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Image.asset(
                            "assets/images/logo_text.png",
                            height: 24,
                            fit: BoxFit.contain,
                          ),
                          const Spacer(),
                          _buildOutletSelector(context),
                        ],
                      ),
                      AppGaps.h16,
                      Text(
                        getOrdersTitle(selectedTab, filteredOrders),
                        style: AppTextStyles.heading2,
                      ),
                      AppGaps.h16,
                      AppTabFilter(
                        tabs: tabs,
                        selectedTab: selectedTab,
                        onTabSelected: (tab) {
                          if (tab == "Stock") {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const StockScreen(),
                              ),
                            );
                            return;
                          }
                          setState(() => selectedTab = tab);
                        },
                      ),
                      AppGaps.h16,
                      Expanded(
                        child: provider.isLoading
                            ? const Center(
                                child: CircularProgressIndicator(
                                  color: AppColors.primary,
                                ),
                              )
                            : RefreshIndicator(
                                color: AppColors.primary,
                                onRefresh: () => context.read<OrderProvider>().loadOrders(
                                      authProvider.token ?? "",
                                      cartProvider.selectedCart?.id ?? "",
                                    ),
                                child: filteredOrders.isEmpty
                                    ? ListView(
                                        physics: const AlwaysScrollableScrollPhysics(),
                                        padding: const EdgeInsets.only(bottom: 180),
                                        children: [
                                          SizedBox(
                                            height: MediaQuery.of(context).size.height * 0.55,
                                            child: _buildEmptyState(),
                                          ),
                                        ],
                                      )
                                    : ListView.builder(
                                        padding: const EdgeInsets.only(
                                          bottom: 180,
                                          top: 8,
                                        ),
                                        physics: const AlwaysScrollableScrollPhysics(),
                                        itemCount: filteredOrders.length,
                                        itemBuilder: (context, index) {
                                          return Padding(
                                            padding: const EdgeInsets.only(bottom: 12),
                                            child: OrderCard(
                                              onTap: filteredOrders[index].status == 'CANCELLED'
                                                  ? null
                                                  : () {
                                                      showModalBottomSheet(
                                                        context: context,
                                                        isScrollControlled: true,
                                                        backgroundColor: Colors.transparent,
                                                        builder: (_) {
                                                          return FractionallySizedBox(
                                                            heightFactor: 0.95,
                                                            child: AddNewOrder(
                                                              existingOrder: filteredOrders[index],
                                                            ),
                                                          );
                                                        },
                                                      );
                                                    },
                                              order: filteredOrders[index],
                                              onServe: () => markOrderServed(
                                                authProvider.token ?? "",
                                                filteredOrders[index].id,
                                              ),
                                              onMarkPaid: () => markOrderPaid(
                                                authProvider.token ?? "",
                                                filteredOrders[index].id,
                                              ),
                                              onDelete: () => deleteOrder(
                                                authProvider.token ?? "",
                                                filteredOrders[index].id,
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                              ),
                      )
                    ],
                  ),
                ),
              ),
            ),

            Positioned(
              right: 16,
              bottom: 100,
              child: FloatingActionButton(
                onPressed: () => _showCreateOrderSheet(context),
                backgroundColor: AppColors.primary,
                shape: const CircleBorder(),
                elevation: 4,
                child: const Icon(Icons.add, color: AppColors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOutletSelector(BuildContext context) {
    return Consumer<CartProvider>(
      builder: (_, cartProvider, _) {
        final carts = cartProvider.carts;

        if (carts.isEmpty) {
          return const SizedBox.shrink();
        }

        final cart = cartProvider.selectedCart;

        if (cart == null) {
          return const SizedBox.shrink();
        }

        return GestureDetector(
          onTap: () => openSwitchCartSheet(context),
          child: Container(
            padding: AppPadding.smallCard,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.grey300),
              borderRadius: BorderRadius.circular(12),
              color: AppColors.white,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 120,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        cart.cartName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.heading3.copyWith(fontSize: 14),
                      ),
                      Text(
                        cart.address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption,
                      ),
                    ],
                  ),
                ),

                AppGaps.w8,

                const Icon(
                  Icons.keyboard_arrow_down,
                  size: 18,
                  color: AppColors.grey500,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/images/no_orders.png',
            width: MediaQuery.of(context).size.width * 0.50,
            fit: BoxFit.contain,
          ),
          AppGaps.h12,
          Text(
            "No active orders",
            style: AppTextStyles.body.copyWith(color: AppColors.grey500),
          ),
        ],
      ),
    );
  }
}
