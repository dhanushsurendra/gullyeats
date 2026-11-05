import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_padding.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_search_bar.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/widgets/cart_card.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class CartsScreen extends StatefulWidget {
  const CartsScreen({super.key});

  @override
  State<CartsScreen> createState() => _CartsScreenState();
}

class _CartsScreenState extends State<CartsScreen> {
  String? selectedCartId;
  String searchQuery = "";

  List<CartModel> _allCarts = [];
  bool _isLoading = false;
  bool _loadFailed = false;

  List<CartModel> get _filteredCarts {
    if (searchQuery.isEmpty) return _allCarts;
    final query = searchQuery.toLowerCase();
    final cartProvider = Provider.of<CartProvider>(context, listen: false);
    return cartProvider.searchCarts(query);
  }

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      authProvider.loadToken();
      _loadCarts();
    });
  }

  Future<void> _loadCarts() async {
    setState(() {
      _isLoading = true;
      _loadFailed = false;
    });

    try {
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);

      final args =
          ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

      final userId = args?['userId'];

      List<CartModel> carts = await cartProvider.loadCarts(auth.token, userId);

      if (mounted) setState(() => _allCarts = carts);
    } catch (e) {
      final errorMessage = AppExceptionHandler.getMessage(e);

      if (mounted) {
        setState(() => _loadFailed = true);
        AppSnackBar.show(context, message: errorMessage, isError: true);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleSendCredentials(BuildContext context) async {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    final pin = args?['pin'];
    final userId = args?['userId'];
    final phoneNumber = args?['phoneNumber'];

    if (pin == null || userId == null || phoneNumber == null) {
      AppSnackBar.show(
        context,
        message: "Credential data missing",
        isError: true,
      );
      return;
    }

    final message = "Your login credentials:\nUser ID: $userId\nPIN: $pin";

    final Uri smsUri = Uri(
      scheme: 'sms',
      path: phoneNumber,
      queryParameters: {'body': message},
    );

    try {
      final canLaunch = await canLaunchUrl(smsUri);

      if (!context.mounted) return;

      if (canLaunch) {
        await launchUrl(smsUri);
      } else {
        throw 'could_not_launch_sms';
      }
    } catch (e) {
      if (!context.mounted) return;

      final errorMessage = (e == 'could_not_launch_sms')
          ? "Staff added, but couldn't open SMS app."
          : AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: errorMessage, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              // Same 500px content width as BaseScreen.
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight,
                    maxWidth: 500,
                  ),
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: AppPadding.screen,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Your Carts", style: AppTextStyles.heading1),
                          AppGaps.h4,
                          AppGaps.h24,
                          AppSearchBar(
                            hintText: "Search outlet name or city...",
                            onChanged: (value) =>
                                setState(() => searchQuery = value),
                          ),

                          AppGaps.h24,

                          if (_isLoading)
                            const Center(child: CircularProgressIndicator())
                          else if (_filteredCarts.isEmpty)
                            _buildEmptyState()
                          else
                            ..._filteredCarts.map(
                              (cart) => Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: CartCard(
                                  cart: cart,
                                  isSelected: selectedCartId == cart.id,
                                ),
                              ),
                            ),
                          const Spacer(),
                          AppGaps.h16,
                          AppButton(
                            label: "Send Credentials",
                            onPressed: () => _handleSendCredentials(context),
                          ),
                          AppGaps.h16,
                          AppButton(
                            label: "+ Add New Outlet",
                            onPressed: () {
                              Navigator.pushNamed(context, AppRoutes.cartDetails);
                            },
                            isDotted: true,
                            backgroundColor: Colors.transparent,
                            borderColor: AppColors.grey300,
                            textColor: AppColors.primary,
                          ),
                          AppGaps.h16,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final isSearching = searchQuery.isNotEmpty;
    return Center(
      child: Column(
        children: [
          AppGaps.h32,
          Icon(
            _loadFailed
                ? Icons.cloud_off_outlined
                : isSearching
                ? Icons.search_off_rounded
                : Icons.storefront_outlined,
            size: 64,
            color: AppColors.grey300,
          ),
          AppGaps.h16,
          Text(
            _loadFailed
                ? "Couldn't load outlets."
                : isSearching
                ? "No outlets found matching '$searchQuery'"
                : "No outlets yet. Add the vendor's first outlet below.",
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
          if (_loadFailed)
            TextButton(onPressed: _loadCarts, child: const Text("Retry")),
        ],
      ),
    );
  }
}
