import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:ordering/features/profile/services/qr_service.dart';
import 'package:provider/provider.dart';

class QrPosterScreen extends StatefulWidget {
  const QrPosterScreen({super.key});

  @override
  State<QrPosterScreen> createState() => _QrPosterScreenState();
}

class _QrPosterScreenState extends State<QrPosterScreen> {
  bool _isBtnLoading = false;
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

    try {
      await provider.loadQrDetails(null, "69db91dd3766ae8b43dd50c7");
    } catch (e, stack) {
      debugPrint('ERROR: $e');
      debugPrintStack(stackTrace: stack);
      final message = AppExceptionHandler.getMessage(e);
      if (!mounted) return;
      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
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
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            const AppHeader(title: "QR Code Poster", showBack: true),

            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Padding(
                  padding: AppPadding.screen,
                  child: Column(
                    children: [
                      RepaintBoundary(
                        key: _qrKey,
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final width = constraints.maxWidth;
                            final height = width * 1.3;

                            final profileProvider = Provider.of<ProfileProvider>(
                              context,
                              listen: true,
                            );

                            return _QrPosterCard(
                              width: width,
                              height: height,
                              cartId: profileProvider.cartId ?? "",
                              cartName: profileProvider.cartName ?? "",
                              qrImageUrl: profileProvider.qrImageUrl ?? "",
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
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.grey600,
                          ),
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
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QrPosterCard extends StatefulWidget {
  final double width;
  final double height;
  final String cartId;
  final String cartName;
  final String qrImageUrl;

  const _QrPosterCard({
    required this.width,
    required this.height,
    required this.cartId,
    required this.cartName,
    required this.qrImageUrl,
  });

  @override
  State<_QrPosterCard> createState() => _QrPosterCardState();
}

class _QrPosterCardState extends State<_QrPosterCard> {
  bool _imageLoaded = false;

  @override
  Widget build(BuildContext context) {
    final width = widget.width;

    return Container(
      width: widget.width,
      height: widget.height,
      padding: EdgeInsets.symmetric(vertical: width * 0.05),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.primary, width: 2),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withAlpha(13),
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
                    color: AppColors.black,
                  ),
                ),
              ],
            ),
          ),
          Text("The Street Food Revolution", style: AppTextStyles.caption),
          AppGaps.h16,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8),
            color: AppColors.primary,
            child: Text(
              "SCAN & ORDER",
              textAlign: TextAlign.center,
              style: AppTextStyles.heading3.copyWith(color: AppColors.white),
            ),
          ),
          const Spacer(),
          SizedBox(
            width: width * 0.6,
            height: width * 0.6,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: widget.qrImageUrl.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    )
                  : Stack(
                      alignment: Alignment.center,
                      children: [
                        Image.network(
                          widget.qrImageUrl,
                          fit: BoxFit.contain,

                          /// detect load
                          frameBuilder: (context, child, frame, _) {
                            if (frame != null && !_imageLoaded) {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (mounted) {
                                  setState(() {
                                    _imageLoaded = true;
                                  });
                                }
                              });
                            }
                            return child;
                          },

                          errorBuilder: (_, _, _) => Icon(
                            Icons.broken_image,
                            size: width * 0.4,
                            color: AppColors.grey400,
                          ),
                        ),

                        if (!_imageLoaded)
                          const CircularProgressIndicator(
                            color: AppColors.primary,
                          ),
                      ],
                    ),
            ),
          ),

          const Spacer(),

          Text.rich(
            TextSpan(
              text: "Powered by ",
              style: AppTextStyles.caption,
              children: [
                TextSpan(
                  text: "GullyEats",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          Text(
            widget.cartName,
            style: AppTextStyles.heading2.copyWith(fontSize: width * 0.06),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),

          Text("Cart ID: ${widget.cartId}", style: AppTextStyles.caption),
        ],
      ),
    );
  }
}
