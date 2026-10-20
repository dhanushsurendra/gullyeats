import 'package:flutter/material.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/presentation/edit_cart_screen.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/screens/edit_menu_screen.dart';
import 'package:ordering/features/orders/screens/orders_overview_screen.dart';
import 'package:ordering/features/payment/presentation/payment_screen.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/profile/presentation/change_pin_screen.dart';
import 'package:ordering/features/profile/presentation/language_preferences_screen.dart';
import 'package:ordering/features/profile/presentation/qr_screen.dart';
import 'package:ordering/features/profile/presentation/staff_management_screen.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:provider/provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ScrollController _scrollController = ScrollController();
  bool isScrolled = false;
  bool _isLoggingOut = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      final scrolled = _scrollController.offset > 0;
      if (scrolled != isScrolled) {
        setState(() {
          isScrolled = scrolled;
        });
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void openSwitchCartSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SwitchCartScreen(isDraggable: true),
    );
  }

  Future<void> _logout() async {
    if (_isLoggingOut) return;

    setState(() => _isLoggingOut = true);

    final orderProvider = context.read<OrderProvider>();
    final menuProvider = context.read<MenuProvider>();
    final cartProvider = context.read<CartProvider>();
    final profileProvider = context.read<ProfileProvider>();
    final staffProvider = context.read<StaffProvider>();
    final paymentProvider = context.read<PaymentProvider>();
    final authProvider = context.read<AuthProvider>();

    orderProvider.clear();
    menuProvider.clear();
    await cartProvider.clear();
    profileProvider.clear();
    staffProvider.clear();
    paymentProvider.clear();

    await authProvider.logout();

    if (!mounted) return;

    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final cartProvider = context.watch<CartProvider>();
    final selectedCart = cartProvider.selectedCart;
    final phoneNumber = authProvider.user?['phoneNumber'] ?? '';
    final vendorName = (authProvider.user?['name'] ?? 'Vendor').toString();
    final initials = vendorName
        .split(' ')
        .where((e) => e.isNotEmpty)
        .take(2)
        .map((e) => e[0].toUpperCase())
        .join();

    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0,
        scrolledUnderElevation: 2,
        surfaceTintColor: Colors.transparent,
        automaticallyImplyLeading: false,
        titleSpacing: 0,
        toolbarHeight: 80,
        title: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Image.asset(
                "assets/images/logo_text.png",
                height: 24,
                fit: BoxFit.contain,
              ),
              const Spacer(),
              _buildOutletSelector(context),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: SingleChildScrollView(
              padding: AppPadding.screen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _profileCard(context, initials, vendorName, phoneNumber),
                  AppGaps.h12,

                  _outletCard(context, selectedCart),
                  AppGaps.h12,

                  _sectionCard(
                    "Payments History",
                    "Track Payments",
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const PaymentScreen()),
                    ),
                  ),

                  AppGaps.h12,

                  _sectionCard(
                    "Menu Management",
                    "Edit Menu Items",
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const EditMenuScreen()),
                    ),
                  ),
                  AppGaps.h12,

                  _sectionCard(
                    "Staff Management",
                    "Edit Staff Details",
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const StaffManagementScreen(),
                      ),
                    ),
                  ),
                  AppGaps.h12,

                  _sectionCard(
                    "Orders Overview",
                    "View Order Details",
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const OrdersOverviewScreen(),
                      ),
                    ),
                  ),

                  AppGaps.h12,

                  _languageCard(context),
                  AppGaps.h12,

                  _securityCard(context),

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _profileCard(
    BuildContext context,
    String initials,
    String vendorName,
    String phoneNumber,
  ) {
    return AppCard(
      padding: AppPadding.card,
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primary,
            child: Text(
              initials,
              style: AppTextStyles.heading3.copyWith(color: AppColors.white),
            ),
          ),
          AppGaps.w12,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vendorName, style: AppTextStyles.heading3),
                Text(phoneNumber, style: AppTextStyles.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOutletSelector(BuildContext context) {
    return Consumer<CartProvider>(
      builder: (_, cartProvider, _) {
        final carts = cartProvider.carts;

        if (carts.isEmpty) {
          return const SizedBox.shrink();
        }

        final cart = cartProvider.selectedCart;

        if (cart == null) {
          return const SizedBox.shrink();
        }

        return GestureDetector(
          onTap: () => openSwitchCartSheet(context),
          child: Container(
            padding: AppPadding.smallCard,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.grey300),
              borderRadius: BorderRadius.circular(12),
              color: AppColors.white,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 120,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        cart.cartName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.heading3.copyWith(fontSize: 14),
                      ),
                      Text(
                        cart.address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption,
                      ),
                    ],
                  ),
                ),

                AppGaps.w8,

                const Icon(
                  Icons.keyboard_arrow_down,
                  size: 18,
                  color: AppColors.grey500,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _outletCard(BuildContext context, CartModel? selectedCart) {
    final isOpen = selectedCart?.isOpen ?? false;

    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Expanded(
                child: Text("Cart Details", style: AppTextStyles.heading3),
              ),

              // Status
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: isOpen
                      ? AppColors.success.withValues(alpha: 0.10)
                      : AppColors.grey100,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isOpen ? "Open" : "Closed",
                  style: AppTextStyles.caption.copyWith(
                    color: isOpen ? AppColors.success : AppColors.grey600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Simple switch
              SizedBox(
                height: 32,
                child: Switch(
                  value: isOpen,
                  onChanged: (value) async {
                    if (selectedCart != null) {
                      await context.read<CartProvider>().toggleCartStatus(
                        context.read<AuthProvider>().token!,
                        selectedCart.id,
                        value,
                      );
                    }
                  },
                  activeTrackColor: AppColors.primary,
                  inactiveTrackColor: AppColors.grey300,
                  thumbColor: WidgetStateProperty.all(Colors.white),
                  trackOutlineColor: WidgetStateProperty.all(
                    Colors.transparent,
                  ),
                ),
              ),

              const SizedBox(width: 4),

              // Edit button
              Material(
                color: AppColors.grey100,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: selectedCart == null
                      ? null
                      : () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  EditCartScreen(cart: selectedCart),
                            ),
                          );
                        },
                  child: const SizedBox(
                    width: 38,
                    height: 38,
                    child: Icon(
                      Icons.edit_outlined,
                      size: 19,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),

          AppGaps.h16,

          // Cart information
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "CART ID",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),

                const SizedBox(height: 3),

                Text(
                  selectedCart?.cartId ?? 'N/A',
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),

                AppGaps.h12,

                Text(
                  "ADDRESS",
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),

                const SizedBox(height: 3),

                Text(selectedCart?.address ?? 'N/A', style: AppTextStyles.body),
              ],
            ),
          ),

          AppGaps.h16,

          // Keep VIEW QR exactly as it is
          SizedBox(
            width: 100,
            child: ElevatedButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const QrPosterScreen()),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(26),
                ),
              ),
              child: const Text("VIEW QR", style: TextStyle(fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(
    String title,
    String subtitle, {
    required VoidCallback onTap,
  }) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: AppTextStyles.heading3),
        subtitle: Text(subtitle, style: AppTextStyles.caption),
        trailing: const Icon(Icons.chevron_right, color: AppColors.grey500),
      ),
    );
  }

  Widget _languageCard(BuildContext context) {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Language Preferences", style: AppTextStyles.heading3),
              TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const LanguagePreferencesScreen(),
                  ),
                ),
                child: Text(
                  "Change",
                  style: TextStyle(color: AppColors.primary, fontSize: 14),
                ),
              ),
            ],
          ),
          Text("English", style: AppTextStyles.body),
          AppGaps.h4,
          Text(
            "Supported: Kannada, Tamil, Hindi, English",
            style: AppTextStyles.caption,
          ),
        ],
      ),
    );
  }

  Widget _securityCard(BuildContext context) {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text("Security & Login", style: AppTextStyles.heading3),
            subtitle: Text("Change PIN", style: AppTextStyles.caption),
            trailing: const Icon(Icons.chevron_right, color: AppColors.grey500),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ChangePinScreen()),
            ),
          ),
          AppGaps.h12,
          const Divider(color: AppColors.grey300),
          AppGaps.h12,
          AppButton(
            isLoading: _isLoggingOut,
            disabled: _isLoggingOut,
            onPressed: _isLoggingOut ? null : _logout,
            label: "LOG OUT",
          ),
        ],
      ),
    );
  }
}
