import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/widgets/orders_overview_card.dart';
import 'package:provider/provider.dart';

class OrdersOverviewScreen extends StatefulWidget {
  const OrdersOverviewScreen({super.key});

  @override
  State<OrdersOverviewScreen> createState() => _OrdersOverviewScreenState();
}

class _OrdersOverviewScreenState extends State<OrdersOverviewScreen> {
  bool _init = false;
  String? _lastLoadedCartId;

  // ==========================================================================
  // DATE RANGE
  // ==========================================================================

  late DateTime _startDate;
  late DateTime _endDate;

  String? _selectedPreset = 'today';

  static const List<Map<String, String>> _presets = [
    {'key': 'today', 'label': 'Today'},
    {'key': 'yesterday', 'label': 'Yesterday'},
    {'key': 'last7', 'label': 'Last 7 Days'},
    {'key': 'last30', 'label': 'Last 30 Days'},
  ];

  static const List<String> _monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
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

    await orderProvider.loadAllOrders(
      authProvider.token!,
      cartId,
      _startDate.toString(),
      _endDate.toString(),
    );
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

    await orderProvider.loadAllOrders(
      authProvider.token!,
      cartId,
      start.toString(),
      end.toString(),
    );
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

    await orderProvider.loadAllOrders(
      authProvider.token!,
      cartId,
      _startDate.toString(),
      _endDate.toString(),
    );
  }

  // ==========================================================================
  // DATE FORMAT
  // ==========================================================================

  String _formatDisplayDate(DateTime date) {
    final month = _monthNames[date.month - 1];

    return '${date.day.toString().padLeft(2, '0')} '
        '$month ${date.year}';
  }

  // ==========================================================================
  // SWITCH CART
  // ==========================================================================

  void openSwitchCartSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SwitchCartScreen(isDraggable: true),
    );
  }

  // ==========================================================================
  // BUILD
  // ==========================================================================

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();

    final orders = provider.ordersOverview;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadOrders,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              AppGaps.h16,

              // =================================================================
              // HEADER
              //
              // This NEVER disappears when filters change.
              // =================================================================
              AppHeader(
                title: '',
                showBack: true,
                actionWidget: _buildOutletSelector(context),
              ),

              AppGaps.h16,

              Padding(
                padding: AppPadding.horizontalScreen,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Orders Overview', style: AppTextStyles.heading2),

                    // =============================================================
                    // DATE FILTER
                    //
                    // This NEVER reloads.
                    // =============================================================
                    AppGaps.h16,
                    
                    _dateFilter(),

                    AppGaps.h16,

                    // =============================================================
                    // ONLY THIS SECTION LOADS
                    // =============================================================
                    _ordersContent(provider, orders),

                    AppGaps.h40,
                  ],
                ),
              ),
            ],
          ),
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
        if (provider.isLoading)
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
  // DATE FILTER
  // ==========================================================================

  Widget _dateFilter() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Date Range', style: AppTextStyles.heading3),

        AppGaps.h8,

        Row(
          children: [
            Expanded(
              child: _dateBox(
                _startDate,
                onTap: () => _pickDate(isStart: true),
              ),
            ),

            AppGaps.w8,

            Expanded(
              child: _dateBox(_endDate, onTap: () => _pickDate(isStart: false)),
            ),
          ],
        ),

        AppGaps.h12,

        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _presets.map((preset) {
              final isLast = preset == _presets.last;

              return Padding(
                padding: EdgeInsets.only(right: isLast ? 0 : 8),
                child: _presetChip(preset['label']!, preset['key']!),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ==========================================================================
  // DATE BOX
  // ==========================================================================

  Widget _dateBox(DateTime date, {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.grey200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.calendar_today_outlined,
              size: 16,
              color: AppColors.grey500,
            ),

            AppGaps.w8,

            Flexible(
              child: Text(
                _formatDisplayDate(date),
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================================
  // PRESET CHIP
  // ==========================================================================

  Widget _presetChip(String label, String presetKey) {
    final isSelected = _selectedPreset == presetKey;

    return GestureDetector(
      onTap: () => _applyPreset(presetKey),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.grey200,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppColors.primary.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.05),
              blurRadius: isSelected ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Text(
          label,
          style: AppTextStyles.body.copyWith(
            color: isSelected ? AppColors.white : AppColors.black,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
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
        Text('Orders Status', style: AppTextStyles.heading3),

        AppGaps.h8,

        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _statusPill('Unpaid', unpaidOrders, AppColors.warning),

              AppGaps.w8,

              _statusPill('Paid', paidOrders, AppColors.primary),

              AppGaps.w8,

              _statusPill('Served', servedOrders, AppColors.success),

              AppGaps.w8,

              _statusPill('Cancelled', cancelledOrders, AppColors.error),
            ],
          ),
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
        borderRadius: BorderRadius.circular(10),
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
        Text('Orders', style: AppTextStyles.heading3),

        AppGaps.h8,

        if (orders.isEmpty)
          _sectionCard(
            child: Text(
              'No orders in this period yet',
              style: AppTextStyles.caption,
            ),
          )
        else
          ...orders.map(
            (order) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OrdersOverviewCard(order: order),
            ),
          ),
      ],
    );
  }

  // ==========================================================================
  // SHARED CARD
  // ==========================================================================

  BoxDecoration _card() {
    return BoxDecoration(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.grey200, width: 1),
      boxShadow: [
        BoxShadow(
          color: AppColors.black.withValues(alpha: 0.05),
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  Widget _sectionCard({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: AppPadding.card,
      decoration: _card(),
      child: child,
    );
  }

  // ==========================================================================
  // OUTLET / SWITCH CART
  // ==========================================================================

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
                  width: 90,
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
}
