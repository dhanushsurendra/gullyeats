import 'package:ordering/core/widgets/app_logo.dart';
import 'package:flutter/material.dart';
import 'package:ordering/features/alerts/area_alerts.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/theme_provider.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/presentation/edit_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/screens/edit_menu_screen.dart';
import 'package:ordering/features/orders/screens/orders_overview_screen.dart';
import 'package:ordering/features/payment/presentation/payment_screen.dart';
import 'package:ordering/features/profile/presentation/change_pin_screen.dart';
import 'package:ordering/features/profile/presentation/language_preferences_screen.dart';
import 'package:ordering/features/profile/presentation/qr_screen.dart';
import 'package:ordering/features/profile/presentation/staff_management_screen.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoggingOut = false;

  Future<void> _logout() async {
    if (_isLoggingOut) return;

    setState(() => _isLoggingOut = true);

    await signOut(context);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final cartProvider = context.watch<CartProvider>();
    final selectedCart = cartProvider.selectedCart;
    final phoneNumber = authProvider.user?['phoneNumber'] ?? '';
    final vendorName = (authProvider.user?['name'] ?? context.l10n.vendor)
        .toString();
    final initials = vendorName
        .split(' ')
        .where((e) => e.isNotEmpty)
        .take(2)
        .map((e) => e[0].toUpperCase())
        .join();

    return BaseScreen(
      showBackButton: false,
      header: Row(
        children: [
          const AppLogo(),
          AppGaps.w16,
          const Flexible(
            child: Align(
              alignment: Alignment.centerRight,
              child: CartSelector(),
            ),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _profileCard(context, initials, vendorName, phoneNumber),
          AppGaps.h12,

          _outletCard(context, selectedCart),
          AppGaps.h12,

          // Owners and staff can both warn nearby carts.
          const AreaAlertTile(),
          AppGaps.h12,

          // Fee bills, the menu and staff logins are the owner's (the server
          // refuses staff). Staff still mark items out of stock from Orders.
          if (!authProvider.isStaff) ...[
            _sectionCard(
              Icons.receipt_long_rounded,
              context.l10n.paymentsHistory,
              context.l10n.trackPayments,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PaymentScreen()),
              ),
            ),
            AppGaps.h12,

            _sectionCard(
              Icons.restaurant_menu_rounded,
              context.l10n.menuManagement,
              context.l10n.editMenuItems,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const EditMenuScreen()),
              ),
            ),
            AppGaps.h12,

            _sectionCard(
              Icons.groups_rounded,
              context.l10n.staffManagement,
              context.l10n.editStaffDetails,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const StaffManagementScreen(),
                ),
              ),
            ),
            AppGaps.h12,
          ],

          _sectionCard(
            Icons.insights_rounded,
            context.l10n.ordersOverview,
            context.l10n.viewOrderDetails,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const OrdersOverviewScreen()),
            ),
          ),
          AppGaps.h12,

          // Vendor terms, served by the customer web app
          // (customer-app/public/vendor-terms.html).
          _sectionCard(
            Icons.description_outlined,
            context.l10n.termsAndConditions,
            context.l10n.termsAndPrivacySubtitle,
            onTap: () => launchUrl(
              Uri.parse('https://gullyeats.in/vendor-terms.html'),
              mode: LaunchMode.externalApplication,
            ),
          ),

          AppGaps.h12,

          _languageCard(context),
          AppGaps.h12,

          _themeCard(context),
          AppGaps.h12,

          _securityCard(context),

          // Room for the floating bottom navigation bar.
          const SizedBox(height: 40),
        ],
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
                Text(
                  vendorName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.heading3,
                ),
                if (phoneNumber.toString().isNotEmpty)
                  Text(phoneNumber, style: AppTextStyles.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _outletCard(BuildContext context, CartModel? selectedCart) {
    final isOpen = selectedCart?.isOpen ?? false;

    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  context.l10n.cartDetails,
                  style: AppTextStyles.heading3,
                ),
              ),
              // Cart details (name, address, photo, parcel charge) are the owner's.
              if (!context.watch<AuthProvider>().isStaff)
                Material(
                  color: AppColors.grey100,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: selectedCart == null
                        ? null
                        : () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  EditCartScreen(cart: selectedCart),
                            ),
                          ),
                    child: const SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(
                        Icons.edit_outlined,
                        size: 20,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          AppGaps.h8,
          // Open/closed on its own row, so a long label never squeezes the title.
          Row(
            children: [
              Icon(
                Icons.circle,
                size: 10,
                color: isOpen ? AppColors.success : AppColors.grey400,
              ),
              AppGaps.w8,
              Expanded(
                child: Text(
                  isOpen ? context.l10n.cartOpen : context.l10n.closed,
                  style: AppTextStyles.body.copyWith(
                    color: isOpen ? AppColors.success : AppColors.grey600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Switch(
                value: isOpen,
                onChanged: (value) async {
                  if (selectedCart == null) return;
                  try {
                    await context.read<CartProvider>().toggleCartStatus(
                      context.read<AuthProvider>().token ?? '',
                      selectedCart.id,
                      value,
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    AppSnackBar.show(
                      context,
                      message: AppExceptionHandler.getMessage(e),
                      isError: true,
                    );
                  }
                },
                activeTrackColor: AppColors.primary,
                inactiveTrackColor: AppColors.grey300,
                thumbColor: WidgetStateProperty.all(Colors.white),
                trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
              ),
            ],
          ),

          AppGaps.h16,

          // Cart information          AppGaps.h16,

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
                  context.l10n.cartIdCaps,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),

                const SizedBox(height: 3),

                Text(
                  selectedCart?.cartId ?? context.l10n.notAvailable,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),

                AppGaps.h12,

                Text(
                  context.l10n.address.toUpperCase(),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.grey600,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),

                const SizedBox(height: 3),

                Text(
                  selectedCart?.address ?? context.l10n.notAvailable,
                  style: AppTextStyles.body,
                ),
              ],
            ),
          ),

          AppGaps.h16,

          AppButton(
            label: context.l10n.viewQrCaps,
            backgroundColor: AppColors.surface,
            borderColor: AppColors.primary,
            textColor: AppColors.primary,
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const QrPosterScreen()),
            ),
          ),
        ],
      ),
    );
  }

  /// The orange icon badge every Profile item starts with (the alerts tile
  /// has the same badge in red).
  Widget _iconBox(IconData icon) => Container(
    width: 40,
    height: 40,
    decoration: BoxDecoration(
      color: AppColors.lightOrange,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(icon, size: 22, color: AppColors.primary),
  );

  Widget _sectionCard(
    IconData icon,
    String title,
    String subtitle, {
    required VoidCallback onTap,
  }) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: _iconBox(icon),
        title: Text(title, style: AppTextStyles.heading3),
        subtitle: Text(subtitle, style: AppTextStyles.caption),
        trailing: Icon(Icons.chevron_right, color: AppColors.grey500),
      ),
    );
  }

  Widget _languageCard(BuildContext context) {
    return AppCard(
      padding: AppPadding.card,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _iconBox(Icons.translate_rounded),
          AppGaps.w16,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        context.l10n.languagePreferences,
                        style: AppTextStyles.heading3,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const LanguagePreferencesScreen(),
                        ),
                      ),
                      child: Text(
                        context.l10n.change,
                        style: AppTextStyles.body.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  LanguageProvider.languages[context
                      .watch<LanguageProvider>()
                      .locale
                      .languageCode]!,
                  style: AppTextStyles.body,
                ),
                AppGaps.h4,
                Text(
                  context.l10n.supportedLanguages,
                  style: AppTextStyles.caption,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _themeCard(BuildContext context) {
    final theme = context.watch<ThemeProvider>();
    return AppCard(
      padding: EdgeInsets.zero,
      child: SwitchListTile(
        value: theme.dark,
        onChanged: theme.setDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        secondary: _iconBox(
          theme.dark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
        ),
        title: Text(context.l10n.darkTheme, style: AppTextStyles.heading3),
        subtitle: Text(
          context.l10n.darkThemeSubtitle,
          style: AppTextStyles.caption,
        ),
        activeTrackColor: AppColors.primary,
        inactiveTrackColor: AppColors.grey300,
        thumbColor: WidgetStateProperty.all(Colors.white),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
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
            leading: _iconBox(Icons.lock_outline_rounded),
            title: Text(
              context.l10n.securityAndLogin,
              style: AppTextStyles.heading3,
            ),
            subtitle: Text(
              context.l10n.changePin,
              style: AppTextStyles.caption,
            ),
            trailing: Icon(Icons.chevron_right, color: AppColors.grey500),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ChangePinScreen()),
            ),
          ),
          AppGaps.h8,
          Divider(color: AppColors.grey200),
          AppGaps.h16,
          AppButton(
            isLoading: _isLoggingOut,
            disabled: _isLoggingOut,
            onPressed: _isLoggingOut ? null : _logout,
            label: context.l10n.logOutCaps,
          ),
        ],
      ),
    );
  }
}
