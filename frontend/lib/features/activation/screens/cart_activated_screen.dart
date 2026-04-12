import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';

class CartActivatedScreen extends StatefulWidget {
  const CartActivatedScreen({super.key});

  @override
  State<CartActivatedScreen> createState() => _CartActivatedScreenState();
}

class _CartActivatedScreenState extends State<CartActivatedScreen> {
  bool _isCopying = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      await cartProvider.loadCartDetails();
      if (!mounted) return;
    });
  }

  Future<void> _copyGeneratedCartId() async {
    final cartProvider = Provider.of<CartProvider>(context, listen: false);
    final id = cartProvider.cartGeneratedId ?? "";
    if (id.isEmpty) return;
    setState(() => _isCopying = true);
    await Clipboard.setData(ClipboardData(text: id));

    if (!mounted) return;

    setState(() => _isCopying = false);
  }

  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);

    return BaseScreen(
      title: "Cart Activated",
      onBack: () => Navigator.pop(context),
      subtitle: "Your cart is now live on GullyEats",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Image.asset(
            "assets/images/activated.png",
            height: 200,
            fit: BoxFit.contain,
          ),
          AppGaps.h24,
          _buildCongratulationsSection(),
          AppGaps.h24,
          GeneratedCartIdCard(
            generatedCartId: cartProvider.cartGeneratedId ?? "",
            onCopy: _copyGeneratedCartId,
            isCopying: _isCopying,
          ),
          AppGaps.h32,
          AppButton(
            label: "CONTINUE",
            onPressed: () => Navigator.pushNamed(context, AppRoutes.qrPoster),
          ),
          AppGaps.h12,
          Text(
            "Welcome to the GullyEats vendor community.",
            style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
            textAlign: TextAlign.center,
          ),

          AppGaps.h24,
        ],
      ),
    );
  }

  Widget _buildCongratulationsSection() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.successAlt.withValues(alpha: 0.05),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, color: AppColors.successAlt, size: 32),
        ),
        AppGaps.h12,
        Text("Congratulations!", style: AppTextStyles.heading2),
        AppGaps.h4,
        Text(
          "Your cart is now active and customers\ncan start ordering.",
          style: AppTextStyles.body.copyWith(color: AppColors.grey600),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class GeneratedCartIdCard extends StatelessWidget {
  final String generatedCartId;
  final VoidCallback onCopy;
  final bool isCopying;

  const GeneratedCartIdCard({
    super.key,
    required this.generatedCartId,
    required this.onCopy,
    required this.isCopying,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "VENDOR CART ID",
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    fontSize: 10,
                    color: AppColors.grey600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  generatedCartId,
                  style: AppTextStyles.heading3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  "Use this ID for customer support.",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey400,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),

          AppGaps.w12,
          OutlinedButton.icon(
            onPressed: isCopying ? null : onCopy,
            icon: isCopying
                ? const SizedBox(
                    height: 14,
                    width: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(
                    Icons.copy_outlined,
                    color: AppColors.primary,
                    size: 14,
                  ),
            label: Text(
              isCopying ? "COPYING" : "COPY",
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 10,
              ),
            ),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 32),
              side: BorderSide(color: AppColors.primary.withValues(alpha: 0.1)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
            ),
          ),
        ],
      ),
    );
  }
}
