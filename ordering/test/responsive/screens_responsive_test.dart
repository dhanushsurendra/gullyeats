import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/voice/voice_confirm_sheet.dart';
import 'package:ordering/features/orders/voice/voice_parser.dart';
import 'package:ordering/features/orders/voice/voice_session.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/app/home/home_screen.dart';
import 'package:ordering/features/auth/presentation/login_screen.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/presentation/edit_cart_screen.dart';
import 'package:ordering/features/cart/presentation/sales_screen.dart';
import 'package:ordering/features/orders/screens/handover_screen.dart';
import 'package:ordering/features/cart/presentation/stock_screen.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/presentation/welcome_screen.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/screens/add_new_item.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';
import 'package:ordering/features/orders/screens/edit_menu_screen.dart';
import 'package:ordering/features/orders/screens/orders_overview_screen.dart';
import 'package:ordering/features/orders/widgets/edit_menu_dialog.dart';
import 'package:ordering/features/payment/presentation/payment_lock_screen.dart';
import 'package:ordering/features/payment/presentation/payment_screen.dart';
import 'package:ordering/features/profile/presentation/change_pin_screen.dart';
import 'package:ordering/features/profile/presentation/language_preferences_screen.dart';
import 'package:ordering/features/profile/presentation/profile_screen.dart';
import 'package:ordering/features/profile/presentation/qr_screen.dart';
import 'package:ordering/features/profile/presentation/staff_management_screen.dart';
import 'package:ordering/features/splash/presentation/splash_screen.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/features/weather/mood.dart';
import 'package:ordering/features/weather/weather_service.dart';
import 'package:ordering/features/weather/weather_sheet.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_backend.dart';
import 'harness.dart';

class ScreenCase {
  final String name;
  final Widget Function() build;
  final bool hasInputs;
  final Future<void> Function(WidgetTester tester)? interact;
  const ScreenCase(this.name, this.build, {this.hasInputs = false, this.interact});
}

