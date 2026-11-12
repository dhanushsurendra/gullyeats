import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/models/payment_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/payment/widgets/payment_history_tile.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/widgets/date_range_filter.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';

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
    {'key': 'today'},
    {'key': 'yesterday'},
    {'key': 'week'},
    {'key': 'last30days'},
  ];


  // ==========================================================================
  // INIT
  // ==========================================================================

  @override
  void initState() {
    super.initState();

    final today = clock.now();

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
    final today = clock.now();

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
      lastDate: clock.now(),
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
  // BUILD
  // ==========================================================================

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BaseScreen(
      onBack: () => Navigator.pop(context),
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.transactionHistory, style: AppTextStyles.heading1),
          AppGaps.h12,
          const CartSelector(),
        ],
      ),
      expandToFullHeight: true,
      child: RefreshIndicator(
        onRefresh: _loadPaymentHistory,
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
            Consumer<PaymentProvider>(
              builder: (_, paymentProvider, _) =>
                  _buildTransactionList(paymentProvider),
            ),
          ],
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
    // Only show placeholders when there are no existing transactions.
    // ========================================================================

    if (history.isEmpty && paymentProvider.isHistoryLoading) {
      return Skeleton.rows(count: 4, height: 76);
    }

    // ========================================================================
    // ERROR
    // ========================================================================

    if (history.isEmpty && paymentProvider.error != null) {
      return ListMessage.failed(
        message: paymentProvider.error!,
        onRetry: _loadPaymentHistory,
      );
    }

    // ========================================================================
    // EMPTY
    // ========================================================================

    if (history.isEmpty) {
      return ListMessage(
        icon: Icons.receipt_long_outlined,
        message: context.l10n.noTransactionsInPeriod,
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
            Text(context.l10n.transactions, style: AppTextStyles.heading2),

            AppGaps.h12,

            ...history.map((payment) {
              final isCurrentPending =
                  currentPayment != null &&
                  currentPayment.id == payment.id &&
                  payment.isPending;

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
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
          const Positioned.fill(child: ShimmerVeil()),
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

                Expanded(
                  child: Text(
                    context.l10n.currentPendingTransactionCaps,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.warning,
                      fontWeight: FontWeight.w800,
                    ),
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
}
