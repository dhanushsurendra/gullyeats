import 'package:ordering/core/widgets/app_logo.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/icon_tile.dart';
import 'package:ordering/features/alerts/area_alerts.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/theme_provider.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/screens/edit_menu_screen.dart';
import 'package:ordering/features/orders/screens/orders_overview_screen.dart';
import 'package:ordering/features/payment/presentation/payment_screen.dart';
import 'package:ordering/features/profile/presentation/change_pin_screen.dart';
import 'package:ordering/features/profile/presentation/language_preferences_screen.dart';
import 'package:ordering/features/profile/presentation/staff_management_screen.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';
import 'package:ordering/features/profile/widgets/cart_details_card.dart';

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

          CartDetailsCard(cart: selectedCart),
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

  Widget _sectionCard(
    IconData icon,
    String title,
    String subtitle, {
    required VoidCallback onTap,
  }) => IconTile(icon: icon, title: title, subtitle: subtitle, onTap: onTap);

  Widget _languageCard(BuildContext context) {
    void change() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LanguagePreferencesScreen()),
    );
    return IconTile(
      icon: Icons.translate_rounded,
      title: context.l10n.languagePreferences,
      subtitle: LanguageProvider
          .languages[context.watch<LanguageProvider>().locale.languageCode]!,
      footnote: context.l10n.supportedLanguages,
      onTap: change,
      trailing: Text(
        context.l10n.change,
        style: AppTextStyles.body.copyWith(
          color: AppColors.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _themeCard(BuildContext context) {
    final theme = context.watch<ThemeProvider>();
    return IconTile(
      icon: theme.dark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
      title: context.l10n.darkTheme,
      subtitle: context.l10n.darkThemeSubtitle,
      onTap: () => theme.setDark(!theme.dark),
      trailing: Switch(
        value: theme.dark,
        onChanged: theme.setDark,
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
          IconTile(
            card: false,
            icon: Icons.lock_outline_rounded,
            title: context.l10n.securityAndLogin,
            subtitle: context.l10n.changePin,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ChangePinScreen()),
            ),
          ),
          AppGaps.h16,
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
