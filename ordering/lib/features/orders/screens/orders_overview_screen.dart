import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/widgets/orders_overview_card.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/widgets/date_range_filter.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';

class OrdersOverviewScreen extends StatefulWidget {
  const OrdersOverviewScreen({super.key});

  @override
  State<OrdersOverviewScreen> createState() => _OrdersOverviewScreenState();
}

class _OrdersOverviewScreenState extends State<OrdersOverviewScreen> {
  bool _init = false;
  bool _loadFailed = false;
  String? _lastLoadedCartId;

  // ==========================================================================
  // DATE RANGE
  // ==========================================================================

  late DateTime _startDate;
  late DateTime _endDate;

  String? _selectedPreset = 'today';

  static const List<Map<String, String>> _presets = [
    {'key': 'today'},
    {'key': 'yesterday'},
    {'key': 'last7'},
    {'key': 'last30'},
  ];


  // ==========================================================================
  // INIT
  // ==========================================================================

  @override
  void initState() {
    super.initState();

    final today = DateTime.now();

    _startDate = DateTime(today.year, today.month, today.day);

    _endDate = DateTime(today.year, today.month, today.day);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final cartId = context.read<CartProvider>().selectedCart?.id;

    if (!_init || (cartId != null && cartId != _lastLoadedCartId)) {
      _init = true;
      _lastLoadedCartId = cartId;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;

        _loadOrders();
      });
    }
  }

  // ==========================================================================
  // LOAD ORDERS
  // ==========================================================================

  Future<void> _loadOrders() async {
    if (!mounted) return;

    final authProvider = context.read<AuthProvider>();

    final cartProvider = context.read<CartProvider>();

    final orderProvider = context.read<OrderProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    setState(() => _loadFailed = false);
    try {
      await orderProvider.loadAllOrders(
        authProvider.token!,
        cartId,
        _startDate.toString(),
        _endDate.toString(),
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

  // ==========================================================================
  // APPLY PRESET
  // ==========================================================================

  Future<void> _applyPreset(String presetKey) async {
    final today = DateTime.now();

    final todayStart = DateTime(today.year, today.month, today.day);

    DateTime start;
    DateTime end = todayStart;

    switch (presetKey) {
      case 'yesterday':
        start = todayStart.subtract(const Duration(days: 1));
        end = start;
        break;

      case 'last7':
        start = todayStart.subtract(const Duration(days: 6));
        break;

      case 'last30':
        start = todayStart.subtract(const Duration(days: 29));
        break;

      case 'today':
      default:
        start = todayStart;
    }

    setState(() {
      _selectedPreset = presetKey;
      _startDate = start;
      _endDate = end;
    });

    if (!mounted) return;

    final authProvider = context.read<AuthProvider>();

    final cartProvider = context.read<CartProvider>();

    final orderProvider = context.read<OrderProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    try {
      await orderProvider.loadAllOrders(
        authProvider.token!,
        cartId,
        start.toString(),
        end.toString(),
      );
    } catch (e) {
      if (!mounted) return;
      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        isError: true,
      );
    }
  }

  // ==========================================================================
  // PICK DATE
  // ==========================================================================

  Future<void> _pickDate({required bool isStart}) async {
    final initialDate = isStart ? _startDate : _endDate;

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );

    if (picked == null) return;

    // Important:
    // showDatePicker is an async gap.
    if (!mounted) return;

    setState(() {
      // Manual date selection removes preset selection.
      _selectedPreset = null;

      if (isStart) {
        _startDate = picked;

        // Start cannot be after end.
        if (_endDate.isBefore(_startDate)) {
          _endDate = _startDate;
        }
      } else {
        _endDate = picked;

        // End cannot be before start.
        if (_startDate.isAfter(_endDate)) {
          _startDate = _endDate;
        }
      }
    });

    final authProvider = context.read<AuthProvider>();

    final cartProvider = context.read<CartProvider>();

    final orderProvider = context.read<OrderProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    try {
      await orderProvider.loadAllOrders(
        authProvider.token!,
        cartId,
        _startDate.toString(),
        _endDate.toString(),
      );
    } catch (e) {
      if (!mounted) return;
      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        isError: true,
      );
    }
  }

  // ==========================================================================
  // DATE FORMAT
  // ==========================================================================

  // ==========================================================================
  // BUILD
  // ==========================================================================

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();
    final orders = provider.ordersOverview;

    return BaseScreen(
      onBack: () => Navigator.pop(context),
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.ordersOverview, style: AppTextStyles.heading1),
          AppGaps.h12,
          const CartSelector(),
        ],
      ),
      expandToFullHeight: true,
      child: RefreshIndicator(
        onRefresh: _loadOrders,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            DateRangeFilter(
              start: _startDate,
              end: _endDate,
              presets: [for (final p in _presets) p['key']!],
              selectedPreset: _selectedPreset,
              onPickDate: (isStart) => _pickDate(isStart: isStart),
              onPreset: _applyPreset,
            ),
            AppGaps.h24,
            _ordersContent(provider, orders),
          ],
        ),
      ),
    );
  }

  // ==========================================================================
  // ORDERS CONTENT
  //
  // Only Orders Status + Orders are affected by loading.
  // ==========================================================================

  Widget _ordersContent(OrderProvider provider, List<OrderModel> orders) {
    return Stack(
      children: [
        // ======================================================================
        // EXISTING DATA
        // ======================================================================
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _orderStatusCard(provider),

            AppGaps.h16,

            _ordersSection(orders),
          ],
        ),

        // ======================================================================
        // LOADING OVERLAY
        //
        // Header and filters are completely unaffected.
        // Previous order data stays visible.
        // ======================================================================
        if (provider.isOverviewLoading)
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.white.withValues(alpha: 0.70),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ==========================================================================
  // ORDER STATUS
  // ==========================================================================

  Widget _orderStatusCard(OrderProvider provider) {
    final orders = provider.ordersOverview;

    final servedOrders = orders
        .where((order) => order.status == 'SERVED')
        .length;

    final cancelledOrders = orders
        .where((order) => order.status == 'CANCELLED')
        .length;

    final paidOrders = orders.where((order) => order.status == 'PAID').length;

    final unpaidOrders = orders
        .where((order) => order.status == 'PENDING')
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.ordersStatus, style: AppTextStyles.heading2),
        AppGaps.h12,
        // Wrap, so pills drop to a new line instead of scrolling off-screen.
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _statusPill(context.l10n.unpaid, unpaidOrders, AppColors.warning),
            _statusPill(context.l10n.paid, paidOrders, AppColors.primary),
            _statusPill(context.l10n.served, servedOrders, AppColors.success),
            _statusPill(context.l10n.cancelled, cancelledOrders, AppColors.error),
          ],
        ),
      ],
    );
  }

  // ==========================================================================
  // STATUS PILL
  // ==========================================================================

  Widget _statusPill(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$label $count',
        style: AppTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  // ==========================================================================
  // ORDERS SECTION
  // ==========================================================================

  Widget _ordersSection(List<OrderModel> orders) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.orders, style: AppTextStyles.heading2),
        AppGaps.h12,
        if (orders.isEmpty && _loadFailed)
          ListMessage.failed(
            message: context.l10n.couldntLoadOrders,
            onRetry: _loadOrders,
          )
        else if (orders.isEmpty)
          ListMessage(
            icon: Icons.receipt_long_outlined,
            message: context.l10n.noOrdersInPeriod,
          )
        else
          for (final order in orders)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: OrdersOverviewCard(order: order),
            ),
      ],
    );
  }
}
