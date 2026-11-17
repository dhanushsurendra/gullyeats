import 'package:ordering/core/widgets/app_logo.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ordering/core/utils/order_alerts.dart';
import 'package:ordering/core/widgets/skeleton.dart';
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

/// Opens the "Create order" sheet. The + button that calls it sits on the
/// home screen, stacked on the bottom navigation bar (see HomeScreen).
void showCreateOrderSheet(
  BuildContext context, {
  Map<String, int>? prefill,
  double prefillParcel = 0,
}) {
  Navigator.of(context).push(
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) =>
          AddNewOrder(prefill: prefill, prefillParcel: prefillParcel),
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

/// Serves an order and offers UNDO, as the card's button does (also used
/// by voice orders).
Future<void> markOrderServedWithUndo(
  BuildContext context,
  String token,
  String orderId,
) async {
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
  } catch (e) {
    final message = AppExceptionHandler.getMessage(e);
    if (context.mounted) {
      AppSnackBar.show(context, message: message, isError: true);
    }
  }
}

/// Marks an order paid and offers UNDO, as the card's button does (also used
/// by voice orders).
Future<void> markOrderPaidWithUndo(
  BuildContext context,
  String token,
  String orderId,
) async {
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
  } catch (e) {
    final message = AppExceptionHandler.getMessage(e);
    if (context.mounted) {
      AppSnackBar.show(context, message: message, isError: true);
    }
  }
}

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
  // Refreshes the cards' "x min ago".
  Timer? _clock;
  OrderProvider? _orderProvider;

  String? _cartId;

  // Active orders as last shown (id -> status), and those that just left
  // (served or cancelled) with the section they were in. A leaving card
  // stays a moment, showing SERVED, then shrinks away so the cards below
  // slide up instead of jumping.
  Map<String, String> _shownActive = {};
  final Map<String, String> _leaving = {};
  static const _leaveFor = Duration(milliseconds: 900);

  List<OrderModel> _activeWithLeaving(List<OrderModel> all) {
    final now = {
      for (final o in all)
        if (o.status == "PENDING" || o.status == "PAID") o.id: o.status,
    };
    for (final MapEntry(key: id, value: was) in _shownActive.entries) {
      if (now.containsKey(id) || _leaving.containsKey(id)) continue;
      if (!all.any((o) => o.id == id)) continue; // deleted: nothing to show
      _leaving[id] = was;
      Future.delayed(_leaveFor, () {
        if (mounted) setState(() => _leaving.remove(id));
      });
    }
    _shownActive = now;
    return all
        .where((o) => now.containsKey(o.id) || _leaving.containsKey(o.id))
        .toList();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final cartId = context.watch<CartProvider>().selectedCart?.id;
    if (_isInit && cartId != null && cartId != _cartId) {
      // Switched from another tab: this tab stays, with the new cart's orders.
      _cartId = cartId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadOrders();
      });
    }
    if (!_isInit) {
      _isInit = true;
      _cartId = cartId;
      _orderProvider = context.read<OrderProvider>()
        ..incomingOrder.addListener(_onIncomingOrder);
      _clock = Timer.periodic(const Duration(seconds: 30), (_) {
        if (mounted) setState(() {});
      });
      _loadOrders();
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _orderProvider?.incomingOrder.removeListener(_onIncomingOrder);
    super.dispose();
  }

  /// A QR order arrived: ring once, whichever tab is open. No pop-up, so
  /// the vendor isn't interrupted; the new card glows in the list.
  void _onIncomingOrder() {
    if (_orderProvider?.incomingOrder.value == null || !mounted) return;
    OrderAlerts.newOrder();
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

  @override
  Widget build(BuildContext context) {
    // Not the order being built: see OrderProvider.ordersVersion.
    context.select<OrderProvider, int>((p) => p.ordersVersion);
    final provider = context.read<OrderProvider>();
    final authProvider = context.read<AuthProvider>();

    List<OrderModel> filteredOrders;
    switch (selectedTab) {
      case "Active":
        filteredOrders = _activeWithLeaving(provider.orders);
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
        l10n.ordersTitle(switch (selectedTab) {
          "Active" => "active",
          "QR Orders" => "qr",
          "Manual" => "manual",
          _ => "all",
        }, filteredOrders.where((o) => !_leaving.containsKey(o.id)).length);

    Future<void> markOrderServed(String token, String orderId) =>
        markOrderServedWithUndo(context, token, orderId);

    Future<void> setPreparing(
      String token,
      String orderId,
      bool preparing,
    ) async {
      try {
        await context.read<OrderProvider>().setPreparing(
          token,
          orderId,
          preparing,
        );
      } catch (e) {
        if (!context.mounted) return;
        AppSnackBar.show(
          context,
          message: AppExceptionHandler.getMessage(e),
          isError: true,
        );
      }
    }

    Future<void> markRefunded(String token, String orderId) async {
      try {
        await context.read<OrderProvider>().markRefunded(token, orderId);
      } catch (e) {
        if (!context.mounted) return;
        AppSnackBar.show(
          context,
          message: AppExceptionHandler.getMessage(e),
          isError: true,
        );
      }
    }

    Future<void> markOrderPaid(String token, String orderId) =>
        markOrderPaidWithUndo(context, token, orderId);

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
                  AppSnackBar.show(
                    context,
                    message: context.l10n.orderRestored,
                  );
                }
              } catch (e) {
                final message = AppExceptionHandler.getMessage(e);

                if (!context.mounted) return;

                AppSnackBar.show(context, message: message, isError: true);
              }
            },
          ),
        );
      } catch (e) {
        final message = AppExceptionHandler.getMessage(e);

        if (mounted) {
          AppSnackBar.show(context, message: message, isError: true);
        }
      }
    }

    Widget orderList() {
      if (provider.isOrdersLoading && provider.orders.isEmpty) {
        return const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Skeleton(heights: [150, 150, 150]),
        );
      }

      // Orders grouped by what the vendor does next.
      final sections = [
        ("PENDING", l10n.toCollect),
        ("PAID", l10n.toServe),
        ("SERVED", l10n.served),
        ("CANCELLED", l10n.cancelled),
      ];

      // One flat list (message, section headers, cards, gaps) so only the rows
      // on screen are built: a busy day has hundreds of cards.
      final rows = <Object>[
        if (_loadFailed && provider.orders.isEmpty)
          #failed
        else if (filteredOrders.isEmpty)
          #empty,
      ];
      for (final (status, label) in sections) {
        final inSection = filteredOrders
            .where((o) => (_leaving[o.id] ?? o.status) == status)
            .toList();
        if (inSection.isEmpty) continue;
        rows
          ..add((status, label, inSection.length))
          ..addAll(inSection)
          ..add(#gap);
      }

      Widget row(Object r) {
        if (r == #failed) {
          return ListMessage.failed(
            message: context.l10n.couldntLoadOrders,
            onRetry: _loadOrders,
          );
        }
        if (r == #empty) return _buildEmptyState();
        if (r == #gap) return AppGaps.h12;
        if (r is (String, String, int)) {
          return _SectionHeader(
            label: r.$2,
            color: orderStatusColor(r.$1),
            count: r.$3,
          );
        }
        final order = r as OrderModel;
        return _Collapse(
          // Keyed, so a new order on top doesn't reuse the cards below.
          key: ValueKey(order.id),
          leaving: _leaving.containsKey(order.id),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: OrderCard(
              isFresh: provider.isFresh(order.id),
              // The server refuses edits to served and cancelled orders.
              onTap: order.status == 'CANCELLED' || order.status == 'SERVED'
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
              onDelete: () => deleteOrder(authProvider.token ?? "", order.id),
              onPreparing: (on) =>
                  setPreparing(authProvider.token ?? "", order.id, on),
              onMarkRefunded: () =>
                  markRefunded(authProvider.token ?? "", order.id),
            ),
          ),
        );
      }

      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadOrders,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          // Room for the add button and the floating bottom navigation bar.
          padding: const EdgeInsets.only(top: 8, bottom: 180),
          itemCount: rows.length,
          // Cards keep their place (and animations) when an order arrives on top.
          findChildIndexCallback: (key) {
            if (key is! ValueKey<String>) return null;
            final at = rows.indexWhere(
              (r) => r is OrderModel && r.id == key.value,
            );
            return at < 0 ? null : at;
          },
          itemBuilder: (_, i) => row(rows[i]),
        ),
      );
    }

    return Stack(
      children: [
        BaseScreen(
          showBackButton: false,
          headerGap: 16,
          header: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const AppLogo(),
                  AppGaps.w16,
                  // Area alerts moved to Profile; only the cart switcher here
                  // (hidden for a single cart). Through the welcome screen.
                  const Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: CartSelector(stayOnScreen: false),
                    ),
                  ),
                ],
              ),
              AppGaps.h12,
              // Wrap: the live badge drops below a long translated title.
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                runSpacing: 4,
                children: [
                  Text(
                    getOrdersTitle(selectedTab, filteredOrders),
                    // Section size, not page size: the logo already heads the screen.
                    style: AppTextStyles.heading2.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  _LiveBadge(isLive: provider.isLive),
                ],
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
              AppGaps.h8,
              Expanded(child: orderList()),
            ],
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
          _NoOrdersArt(size: illustrationHeight(context, 180)),
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

