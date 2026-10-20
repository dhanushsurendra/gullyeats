import 'package:flutter/material.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:provider/provider.dart';

class PaymentLockScreen extends StatefulWidget {
  final String cartName;
  final String cartAddress;
  final int ordersCompleted;
  final num platformFee;
  final num amountDue;
  final num totalPaid;
  final bool isLoading;

  const PaymentLockScreen({
    super.key,
    this.cartName = '',
    this.cartAddress = '',
    this.ordersCompleted = 0,
    this.platformFee = 0,
    this.amountDue = 0,
    this.totalPaid = 0,
    this.isLoading = false,
  });

  @override
  State<PaymentLockScreen> createState() => _PaymentLockScreenState();
}

class _PaymentLockScreenState extends State<PaymentLockScreen> {
  late final Razorpay _razorpay;

  bool _isOpeningCheckout = false;
  bool _isVerifying = false;

  @override
  void initState() {
    super.initState();

    _razorpay = Razorpay();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _startPaymentFlow() async {
    if (_isOpeningCheckout || _isVerifying) {
      return;
    }

    final auth = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();

    final cartId = cartProvider.selectedCart?.id;

    if (cartId == null) {
      AppSnackBar.show(
        context,
        message: 'Unable to find the selected cart.',
        isError: true,
      );
      return;
    }

    setState(() {
      _isOpeningCheckout = true;
    });

    try {
      final result = await paymentProvider.createPayment(auth.token, cartId);

      if (!mounted) return;

      if (result == null) {
        AppSnackBar.show(
          context,
          message:
              paymentProvider.error ??
              'Unable to start payment. Please try again.',
          isError: true,
        );
        return;
      }

      final checkout = result.checkout;

      final options = {
        'key': checkout.keyId,
        'order_id': checkout.razorpayOrderId,
        'amount': (checkout.amount * 100).round(),
        'currency': checkout.currency,
        'name': checkout.name,
        'description': checkout.description,

        // Razorpay can show UPI, cards, net banking, wallets, etc.
        'theme': {'color': '#ffffff'},
      };

      _razorpay.open(options);
    } catch (e) {
      if (!mounted) return;

      AppSnackBar.show(
        context,
        message: 'Unable to open payment gateway.',
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isOpeningCheckout = false;
        });
      }
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    if (!mounted) return;

    final paymentProvider = context.read<PaymentProvider>();

    final auth = context.read<AuthProvider>();

    final payment = paymentProvider.currentPayment;

    if (payment == null) {
      AppSnackBar.show(
        context,
        message: 'Payment received, but the payment record could not be found.',
        isError: true,
      );
      return;
    }

    if (response.paymentId == null ||
        response.orderId == null ||
        response.signature == null) {
      AppSnackBar.show(
        context,
        message:
            'Payment response was incomplete. Please check payment status.',
        isError: true,
      );
      return;
    }

    setState(() {
      _isVerifying = true;
    });

    try {
      final verified = await paymentProvider.verifyPayment(
        token: auth.token,
        paymentId: payment.id,
        razorpayPaymentId: response.paymentId!,
        razorpayOrderId: response.orderId!,
        razorpaySignature: response.signature!,
      );

      if (!mounted) return;

      if (verified) {
        AppSnackBar.show(
          context,
          message: 'Payment verified successfully. Your cart is unlocked.',
        );

        Navigator.pushReplacementNamed(context, AppRoutes.home);
      } else {
        AppSnackBar.show(
          context,
          message:
              paymentProvider.error ??
              'Payment was received but verification is still pending.',
          isError: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isVerifying = false;
        });
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;

    AppSnackBar.show(
      context,
      message: 'Payment failed. You can retry using the same payment.',
      isError: true,
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;

    AppSnackBar.show(
      context,
      message: '${response.walletName ?? 'External wallet'} selected.',
    );
  }

  void _openSwitchCartSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SwitchCartScreen(isDraggable: true),
    );
  }

  bool get _isPartiallyPaid => widget.totalPaid > 0;

