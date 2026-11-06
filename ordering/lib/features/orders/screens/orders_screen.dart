import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/widgets/app_tab_filter.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/stock_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';
import 'package:ordering/features/orders/widgets/order_card.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/utils/responsive.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  bool _isInit = false;
  bool _loadFailed = false;
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

    if (mounted) setState(() => _loadFailed = false);
    try {
      await orderProvider.loadOrders(token, cartId);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadFailed = true);
      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        isError: true,
      );
    }
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

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();
    final authProvider = context.read<AuthProvider>();

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

    // The tabs are English keys; these are what the user reads.
    final l10n = context.l10n;
    final tabLabels = {
      "All": l10n.all,
      "Active": l10n.active,
      "QR Orders": l10n.qrOrders,
      "Manual": l10n.manual,
      "Stock": l10n.stock,
    };
    String getOrdersTitle(String selectedTab, List<OrderModel> orders) =>
        l10n.ordersTitle(
          switch (selectedTab) {
            "Active" => "active",
            "QR Orders" => "qr",
            "Manual" => "manual",
            _ => "all",
          },
          filteredOrders.length,
        );

    Future<void> markOrderServed(String token, String orderId) async {
      try {
        final provider = context.read<OrderProvider>();

        await provider.serveOrder(token, orderId);

        if (!context.mounted) return;

        ScaffoldMessenger.of(context).clearSnackBars();

        AppSnackBar.show(
          context,
          isInfo: true,
          message: context.l10n.orderMarkedServed,
          action: SnackBarAction(
            label: context.l10n.undo.toUpperCase(),
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.serveOrderUndo(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: context.l10n.serveReverted);
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
          message: context.l10n.orderMarkedPaid,
          action: SnackBarAction(
            label: context.l10n.undo.toUpperCase(),
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.markOrderUnpaid(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: context.l10n.paymentReverted);
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
          message: context.l10n.orderCancelled,
          action: SnackBarAction(
            label: context.l10n.undo.toUpperCase(),
            textColor: AppColors.primary,
            onPressed: () async {
              try {
                await provider.deleteOrderUndo(token, orderId);

                if (context.mounted) {
                  AppSnackBar.show(context, message: context.l10n.orderRestored);
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

    Widget orderList() {
      if (provider.isOrdersLoading && provider.orders.isEmpty) {
        return const Center(child: CircularProgressIndicator());
      }
      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadOrders,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          // Room for the add button and the floating bottom navigation bar.
          padding: const EdgeInsets.only(top: 8, bottom: 180),
          children: [
            if (_loadFailed && provider.orders.isEmpty)
              ListMessage.failed(
                message: context.l10n.couldntLoadOrders,
                onRetry: _loadOrders,
              )
            else if (filteredOrders.isEmpty)
              _buildEmptyState()
            else
              for (final order in filteredOrders)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: OrderCard(
                    onTap: order.status == 'CANCELLED'
                        ? null
                        : () => showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (_) => FractionallySizedBox(
                              heightFactor: 0.95,
                              child: AddNewOrder(existingOrder: order),
                            ),
                          ),
                    order: order,
                    onServe: () =>
                        markOrderServed(authProvider.token ?? "", order.id),
                    onMarkPaid: () =>
                        markOrderPaid(authProvider.token ?? "", order.id),
                    onDelete: () =>
                        deleteOrder(authProvider.token ?? "", order.id),
                  ),
                ),
          ],
        ),
      );
    }

    return Stack(
      children: [
        BaseScreen(
          showBackButton: false,
          header: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Image.asset("assets/images/logo_text.png", height: 24),
                  AppGaps.w16,
                  const Flexible(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: CartSelector(),
                    ),
                  ),
                ],
              ),
              AppGaps.h24,
              Text(
                getOrdersTitle(selectedTab, filteredOrders),
                style: AppTextStyles.heading1,
              ),
            ],
          ),
          expandToFullHeight: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppTabFilter(
                tabs: tabs,
                labelOf: (tab) => tabLabels[tab]!,
                selectedTab: selectedTab,
                onTabSelected: (tab) {
                  if (tab == "Stock") {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const StockScreen()),
                    );
                    return;
                  }
                  setState(() => selectedTab = tab);
                },
              ),
              AppGaps.h16,
              Expanded(child: orderList()),
            ],
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
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Image.asset(
            'assets/images/no_orders.png',
            height: illustrationHeight(context, 180),
            fit: BoxFit.contain,
          ),
          AppGaps.h16,
          Text(
            switch (selectedTab) {
              "Active" => context.l10n.noActiveOrders,
              "QR Orders" => context.l10n.noQrOrdersToday,
              "Manual" => context.l10n.noManualOrdersToday,
              _ => context.l10n.noOrdersToday,
            },
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
        ],
      ),
    );
  }
}
