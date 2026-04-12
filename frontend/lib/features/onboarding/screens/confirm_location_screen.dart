import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/widgets/location_ripple_animation.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';

class ConfirmLocationScreen extends StatefulWidget {
  const ConfirmLocationScreen({super.key});

  @override
  State<ConfirmLocationScreen> createState() => _ConfirmLocationScreenState();
}

class _ConfirmLocationScreenState extends State<ConfirmLocationScreen> {
  bool _isLoading = false;
  Placemark? placemark;
  int? accuracy;
  double? lat;
  double? lng;

  bool _isInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (!_isInitialized) {
      final args =
          ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>;

      placemark = args["placemark"] as Placemark?;
      accuracy = args["accuracy"] != null
          ? int.parse(args["accuracy"].toString())
          : 0;
      lat = args["lat"] as double?;
      lng = args["lng"] as double?;

      _isInitialized = true;
    }
  }

  Future<void> _confirmLocation() async {
    setState(() => _isLoading = true);

    try {
      final cartActivatedProvider = Provider.of<CartProvider>(
        context,
        listen: false,
      );

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final cartId = cartProvider.cartId;

      final cart = await cartActivatedProvider.updateCartLocation(
        auth.token,
        placemark!,
        cartId!,
        lat,
        lng,
      );

      if (cart != null && mounted) {
        AppSnackBar.show(
          context,
          message: "Location updated successfully!",
          isError: false,
        );

        await Future.delayed(const Duration(milliseconds: 400));

        if (mounted) {
          Navigator.pushNamed(context, "/add-menu");
        }
      } else {
        throw Exception("Failed to update location");
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) AppSnackBar.show(context, message: message, isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String getAccuracyLevel(int accuracy) {
    if (accuracy <= 20) return "High";
    if (accuracy <= 50) return "Medium";
    return "Low";
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: "Confirm Location",
      subtitle: "We detected your cart location",
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: _buildFooter(),

      child: ListView(
        children: [
          Center(
            child: SizedBox(height: 140, child: LocationRippleAnimation()),
          ),
          AppGaps.h24,
          _buildLocationCard(),
          AppGaps.h16,
          _buildInfoBox(),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.grey300),
      ),
      child: Column(
        children: [
          const Text(
            "Location Detected",
            style: TextStyle(
              color: AppColors.successAlt,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          AppGaps.h12,
          const Divider(color: AppColors.grey300),
          AppGaps.h12,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on, color: AppColors.primary, size: 28),
              AppGaps.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${placemark?.name}, ${placemark?.subLocality}",
                      style: AppTextStyles.heading3,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    Text(
                      "${placemark?.locality}, ${placemark?.administrativeArea} - ${placemark?.postalCode}",
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.grey400,
                      ),
                    ),
                    AppGaps.h8,
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.successAlt.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        "Accuracy: ${getAccuracyLevel(accuracy ?? 0)} ($accuracy m)",
                        style: const TextStyle(
                          color: AppColors.successAlt,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBox() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        "This location is used to show your cart to nearby customers.",
        style: TextStyle(color: Colors.orange.shade900, fontSize: 13),
      ),
    );
  }

  Widget _buildFooter() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppButton(
              label: "CONFIRM & CONTINUE",
              isLoading: _isLoading,
              onPressed: _confirmLocation,
            ),
          ],
        ),
      ),
    );
  }
}
