import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/activation/providers/activation_provider.dart';
import 'package:gullyeats/features/activation/services/qr_service.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';

class QrPosterScreen extends StatefulWidget {
  const QrPosterScreen({super.key});

  @override
  State<QrPosterScreen> createState() => _QrPosterScreenState();
}

class _QrPosterScreenState extends State<QrPosterScreen> {
  String _cartName = "";
  String _cartId = "";
  String qrImageUrl = "";
  bool _isLoading = false;
  bool _isBtnLoading = false;
  final GlobalKey _qrKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQrCode();

      final cartProvider = Provider.of<CartProvider>(context, listen: false);

      setState(() {
        _cartName = cartProvider.cartName!;
        _cartId = cartProvider.cartGeneratedId!;
      });
    });
  }

  Future<void> _loadQrCode() async {
    setState(() => _isLoading = true);
    try {
      final cartActivatedProvider = Provider.of<CartActivatedProvider>(
        context,
        listen: false,
      );

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);

      final url = await cartActivatedProvider.loadQR(
        auth.token,
        cartProvider.cartId!,
      );

      setState(() {
        qrImageUrl = url;
      });
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      _showError(message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _shareQr() async {
    setState(() => _isBtnLoading = true);
    try {
      await QrService.saveAndSharePdf(
        qrKey: _qrKey,
        cartName: _cartName,
        cartId: "69caa80e0b0f7b957daf05b4",
      );
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      _showError(message);
    } finally {
      if (mounted) setState(() => _isBtnLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: 'QR Code Poster',
      onBack: () => Navigator.pop(context),
      subtitle: "Print and paste this on your cart.",
      expandToFullHeight: true,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          RepaintBoundary(
            key: _qrKey,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final height = width * 1.3;

                return _QrPosterCard(
                  width: width,
                  height: height,
                  cartId: _cartId,
                  cartName: _cartName,
                  qrImageUrl: qrImageUrl,
                  isLoading: _isLoading,
                );
              },
            ),
          ),
          AppGaps.h24,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              "Tip: Print in A4 size and laminate for durability.",
              style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
              textAlign: TextAlign.center,
            ),
          ),
          AppGaps.h24,
          AppButton(
            label: "SHARE QR",
            isLoading: _isBtnLoading,
            onPressed: _shareQr,
          ),
        ],
      ),
    );
  }
}

class _QrPosterCard extends StatelessWidget {
  final double width;
  final double height;
  final String cartId;
  final String cartName;
  final String qrImageUrl;
  final bool isLoading;

  const _QrPosterCard({
    required this.width,
    required this.height,
    required this.cartId,
    required this.cartName,
    required this.qrImageUrl,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: EdgeInsets.symmetric(vertical: width * 0.05),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.primary, width: 2),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: "Gully",
                  style: AppTextStyles.heading2.copyWith(
                    fontSize: width * 0.07,
                    color: AppColors.primary,
                  ),
                ),
                TextSpan(
                  text: "Eats",
                  style: AppTextStyles.heading2.copyWith(
                    fontSize: width * 0.07,
                    color: Colors.black,
                  ),
                ),
              ],
            ),
          ),
          Text(
            "The Street Food Revolution",
            style: TextStyle(color: AppColors.grey500, fontSize: width * 0.03),
          ),
          AppGaps.h16,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8),
            color: AppColors.primary,
            child: Text(
              "SCAN & ORDER",
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: width * 0.06,
              ),
            ),
          ),
          const Spacer(),
          isLoading
              ? SizedBox(
                  height: width * 0.6,
                  child: const Center(child: CircularProgressIndicator()),
                )
              : Image.network(
                  qrImageUrl,
                  width: width * 0.6,
                  height: width * 0.6,
                  loadingBuilder: (context, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return SizedBox(
                      width: width * 0.6,
                      height: width * 0.6,
                      child: Center(
                        child: CircularProgressIndicator(
                          value: loadingProgress.expectedTotalBytes != null
                              ? loadingProgress.cumulativeBytesLoaded /
                                    loadingProgress.expectedTotalBytes!
                              : null,
                        ),
                      ),
                    );
                  },
                  errorBuilder: (context, error, stackTrace) => Icon(
                    Icons.broken_image,
                    size: width * 0.6,
                    color: AppColors.grey400,
                  ),
                ),

          const Spacer(),
          Text.rich(
            TextSpan(
              text: "Powered by ",
              style: TextStyle(
                fontSize: width * 0.03,
                color: AppColors.grey600,
              ),
              children: [
                TextSpan(
                  text: "GullyEats",
                  style: TextStyle(
                    color: AppColors.primary, 
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            cartName,
            style: AppTextStyles.heading2.copyWith(fontSize: width * 0.06),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            "Cart ID: $cartId",
            style: TextStyle(color: AppColors.grey400, fontSize: width * 0.03),
          ),
        ],
      ),
    );
  }
}
