import 'package:ordering/core/widgets/app_logo.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/utils/order_alerts.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';
import 'package:ordering/core/widgets/info_box.dart';
import 'package:ordering/core/utils/session.dart';

class PaymentLockScreen extends StatefulWidget {
  final String cartName;
  final String cartAddress;
  final int ordersCompleted;
  final num platformFee;
  final num amountDue;
  final num totalPaid;
  final bool isLoading;

  /// False when paying early from the home banner: the cart still works,
  /// so the screen can be closed.
  final bool isLocked;

  const PaymentLockScreen({
    super.key,
    this.isLocked = true,
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
        message: context.l10n.cartNotFound,
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
              context.l10n.unableToStartPayment,
          isError: true,
        );
        return;
      }

      final checkout = result.checkout;

      // Already paid (e.g. verified by the webhook): nothing to open.
      if (checkout == null ||
          result.payment.isVerified ||
          !result.isLocked) {
        AppSnackBar.show(context, message: context.l10n.paymentReceivedUnlocked);
        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.home, (_) => false);
        return;
      }

      // The vendor's own number, so Razorpay doesn't ask for it every time.
      final phone = (auth.user?['phoneNumber'] ?? '').toString();
      final options = {
        if (phone.isNotEmpty) 'prefill': {'contact': phone},
        'key': checkout.keyId,
        'order_id': checkout.razorpayOrderId,
        'amount': (checkout.amount * 100).round(),
        'currency': checkout.currency,
        'name': checkout.name,
        'description': checkout.description,

        // Razorpay can show UPI, cards, net banking, wallets, etc.
        'theme': {'color': '#FE5200'},
      };

      _razorpay.open(options);
    } catch (e) {
      if (!mounted) return;

      AppSnackBar.show(
        context,
        message: context.l10n.unableToOpenGateway,
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

  /// A tick that pops in, then closes itself after a moment.
  Future<void> _showPaidDialog() {
    OrderAlerts.paid();
    Route<dynamic>? route;
    final dialog = showDialog<void>(
      context: context,
      // Closed only by the timer below, so that pop never hits this screen.
      barrierDismissible: false,
      builder: (context) => Dialog(
        // Records the dialog's own route for the timer below.
        key: ValueKey(route ??= ModalRoute.of(context)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 600),
                curve: Curves.elasticOut,
                builder: (context, scale, child) =>
                    Transform.scale(scale: scale, child: child),
                child: const Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                  size: 72,
                ),
              ),
              AppGaps.h16,
              Text(
                context.l10n.feePaidTitle,
                textAlign: TextAlign.center,
                style: AppTextStyles.heading2,
              ),
              AppGaps.h8,
              Text(
                context.l10n.paymentVerifiedUnlocked,
                textAlign: TextAlign.center,
                style: AppTextStyles.body.copyWith(color: AppColors.grey400),
              ),
            ],
          ),
        ),
      ),
    );
    // Remove this dialog only: coming back from Razorpay can rebuild the stack
    // at the same moment, and a plain pop would hit a route being torn down.
    Future.delayed(const Duration(milliseconds: 1800), () {
      final r = route;
      if (r != null && r.isActive) r.navigator?.removeRoute(r);
    });
    return dialog;
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    if (!mounted) return;

    final paymentProvider = context.read<PaymentProvider>();

    final auth = context.read<AuthProvider>();

    final payment = paymentProvider.currentPayment;

    if (payment == null) {
      AppSnackBar.show(
        context,
        message: context.l10n.paymentRecordNotFound,
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
            context.l10n.paymentResponseIncomplete,
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

      if (verified && paymentProvider.lastPaymentRefunded) {
        AppSnackBar.show(context, message: context.l10n.duplicatePaymentRefunded);
        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.home, (_) => false);
      } else if (verified) {
        await _showPaidDialog();
        if (!mounted) return;

        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.home, (_) => false);
      } else {
        AppSnackBar.show(
          context,
          message:
              paymentProvider.error ??
              context.l10n.paymentVerificationPending,
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
      message: context.l10n.paymentFailedRetry,
      isError: true,
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;

    AppSnackBar.show(
      context,
      message: context.l10n.walletSelected(
        response.walletName ?? context.l10n.externalWallet,
      ),
    );
  }

  bool get _isPartiallyPaid => widget.totalPaid > 0;

  @override
  Widget build(BuildContext context) {
    final paymentProvider = context.watch<PaymentProvider>();
    final l10n = context.l10n;

    final busy =
        widget.isLoading ||
        _isOpeningCheckout ||
        _isVerifying ||
        paymentProvider.isCreatingPayment ||
        paymentProvider.isVerifyingPayment;

    final isStaff = context.watch<AuthProvider>().isStaff;

    return BaseScreen(
      showBackButton: !widget.isLocked,
      onBack: widget.isLocked ? null : () => Navigator.pop(context),
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.isLocked) ...[
            const AppLogo(),
            AppGaps.h40,
          ],
          Text(l10n.platformFeePending, style: AppTextStyles.heading1),
          AppGaps.h4,
          Text(
            widget.isLocked ? l10n.storeLockedPayRazorpay : l10n.payEarlySubtitle,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
          AppGaps.h12,
          const CartSelector(),
        ],
      ),
      // Only the owner can pay; staff are told who to ask, and can log out.
      bottomNavigationBar: isStaff
          ? AppFooter(
              children: [
                InfoBox(lines: [l10n.askOwnerToPay], icon: Icons.person_outline),
                AppButton(
                  label: l10n.logOutCaps,
                  backgroundColor: AppColors.surface,
                  borderColor: AppColors.primary,
                  textColor: AppColors.primary,
                  onPressed: () => signOut(context),
                ),
              ],
            )
          : AppFooter(
              note: l10n.securePaymentsRazorpay,
              children: [
                AppButton(
                  label: busy
                      ? l10n.openingGatewayCaps
                      : widget.amountDue <= 0
                      ? l10n.paymentPendingCaps
                      : l10n.payAndUnlockNow(formatPrice(widget.amountDue)),
                  isLoading: busy,
                  onPressed: widget.amountDue <= 0 || busy ? null : _startPaymentFlow,
                ),
              ],
            ),
      child: _summaryCard(),
    );
  }

  Widget _summaryCard() {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ),
              AppGaps.w8,
              Expanded(
                child: Text(widget.cartName, style: AppTextStyles.heading3),
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
            context.l10n.todaySummaryCaps,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.grey500,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),

          AppGaps.h12,

          _statRow(context.l10n.ordersCompleted, '${widget.ordersCompleted}'),

          AppGaps.h12,

          Container(height: 1, color: AppColors.grey100),

          AppGaps.h12,

          _statRow(
            context.l10n.platformFee,
            '₹${formatPrice(widget.platformFee)}',
            valueColor: AppColors.primary,
          ),

          AppGaps.h12,

          Row(
            children: [
              Expanded(
                child: Text(
                  context.l10n.paymentStatus,
                  style: AppTextStyles.body.copyWith(color: AppColors.grey600),
                ),
              ),
              AppGaps.w8,
              _statusPill(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value, {Color? valueColor}) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.body.copyWith(color: AppColors.grey600),
          ),
        ),
        AppGaps.w8,
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
    final label = _isPartiallyPaid ? context.l10n.partiallyPaidCaps : context.l10n.due.toUpperCase();

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
            ),
          ),
          const SizedBox(width: 2),
          const Icon(Icons.warning_rounded, size: 12, color: AppColors.error),
        ],
      ),
    );
  }
}
