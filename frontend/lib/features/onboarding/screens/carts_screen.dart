import 'package:flutter/material.dart';
import 'package:gullyeats/core/widgets/skeleton.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_footer.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
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

  /// Opens Cart Details: prefilled for an existing cart (its Continue then
  /// resumes at the first unfinished step), empty for a new one. Reloads the
  /// list afterwards so statuses are current.
  Future<void> _openCart(CartModel? cart) async {
    await Navigator.pushNamed(context, AppRoutes.cartDetails, arguments: cart);
    if (mounted) _loadCarts();
  }

  /// Texts the vendor their login ID and a new PIN. Only the PIN's hash is
  /// stored, so a PIN can't be sent again; each press issues a new one.
  Future<void> _handleSendCredentials(BuildContext context) async {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final phoneNumber = args?['phoneNumber'];

    if (phoneNumber == null) {
      AppSnackBar.show(
        context,
        message: "Vendor phone number missing",
        isError: true,
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Send new login PIN?"),
        content: const Text(
          "This creates a new PIN and texts it to the vendor with their "
          "login ID. Their current PIN will stop working.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Cancel"),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Send"),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final credentials = await auth.resetPin();
      final message =
          "Your GullyEats login:\nID: ${credentials['userId']}\nPIN: ${credentials['pin']}";

      final smsUri = Uri(
        scheme: 'sms',
        path: phoneNumber,
        queryParameters: {'body': message},
      );
      if (!await launchUrl(smsUri)) throw 'could_not_launch_sms';
    } catch (e) {
      if (!context.mounted) return;

      final errorMessage = (e == 'could_not_launch_sms')
          ? "New PIN created, but couldn't open the SMS app. Try again."
          : AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: errorMessage, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Back from here returns to sign-up for the next vendor, so it logs out
    // (or reopening the app would land on this vendor again).
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) context.read<AuthProvider>().logout();
      },
      child: BaseScreen(
        title: "Your Carts",
        subtitle: "Tap an outlet to continue its setup.",
        showBackButton: false,
        expandToFullHeight: true,
        bottomNavigationBar: AppFooter(
          children: [
            AppButton(
              label: "+ ADD NEW OUTLET",
              onPressed: () => _openCart(null),
              isDotted: true,
              backgroundColor: Colors.transparent,
              borderColor: AppColors.grey300,
              textColor: AppColors.primary,
            ),
            AppButton(
              label: "SEND CREDENTIALS",
              onPressed: () => _handleSendCredentials(context),
            ),
          ],
        ),
        child: Column(
          children: [
            AppSearchBar(
              hintText: "Search outlet name or city...",
              onChanged: (value) => setState(() => searchQuery = value),
            ),
            AppGaps.h24,
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadCarts,
                child: _buildList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList() {
    // Only the first load shows placeholders; reloads keep the list on screen.
    if (_isLoading && _allCarts.isEmpty) {
      return Skeleton.rows(count: 5, height: 84);
    }
    final carts = _filteredCarts;
    return ListView.separated(
      // Scrollable even when short, so pull-to-refresh always works.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 16),
      itemCount: carts.isEmpty ? 1 : carts.length,
      separatorBuilder: (_, _) => AppGaps.h16,
      itemBuilder: (_, i) => carts.isEmpty
          ? _buildEmptyState()
          : CartCard(
              cart: carts[i],
              isSelected: selectedCartId == carts[i].id,
              onTap: () => _openCart(carts[i]),
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
