import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/features/activation/screens/cart_activated_screen.dart';
import 'package:gullyeats/features/activation/screens/qr_poster_screen.dart';
import 'package:gullyeats/features/auth/screens/pin_login_screen.dart';
import 'package:gullyeats/features/auth/screens/signup_screen.dart';
import 'package:gullyeats/features/auth/screens/verify_otp_screen.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';
import 'package:gullyeats/features/menu/screens/add_menu_screen.dart';
import 'package:gullyeats/features/menu/screens/menu_review_screen.dart';
import 'package:gullyeats/features/menu/widgets/edit_menu_dialog.dart';
import 'package:gullyeats/features/menu/widgets/menu_review_card.dart';
import 'package:gullyeats/features/menu/widgets/staff_member_card.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/widgets/cart_card.dart';
import 'package:gullyeats/features/onboarding/screens/cart_details_screen.dart';
import 'package:gullyeats/features/onboarding/screens/cart_photo_screen.dart';
import 'package:gullyeats/features/onboarding/screens/carts_screen.dart';
import 'package:gullyeats/features/onboarding/screens/confirm_location_screen.dart';
import 'package:gullyeats/features/onboarding/screens/enable_location_screen.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/onboarding/widgets/main_road_warning.dart';
import 'package:gullyeats/features/splash/presentation/splash_screen.dart';
import 'package:gullyeats/features/staff_management/screens/operating_setup_screen.dart';
import 'package:gullyeats/features/staff_management/screens/staff_management_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'harness.dart';

class ScreenCase {
  final String name;
  final Widget Function() build;
  final Object? arguments;
  final bool hasInputs;
  final Future<void> Function(WidgetTester tester)? interact;
  const ScreenCase(
    this.name,
    this.build, {
    this.arguments,
    this.hasInputs = false,
    this.interact,
  });
}

// Long values on purpose: real cart names and addresses vary a lot.
const _longCartName = "Ramesh's Famous Masala Dosa & Filter Coffee Point";

final _cartJson = jsonEncode({
  '_id': '665f1c2ab1',
  'cartName': _longCartName,
  'cartCity': 'Bangalore',
  'cartId': 'GE-BLR-000123',
  'address': '12th Main Road, Indiranagar',
  'isActive': true,
  'isOpen': true,
  'userId': 'u1',
});

final _menuItems = [
  MenuItemModel(name: 'Masala Dosa', price: 60, isVeg: true),
  MenuItemModel(
    name: 'Ghee Roast Paper Dosa with Extra Chutney and Sambar',
    price: 1250,
    isVeg: true,
  ),
  MenuItemModel(name: 'Chicken 65', price: 180, isVeg: false),
];

final screens = <ScreenCase>[
  ScreenCase('splash', () => const SplashScreen()),
  ScreenCase('signup', () => const SignupScreen(), hasInputs: true),
  ScreenCase('pin_login', () => const PinLoginScreen(), hasInputs: true),
  ScreenCase(
    'verify_otp',
    () => const VerifyOtpScreen(),
    arguments: '9876543210',
    hasInputs: true,
  ),
  ScreenCase(
    'carts',
    () => const CartsScreen(),
    arguments: {'userId': 'u1', 'pin': '1234', 'phoneNumber': '9876543210'},
  ),
  ScreenCase('cart_details', () => const CartDetailsScreen(), hasInputs: true),
  ScreenCase('cart_photo', () => const CartPhotoScreen()),
  ScreenCase('enable_location', () => const EnableLocationScreen()),
  // The warning Enable Location adds under the map near a main road.
  ScreenCase(
    'main_road_warning',
    () => const BaseScreen(
      title: 'Enable Location',
      subtitle: 'We need your location to verify your cart',
      child: MainRoadWarning(road: 'Hosur Road (Bengaluru–Hosur Highway)'),
    ),
  ),
  ScreenCase(
    'confirm_location',
    () => const ConfirmLocationScreen(),
    arguments: {
      'placemark': Placemark(
        name: '42, 100 Feet Road, Opposite Metro Pillar 128',
        subLocality: 'HAL 2nd Stage, Indiranagar',
        locality: 'Bengaluru',
        administrativeArea: 'Karnataka',
        postalCode: '560038',
      ),
      'accuracy': 12,
      'lat': 12.97,
      'lng': 77.64,
    },
  ),
  ScreenCase(
    'add_menu',
    () => const AddMenuScreen(),
    hasInputs: true,
    interact: (tester) async {
      for (var i = 0; i < 2; i++) {
        await tester.tap(find.text('+ ADD ITEM'));
        await tester.pump();
      }
    },
  ),
  ScreenCase(
    'menu_review',
    () => MenuReviewScreen(menuItems: List.of(_menuItems)),
  ),
  ScreenCase('operating_setup', () => const OperatingSetupScreen()),
  ScreenCase(
    'staff_management',
    () => const StaffManagementScreen(),
    hasInputs: true,
  ),
  ScreenCase('cart_activated', () => const CartActivatedScreen()),
  ScreenCase('qr_poster', () => const QrPosterScreen()),
  // Cards that the screens above only show with live API data.
  ScreenCase(
    'cards_long_content',
    () => Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            CartCard(
              isSelected: true,
              cart: CartModel(
                id: '1',
                cartName: _longCartName,
                cartCity: 'Bangalore',
                cartId: 'GE-BLR-0001234567',
                address:
                    '42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
                cartImageUrl: '',
                qrImageUrl: '',
                isActive: true,
                isOpen: true,
                userId: 'u1',
                location: CartLocation.empty(),
              ),
            ),
            const SizedBox(height: 16),
            MenuReviewCard(
              name: _menuItems[1].name,
              price: 12500.5,
              isVeg: false,
              onEdit: () {},
              onDelete: () {},
            ),
            const SizedBox(height: 16),
            StaffMemberCard(
              staffId: 's1',
              name: 'Venkataramanan Subramaniam Iyer',
              phone: '+91 9876543210',
              onDelete: (_) {},
            ),
            const SizedBox(height: 16),
            GeneratedCartIdCard(
              generatedCartId: 'GE-BLR-0001234567-XYZ',
              onCopy: () {},
              isCopying: false,
            ),
          ],
        ),
      ),
    ),
  ),
  ScreenCase(
    'edit_menu_sheet',
    // Opened the same way MenuReviewScreen opens it.
    () => Scaffold(
      body: Builder(
        builder: (context) => TextButton(
          onPressed: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            builder: (_) => const EditMenuDialog(
              initialName: 'Masala Dosa',
              initialPrice: 60,
              initialIsVeg: true,
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
    hasInputs: true,
    interact: (tester) async {
      await tester.tap(find.text('open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    },
  ),
];

void main() {
  setUpAll(loadFonts);

  for (final screen in screens) {
    group(screen.name, () {
      final devices = [
        ...portraitDevices,
        ...landscapeDevices,
        ...largeTextDevices,
        if (screen.hasInputs) ...keyboardDevices,
      ];
      for (final device in devices) {
        testWidgets('renders without layout errors at ${device.name}', (
          tester,
        ) async {
          SharedPreferences.setMockInitialValues({
            'cart': _cartJson,
            'token': 't',
          });
          final providers = TestProviders();
          // Earlier screens in the real flow load these before this one opens.
          await providers.cart.loadCartId();
          await providers.cart.loadCartDetails();

          final errors = await renderAt(
            tester,
            device,
            buildApp(providers, screen.build(), arguments: screen.arguments),
            screenName: screen.name,
            interact: screen.interact,
          );
          expect(errors, isEmpty, reason: errors.join('\n\n'));
        });
      }
    });
  }
}
