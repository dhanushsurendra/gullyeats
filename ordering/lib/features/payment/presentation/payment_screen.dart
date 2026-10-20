import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/models/payment_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/payment/widgets/payment_history_tile.dart';
import 'package:provider/provider.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool _init = false;
  String? _lastLoadedCartId;

  // ==========================================================================
  // DATE FILTER STATE
  // ==========================================================================

  late DateTime _startDate;
  late DateTime _endDate;

  String? _selectedPreset = 'today';

  static const List<Map<String, String>> _presets = [
    {'key': 'today', 'label': 'Today'},
    {'key': 'yesterday', 'label': 'Yesterday'},
    {'key': 'week', 'label': 'Week'},
    {'key': 'last30days', 'label': 'Last 30 Days'},
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

        _loadPaymentHistory();
      });
    }
  }

  // ==========================================================================
  // LOAD PAYMENT HISTORY
  // ==========================================================================

  Future<void> _loadPaymentHistory() async {
    if (!mounted) return;

    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    await paymentProvider.loadPaymentHistory(
      authProvider.token,
      cartId,
      startDate: _startDate,
      endDate: _endDate,
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

      case 'week':
        start = todayStart.subtract(const Duration(days: 6));
        break;

      case 'last30days':
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

    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    await paymentProvider.loadPaymentHistory(
      authProvider.token,
      cartId,
      startDate: start,
      endDate: end,
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

    // The date picker is an async gap.
    // Make sure this screen still exists before using context/setState.
    if (!mounted) return;

    setState(() {
      // Manual date selection removes the preset selection.
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

    // Read providers only after confirming the widget is still mounted.
    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) return;

    await paymentProvider.loadPaymentHistory(
      authProvider.token,
      cartId,
      startDate: _startDate,
      endDate: _endDate,
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

  void _openSwitchCartSheet() {
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
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadPaymentHistory,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              AppGaps.h16,

              // =================================================================
              // HEADER
              // =================================================================
              AppHeader(
                title: '',
                showBack: true,
                actionWidget: _buildOutletSelector(),
              ),

              AppGaps.h16,

              // =================================================================
              // CONTENT
              // =================================================================
              Padding(
                padding: AppPadding.horizontalScreen,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ===========================================================
                    // TITLE
                    // ===========================================================
                    Text('Transaction History', style: AppTextStyles.heading2),

                    AppGaps.h16,

                    // ===========================================================
                    // DATE RANGE
                    // ===========================================================
                    _dateFilter(),

                    AppGaps.h24,

                    // ===========================================================
                    // TRANSACTIONS
                    // ===========================================================
                    Consumer<PaymentProvider>(
                      builder: (_, paymentProvider, _) {
                        return _buildTransactionList(paymentProvider);
                      },
                    ),

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
  // DATE FILTER
  // ==========================================================================

  Widget _dateFilter() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Date Range', style: AppTextStyles.heading3),

        AppGaps.h8,

        // ======================================================================
        // START + END DATE
        // ======================================================================
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

        // ======================================================================
        // PRESETS
        // ======================================================================
        _buildFilters(),
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
  // FILTERS
  // ==========================================================================

  Widget _buildFilters() {
    return SingleChildScrollView(
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
  // TRANSACTION LIST
  // ==========================================================================

  Widget _buildTransactionList(PaymentProvider paymentProvider) {
    final history = paymentProvider.history;
    final currentPayment = paymentProvider.currentPayment;

    // ========================================================================
    // INITIAL LOADING
    //
    // Only show a spinner when there are no existing transactions.
    // ========================================================================

    if (history.isEmpty && paymentProvider.isHistoryLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 50),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    // ========================================================================
    // ERROR
    // ========================================================================

    if (history.isEmpty && paymentProvider.error != null) {
      return Container(
        width: double.infinity,
        padding: AppPadding.card,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 36, color: AppColors.error),

            AppGaps.h8,

            Text(
              paymentProvider.error!,
              textAlign: TextAlign.center,
              style: AppTextStyles.caption,
            ),

            AppGaps.h8,

            TextButton(
              onPressed: _loadPaymentHistory,
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    // ========================================================================
    // EMPTY
    // ========================================================================

    if (history.isEmpty) {
      return Container(
        width: double.infinity,
        padding: AppPadding.card,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'No transactions in this period yet',
          style: AppTextStyles.caption,
        ),
      );
    }

    // ========================================================================
    // TRANSACTION LIST
    // ========================================================================

    return Stack(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Transactions', style: AppTextStyles.heading3),

            AppGaps.h12,

            ...history.map((payment) {
              final isCurrentPending =
                  currentPayment != null &&
                  currentPayment.id == payment.id &&
                  payment.isPending;

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _transactionItem(
                  payment,
                  isCurrentPending: isCurrentPending,
                ),
              );
            }),
          ],
        ),

        // ======================================================================
        // LOADING OVERLAY
        //
        // Existing transactions stay visible.
        // ======================================================================
        if (paymentProvider.isHistoryLoading)
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
  // TRANSACTION ITEM
  // ==========================================================================

  Widget _transactionItem(
    PaymentModel payment, {
    required bool isCurrentPending,
  }) {
    // ========================================================================
    // NORMAL PAYMENT
    // ========================================================================

    if (!isCurrentPending) {
      return PaymentHistoryTile(payment: payment);
    }

    // ========================================================================
    // CURRENT PENDING PAYMENT
    // ========================================================================

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warning, width: 2),
        color: AppColors.warning.withValues(alpha: 0.06),
        boxShadow: [
          BoxShadow(
            color: AppColors.warning.withValues(alpha: 0.12),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.12),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(14),
                topRight: Radius.circular(14),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.pending_actions_rounded,
                  size: 16,
                  color: AppColors.warning,
                ),

                AppGaps.w8,

                Text(
                  'CURRENT PENDING TRANSACTION',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),

          PaymentHistoryTile(payment: payment),
        ],
      ),
    );
  }

  // ==========================================================================
  // OUTLET / SWITCH CART SELECTOR
  // ==========================================================================

  Widget _buildOutletSelector() {
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
          onTap: _openSwitchCartSheet,
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