  @override
  Widget build(BuildContext context) {
    final paymentProvider = context.watch<PaymentProvider>();

    final busy =
        widget.isLoading ||
        _isOpeningCheckout ||
        _isVerifying ||
        paymentProvider.isCreatingPayment ||
        paymentProvider.isVerifyingPayment;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Stack(
        children: [
          Positioned(
            top: -70,
            right: -60,
            child: _blob(220, AppColors.primary.withValues(alpha: 0.07)),
          ),
          Positioned(
            top: 60,
            left: -80,
            child: _blob(180, AppColors.warning.withValues(alpha: 0.09)),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _brand(),

                  AppGaps.h32,

                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Sales Overview',
                              style: AppTextStyles.heading2,
                            ),
                            AppGaps.h4,
                            Text(
                              'Track earnings & platform fees',
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.grey500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _outletChip(),
                    ],
                  ),

                  AppGaps.h24,

                  _summaryCard(),

                  AppGaps.h16,

                  _warningBanner(),

                  AppGaps.h16,

                  AppButton(
                    label: busy
                        ? 'OPENING PAYMENT GATEWAY...'
                        : widget.amountDue <= 0
                        ? 'PAYMENT PENDING'
                        : 'PAY ₹${widget.amountDue.toStringAsFixed(0)} & UNLOCK NOW',
                    isLoading: busy,
                    onPressed: widget.amountDue <= 0 || busy
                        ? null
                        : _startPaymentFlow,
                  ),

                  AppGaps.h16,

                  _trustRow(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _blob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }

  Widget _brand() {
    return Center(
      child: RichText(
        text: TextSpan(
          style: AppTextStyles.heading2.copyWith(fontWeight: FontWeight.w800),
          children: const [
            TextSpan(
              text: 'Gully',
              style: TextStyle(color: AppColors.primary),
            ),
            TextSpan(
              text: 'Eats',
              style: TextStyle(color: AppColors.black),
            ),
          ],
        ),
      ),
    );
  }

  Widget _outletChip() {
    return GestureDetector(
      onTap: _openSwitchCartSheet,
      child: Container(
        margin: const EdgeInsets.only(left: 12, top: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.grey300),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                widget.cartName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            AppGaps.w4,
            const Icon(
              Icons.keyboard_arrow_down,
              size: 16,
              color: AppColors.grey500,
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.grey200),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ),
              AppGaps.w8,
              Expanded(
                child: Text(
                  widget.cartName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.heading3,
                ),
              ),
            ],
          ),

          AppGaps.h4,

          Padding(
            padding: const EdgeInsets.only(left: 40),
            child: Text(
              widget.cartAddress,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
            ),
          ),

          AppGaps.h16,

          Text(
            'TODAY SUMMARY',
            style: AppTextStyles.caption.copyWith(
              color: AppColors.grey500,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),

          AppGaps.h12,

          _statRow('Orders Completed', '${widget.ordersCompleted}'),

          AppGaps.h12,

          Container(height: 1, color: AppColors.grey100),

          AppGaps.h12,

          _statRow(
            'Platform Fee',
            '₹${widget.platformFee.toStringAsFixed(0)}',
            valueColor: AppColors.primary,
          ),

          AppGaps.h12,

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Payment Status',
                style: AppTextStyles.body.copyWith(color: AppColors.grey600),
              ),
              _statusPill(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: AppTextStyles.body.copyWith(color: AppColors.grey600),
        ),
        Text(
          value,
          style: AppTextStyles.heading3.copyWith(
            color: valueColor ?? AppColors.black,
          ),
        ),
      ],
    );
  }

  Widget _statusPill() {
    final label = _isPartiallyPaid ? 'PARTIALLY PAID' : 'DUE';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.error,
              fontWeight: FontWeight.w800,
              fontSize: 11,
            ),
          ),
          const SizedBox(width: 2),
          const Icon(Icons.warning_rounded, size: 12, color: AppColors.error),
        ],
      ),
    );
  }

  Widget _warningBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_rounded, color: AppColors.warning, size: 18),
          AppGaps.w8,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Platform fee pending',
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                AppGaps.h4,
                Text(
                  'Your store is locked. Pay securely using Razorpay to unlock it.',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _trustRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.lock_rounded, size: 12, color: AppColors.grey400),
        AppGaps.w4,
        Text(
          'Secure payments · Powered by Razorpay',
          style: AppTextStyles.caption.copyWith(
            color: AppColors.grey400,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