/// Opens [sheet] the way the app does: a modal bottom sheet over a screen.
ScreenCase sheetCase(String name, Widget Function() sheet, {bool hasInputs = false}) =>
    ScreenCase(
      name,
      () => Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => sheet(),
            ),
            child: const Text('open'),
          ),
        ),
      ),
      hasInputs: hasInputs,
      interact: (tester) async {
        await tester.tap(find.text('open'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
      },
    );

final screens = <ScreenCase>[
  ScreenCase('splash', () => const SplashScreen()),
  ScreenCase('login', () => const LoginScreen(), hasInputs: true),
  ScreenCase('switch_cart', () => const SwitchCartScreen(isDraggable: false)),
  sheetCase('switch_cart_sheet', () => const SwitchCartScreen(isDraggable: true)),
  ScreenCase('welcome', () => const WelcomeScreen()),
  ScreenCase('home_orders', () => const HomeScreen()),
  ScreenCase('stock', () => const StockScreen()),
  ScreenCase('new_order', () => const AddNewOrder()),
  ScreenCase(
    'edit_order',
    () => AddNewOrder(existingOrder: OrderModel.fromJson(ordersJson[0])),
  ),
  ScreenCase('sales', () => const SalesScreen()),
  ScreenCase('handover', () => const HandoverScreen()),
  ScreenCase('orders_overview', () => const OrdersOverviewScreen()),
  ScreenCase('edit_menu', () => const EditMenuScreen()),
  ScreenCase('add_item', () => const AddItemScreen(), hasInputs: true),
  sheetCase(
    'edit_item_sheet',
    () => const EditMenuDialog(
      initialName: 'Ghee Roast Paper Dosa with Extra Chutney and Sambar',
      initialPrice: 1250,
      initialIsVeg: true,
      initialInStock: true,
      initialImageUrl: '',
      initialNames: {
        'kn': 'ಗಹೀ ರೋಸ್ಟ್ ಪೇಪರ್ ದೋಸಾ ವಿಥ್ ಎಕ್ಸ್ಟ್ರಾ ಚಟ್ನಿ ಅಂಡ್ ಸಾಂಬಾರ್',
        'ta': 'கஹீ ரோசஸ்ட பேப்பர் தோச வித் எக்ஸ்ட்ரா சட்னி அண்ட் சாம்பார்',
      },
      id: 'm2',
      cartId: 'c1',
    ),
    hasInputs: true,
  ),
  ScreenCase('profile', () => const ProfileScreen()),
  ScreenCase(
    'edit_cart',
    () => EditCartScreen(cart: CartModel.fromJson(cartJson)),
    hasInputs: true,
  ),
  ScreenCase('change_pin', () => const ChangePinScreen(), hasInputs: true),
  ScreenCase('language', () => const LanguagePreferencesScreen()),
  ScreenCase('qr_poster', () => const QrPosterScreen()),
  ScreenCase('staff', () => const StaffManagementScreen(), hasInputs: true),
  ScreenCase('payments', () => const PaymentScreen()),
  // The weather sheet by day, and in the evening with Chill's business card.
  sheetCase('weather_sheet', () {
    WeatherService.current.value = WeatherData.fromJson(weatherJson());
    return Material(color: AppColors.surface, child: const WeatherDetails(mood: Mood.sunnyCloudy));
  }),
  sheetCase('weather_sheet_evening', () {
    WeatherService.current.value = WeatherData.fromJson(weatherJson(evening: true));
    return Material(color: AppColors.surface, child: const WeatherDetails(mood: Mood.chillEvening));
  }),
  // A voice order heard with a long dish name, an out-of-stock dish and an
  // unmatched word: the confirmation sheet at every size.
  sheetCase('voice_confirm', () {
    final menu = [for (final j in menuJson) MenuItemModel.fromJson(j)];
    const heard = '2 masala dosa 1 ghee roast paper dosa with extra chutney and sambar 1 filter coffee pizza parcel paid';
    return Material(
      color: AppColors.surface,
      child: VoiceConfirmSheet(
        command: parseVoiceCommand(heard, menu, const []),
        heard: heard,
        session: VoiceSession(),
        parcelCharge: 10,
        platformFee: 2,
        onEdit: (_) {},
      ),
    );
  }),
  ScreenCase(
    'payment_lock',
    () => const PaymentLockScreen(
      cartName: longCartName,
      cartAddress: '42, 100 Feet Road, HAL 2nd Stage, Indiranagar',
      ordersCompleted: 64,
      platformFee: 128,
      amountDue: 128,
    ),
  ),
];

void main() {
  setUpAll(() async {
    OrderProvider.liveUpdates = false;
    // The payment lock screen starts Razorpay, a native plugin tests don't have.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('razorpay_flutter'), (_) async => null);
    await loadFonts();
  });

  for (final screen in screens) {
    group(screen.name, () {
      final devices = [
        ...portraitDevices,
        ...landscapeDevices,
        ...largeTextDevices,
        ...localeDevices,
        if (screen.hasInputs) ...keyboardDevices,
      ];
      for (final device in devices) {
        testWidgets('renders without layout errors at ${device.name}', (tester) async {
          // The session a logged-in vendor has after picking a cart.
          SharedPreferences.setMockInitialValues({
            'token': 't',
            'user': jsonEncode({'id': 'u1', 'userId': 'VEN-AB12CD', 'name': 'Ramesh Kumar', 'phoneNumber': '9876543210'}),
            'selected_cart': jsonEncode(cartJson),
          });
          final providers = TestProviders();
          await providers.auth.loadToken();
          await providers.auth.loadUser();
          await providers.cart.loadSelectedCart();

          final errors = await renderAt(
            tester,
            device,
            buildApp(providers, screen.build(), locale: device.locale),
            screenName: screen.name,
            interact: screen.interact,
          );
          expect(errors, isEmpty, reason: errors.join('\n\n'));
        });
      }
    });
  }
}
