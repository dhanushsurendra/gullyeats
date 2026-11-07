import 'package:flutter/material.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/utils/responsive.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with TickerProviderStateMixin {
  double _opacity = 0;
  Offset _offset = const Offset(0, 0.2);

  late AnimationController _floatController;

  // Set when the payment-status check fails, so the screen offers a way out
  // instead of spinning forever.
  String? _error;

  @override
  void initState() {
    super.initState();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    Future.delayed(const Duration(milliseconds: 100), () {
      if (!mounted) return;

      setState(() {
        _opacity = 1;
        _offset = Offset.zero;
      });
    });

    _checkCartPaymentStatus();
  }

  Future<void> _checkCartPaymentStatus() async {
    if (!mounted) return;

    setState(() => _error = null);

    // Shown at least this long; the status check runs meanwhile.
    final minShown = Future.delayed(const Duration(milliseconds: 2500));

    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();
    final authProvider = context.read<AuthProvider>();

    final selectedCart = cartProvider.selectedCart;
    final token = authProvider.token;

    if (selectedCart == null || token == null) {
      await minShown;
      if (!mounted) return;

      Navigator.pushReplacementNamed(context, AppRoutes.home);

      return;
    }

    try {
      PaymentStatusModel? paymentStatus = await paymentProvider.refreshStatus(
        token,
        selectedCart.id,
      );

      // Errors show at once; only moving on waits for the minimum.
      if (paymentStatus != null) await minShown;
      if (!mounted) return;

      if (paymentStatus == null) {
        setState(() {
          _error =
              paymentProvider.error ?? context.l10n.unableToCheckPaymentStatus;
        });
        return;
      }

      // Cart is locked because payment is required
      if (paymentStatus.isLocked) {
        Navigator.pushReplacementNamed(
          context,
          AppRoutes.paymentLockScreen,
          arguments: paymentStatus,
        );

        return;
      }

      // Cart is not locked
      Navigator.pushReplacementNamed(context, AppRoutes.home);
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = context.l10n.unableToCheckPaymentStatus;
      });
    }
  }

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectedCart = context.watch<CartProvider>().selectedCart;

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 600),
          opacity: _opacity,
          child: AnimatedSlide(
            duration: const Duration(milliseconds: 600),
            offset: _offset,
            curve: Curves.easeOut,
            // Fills the screen, and scrolls when it can't fit (small phones,
            // large text, landscape, the error buttons).
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Column(
                      children: [
                        const SizedBox(height: 40),
                        _topDecor(),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _illustration(),
                              const SizedBox(height: 40),
                              _bottomText(selectedCart?.cartName),
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                        if (_error == null)
                          SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.white.withAlpha(204),
                            ),
                          )
                        else
                          _errorActions(),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _errorActions() {
    final buttonStyle = OutlinedButton.styleFrom(
      foregroundColor: AppColors.white,
      side: const BorderSide(color: AppColors.white),
      minimumSize: const Size(0, 48),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: AppColors.white),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                minimumSize: const Size(0, 48),
              ),
              onPressed: _checkCartPaymentStatus,
              child: Text(context.l10n.retry.toUpperCase()),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: buttonStyle,
                  onPressed: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const SwitchCartScreen(isDraggable: true),
                  ),
                  child: Text(context.l10n.switchCartCaps),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  style: buttonStyle,
                  onPressed: () => signOut(context),
                  child: Text(context.l10n.logout.toUpperCase()),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _topDecor() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: const [
          Icon(Icons.star, color: Colors.white54, size: 12),
          Icon(Icons.star, color: Colors.white54, size: 10),
        ],
      ),
    );
  }

  Widget _illustration() {
    final size = illustrationHeight(context, 220);
    return SizedBox(
      height: size,
      width: size,
      child: Image.asset('assets/images/cart.png', fit: BoxFit.contain),
    );
  }

  Widget _bottomText(String? cartName) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Text(
            context.l10n.welcome.toUpperCase(),
            style: AppTextStyles.caption.copyWith(
              color: AppColors.white.withAlpha(166),
              fontWeight: FontWeight.w600,
              letterSpacing: 2.4,
            ),
          ),

          const SizedBox(height: 10),

          Text(
            cartName ?? context.l10n.vendor,
            textAlign: TextAlign.center,
            style: AppTextStyles.display.copyWith(
              color: AppColors.white,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),

          const SizedBox(height: 12),

          Text(
            context.l10n.checkingPaymentStatus,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(
              color: AppColors.white.withAlpha(184),
              letterSpacing: 0.2,
              height: 1.4,
            ),
          ),

          const SizedBox(height: 4),

          Text(
            context.l10n.pleaseWait,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.white.withAlpha(128),
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}
