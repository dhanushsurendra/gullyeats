import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/info_box.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:ordering/features/profile/services/qr_service.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

class QrPosterScreen extends StatefulWidget {
  const QrPosterScreen({super.key});

  @override
  State<QrPosterScreen> createState() => _QrPosterScreenState();
}

class _QrPosterScreenState extends State<QrPosterScreen> {
  bool _isBtnLoading = false;
  bool _isLoading = true;
  final GlobalKey _qrKey = GlobalKey();

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQrDetails();
    });
  }

  Future<void> _loadQrDetails() async {
    final provider = context.read<ProfileProvider>();
    final token = context.read<AuthProvider>().token;
    final cartId = context.read<CartProvider>().selectedCart?.id;

    if (cartId == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      await provider.loadQrDetails(token, cartId);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (!mounted) return;
      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _shareQr() async {
    setState(() => _isBtnLoading = true);
    final profileProvider = Provider.of<ProfileProvider>(
      context,
      listen: false,
    );

    try {
      await QrService.saveAndSharePdf(
        qrKey: _qrKey,
        cartName: profileProvider.cartName ?? "Cart",
        cartId: profileProvider.cartId ?? "",
      );
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);
      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isBtnLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final profile = context.watch<ProfileProvider>();

    return BaseScreen(
      title: l10n.qrCodePoster,
      subtitle: l10n.qrPosterSubtitle,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: AppFooter(
        children: [
          AppButton(
            label: l10n.shareQrCaps,
            isLoading: _isBtnLoading,
            onPressed: _shareQr,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          RepaintBoundary(
            key: _qrKey,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                // The poster is a printable graphic sized from its width, so
                // it ignores the phone's text size; otherwise the shared PDF
                // would change (and overflow) with each vendor's settings.
                return MediaQuery.withNoTextScaling(
                  child: _QrPosterCard(
                    width: width,
                    height: width * 1.3,
                    cartId: profile.cartId ?? "",
                    cartName: profile.cartName ?? "",
                    qrImageUrl: profile.qrImageUrl ?? "",
                    isLoading: _isLoading,
                  ),
                );
              },
            ),
          ),
          AppGaps.h24,
          InfoBox(icon: Icons.lightbulb_outline, lines: [l10n.qrPrintTip]),
        ],
      ),
    );
  }
}

// Same poster as the onboarding app's, so both share identical PDFs. It stays
// in English: customers read it, whatever language the vendor uses.
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
          if (isLoading)
            SizedBox(
              height: width * 0.6,
              child: const Center(child: CircularProgressIndicator()),
            )
          else if (qrImageUrl.isEmpty)
            Icon(Icons.broken_image, size: width * 0.6, color: AppColors.grey400)
          else
            Image.network(
              qrImageUrl,
              width: width * 0.6,
              height: width * 0.6,
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : SizedBox(
                      width: width * 0.6,
                      height: width * 0.6,
                      child: const Center(child: CircularProgressIndicator()),
                    ),
              errorBuilder: (_, _, _) => Icon(
                Icons.broken_image,
                size: width * 0.6,
                color: AppColors.grey400,
              ),
            ),
          const Spacer(),
          Text.rich(
            TextSpan(
              text: "Powered by ",
              style: TextStyle(fontSize: width * 0.03, color: AppColors.grey600),
              children: const [
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
          // Padded so a long name doesn't run into the border.
          Padding(
            padding: EdgeInsets.symmetric(horizontal: width * 0.05),
            child: Text(
              cartName,
              style: AppTextStyles.heading2.copyWith(fontSize: width * 0.06),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
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
