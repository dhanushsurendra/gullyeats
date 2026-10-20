import 'package:flutter/material.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:provider/provider.dart';

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

    final cartProvider = context.read<CartProvider>();
    final paymentProvider = context.read<PaymentProvider>();
    final authProvider = context.read<AuthProvider>();

    final selectedCart = cartProvider.selectedCart;
    final token = authProvider.token;

    if (selectedCart == null || token == null) {
      if (!mounted) return;

      Navigator.pushReplacementNamed(context, AppRoutes.home);

      return;
    }

    try {
      PaymentStatusModel? paymentStatus = await paymentProvider.refreshStatus(
        token,
        selectedCart.id,
      );

      if (!mounted) return;

      // Cart is locked because payment is required
      if (paymentStatus!.isLocked) {
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

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to check payment status. Please try again.'),
        ),
      );
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

                SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.white.withAlpha(204),
                  ),
                ),

                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
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
    return Container(
      height: 220,
      width: 220,
      alignment: Alignment.center,
      child: Image.asset('assets/images/cart.png', fit: BoxFit.contain),
    );
  }

  Widget _bottomText(String? cartName) {
    return Column(
      children: [
        Text(
          'WELCOME',
          style: TextStyle(
            color: AppColors.white.withAlpha(166),
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 2.4,
          ),
        ),

        const SizedBox(height: 10),

        Text(
          cartName ?? 'Vendor',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
            height: 1.1,
          ),
        ),

        const SizedBox(height: 12),

        Text(
          'Checking your payment status',
          style: TextStyle(
            color: AppColors.white.withAlpha(184),
            fontSize: 14,
            fontWeight: FontWeight.w400,
            letterSpacing: 0.2,
            height: 1.4,
          ),
        ),

        const SizedBox(height: 4),

        Text(
          'Please wait a moment...',
          style: TextStyle(
            color: AppColors.white.withAlpha(128),
            fontSize: 12,
            fontWeight: FontWeight.w400,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }
}