/// Empty-orders illustration drawn from theme colours, so it sits on the page
/// in both themes: a receipt in a soft orange circle, with a clock badge.
class _NoOrdersArt extends StatelessWidget {
  final double size;
  const _NoOrdersArt({required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size * 0.82,
            height: size * 0.82,
            decoration: BoxDecoration(
              color: AppColors.lightOrange,
              shape: BoxShape.circle,
            ),
          ),
          Icon(
            Icons.receipt_long_rounded,
            size: size * 0.42,
            color: AppColors.primary,
          ),
          Positioned(
            right: size * 0.16,
            bottom: size * 0.18,
            child: Container(
              padding: EdgeInsets.all(size * 0.035),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.lightOrange, width: 3),
              ),
              child: Icon(
                Icons.schedule_rounded,
                size: size * 0.14,
                color: AppColors.grey500,
              ),
            ),
          ),
          for (final (dx, dy, r) in [
            (0.12, 0.22, 0.03),
            (0.86, 0.26, 0.022),
            (0.2, 0.84, 0.02),
          ])
            Positioned(
              left: size * dx,
              top: size * dy,
              child: Container(
                width: size * r * 2,
                height: size * r * 2,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// "● Live" (pulsing green) while new orders stream in, grey
/// "Reconnecting…" when the connection drops.
class _LiveBadge extends StatefulWidget {
  final bool isLive;

  const _LiveBadge({required this.isLive});

  @override
  State<_LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<_LiveBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void initState() {
    super.initState();
    _syncPulse();
  }

  @override
  void didUpdateWidget(_LiveBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulse();
  }

  void _syncPulse() {
    if (widget.isLive) {
      // A few beats when it goes live, then a still dot: an endless pulse
      // redraws the screen every frame all day (battery).
      if (!_pulse.isAnimating && _pulse.value == 0) _pulse.repeat(count: 3);
    } else {
      _pulse.reset();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isLive ? AppColors.success : AppColors.grey400;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) => Stack(
                alignment: Alignment.center,
                children: [
                  // The ring that grows and fades around the dot.
                  Container(
                    width: 6 + 8 * _pulse.value,
                    height: 6 + 8 * _pulse.value,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color.withValues(alpha: 0.4 * (1 - _pulse.value)),
                    ),
                  ),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AppGaps.w4,
          Flexible(
            child: Text(
              widget.isLive
                  ? context.l10n.liveStatus
                  : context.l10n.reconnecting,
              style: AppTextStyles.caption.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "● To serve  2": a coloured dot, the stage and how many orders are in it.
class _SectionHeader extends StatelessWidget {
  final String label;
  final Color color;
  final int count;

  const _SectionHeader({
    required this.label,
    required this.color,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          AppGaps.w8,
          Flexible(child: Text(label, style: AppTextStyles.heading3)),
          AppGaps.w8,
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              "$count",
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
}

/// Shrinks and fades a card out after a short pause (it just showed SERVED),
/// so the list closes up smoothly. Always in the tree, so the card keeps its
/// state when it starts leaving.
class _Collapse extends StatelessWidget {
  final bool leaving;
  final Widget child;

  const _Collapse({super.key, required this.leaving, required this.child});

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 1, end: leaving ? 0 : 1),
    duration: const Duration(milliseconds: 800),
    // The first part holds still, so the green SERVED is seen.
    curve: const Interval(0.35, 1, curve: Curves.easeInOutCubic),
    builder: (context, t, child) => ClipRect(
      child: Align(
        alignment: Alignment.topCenter,
        heightFactor: t,
        child: Opacity(opacity: t, child: child),
      ),
    ),
    child: child,
  );
}
