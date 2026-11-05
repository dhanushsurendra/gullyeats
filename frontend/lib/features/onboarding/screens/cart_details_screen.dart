import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_input.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/core/widgets/fill_or_scroll.dart';
import 'package:gullyeats/core/utils/responsive.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/onboarding_progress.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';

class CartDetailsScreen extends StatefulWidget {
  const CartDetailsScreen({super.key});

  @override
  State<CartDetailsScreen> createState() => _CartDetailsScreenState();
}

class _CartDetailsScreenState extends State<CartDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();

  final List<String> _cities = ["Bangalore"];
  String? _selectedCity;
  bool _isLoading = false;

  /// Set once this cart exists on the server: opened from Your Carts, or
  /// created here earlier. Continue then updates it instead of creating
  /// another cart (e.g. after going back from the photo step).
  String? _cartId;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;

    final cart = ModalRoute.of(context)?.settings.arguments;
    if (cart is CartModel) {
      _cartId = cart.id;
      _nameController.text = cart.cartName;
      if (cart.cartCity.isNotEmpty) {
        if (!_cities.contains(cart.cartCity)) _cities.add(cart.cartCity);
        _selectedCity = cart.cartCity;
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleContinue() async {
    if (!_formKey.currentState!.validate() || _selectedCity == null) return;

    setState(() => _isLoading = true);

    try {
      final cartDetails = {
        "cartName": _nameController.text.trim(),
        "cartCity": _selectedCity!,
      };

      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final isNew = _cartId == null;
      final result = isNew
          ? await cartProvider.createCart(auth.token!, cartDetails)
          : await cartProvider.updateCart(auth.token!, _cartId!, cartDetails);
      _cartId = result?.id;

      if (result != null && mounted) {
        AppSnackBar.show(
          context,
          message: isNew ? "Cart added successfully!" : "Cart updated",
          isError: false,
        );

        // A new cart has done nothing yet; a resumed one skips finished steps.
        final next = nextOnboardingRoute(
          result,
          hasMenu: !isNew && await cartProvider.hasMenu(result.id),
        );
        await Future.delayed(const Duration(milliseconds: 400));

        if (mounted) {
          Navigator.pushNamed(context, next);
        }
      } else {
        throw Exception("Failed to create cart");
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) AppSnackBar.show(context, message: message, isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: "Cart Details",
      subtitle: "Tell us about your cart to get started.",
      expandToFullHeight: true,
      onBack: () => Navigator.pop(context),
      child: FillOrScroll(
        child: Form(
          key: _formKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Image.asset(
                  "assets/images/cart.png",
                  height: illustrationHeight(context, 180),
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) => const Icon(
                    Icons.storefront,
                    size: 100,
                    color: AppColors.grey200,
                  ),
                ),
              ),
              AppGaps.h32,
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.grey200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppInput(
                      controller: _nameController,
                      label: "Cart Name",
                      hint: "e.g. Ramesh's Dosa Point",
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
                          ? "Please enter a cart name"
                          : null,
                      onChanged: (_) => setState(() {}),
                    ),
                    AppGaps.h24,
                    Text(
                      "City",
                      style: AppTextStyles.body.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    AppGaps.h8,
                    _buildCityDropdown(),
                  ],
                ),
              ),

              const Spacer(),
              AppGaps.h24,
              Center(
                child: Text(
                  "You can update these details later from settings.",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey400,
                  ),
                ),
              ),
              AppGaps.h16,
              AppButton(
                label: "CONTINUE",
                isLoading: _isLoading,
                onPressed:
                    (_selectedCity != null && _nameController.text.isNotEmpty)
                    ? _handleContinue
                    : null,
              ),
              SizedBox(
                height: MediaQuery.of(context).viewInsets.bottom > 0 ? 10 : 0,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCityDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _selectedCity != null
              ? AppColors.primary.withValues(alpha: 0.3)
              : Colors.transparent,
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedCity,
          hint: Text(
            "Select City",
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.grey400),
          dropdownColor: Colors.white,
          borderRadius: BorderRadius.circular(12),
          items: _cities.map((String city) {
            return DropdownMenuItem(
              value: city,
              child: Text(
                city,
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w400),
              ),
            );
          }).toList(),
          onChanged: (value) {
            setState(() => _selectedCity = value);
          },
        ),
      ),
    );
  }
}
