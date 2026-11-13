// On-device gallery for checking layouts on an emulator or phone:
//   flutter run -t tool/screen_gallery.dart
// Opens each onboarding screen directly with sample data (no login, nothing is
// sent to the API). Switch screens from a computer by writing the screen index
// to the app's files dir (debug builds only):
//   adb shell "run-as com.gullyeats.onboard sh -c 'echo 3 > files/gallery_index'"
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geocoding/geocoding.dart';
import 'package:path_provider/path_provider.dart';
import 'package:gullyeats/core/theme/theme_provider.dart';
import 'package:gullyeats/core/theme/app_theme.dart';
import 'package:gullyeats/features/activation/providers/activation_provider.dart';
import 'package:gullyeats/features/activation/screens/cart_activated_screen.dart';
import 'package:gullyeats/features/activation/screens/qr_poster_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/auth/screens/signup_screen.dart';
import 'package:gullyeats/features/auth/screens/verify_otp_screen.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';
import 'package:gullyeats/features/menu/providers/menu_provider.dart';
import 'package:gullyeats/features/menu/screens/add_menu_screen.dart';
import 'package:gullyeats/features/menu/screens/menu_review_screen.dart';
import 'package:gullyeats/features/menu/widgets/edit_menu_dialog.dart';
import 'package:gullyeats/features/menu/widgets/menu_review_card.dart';
import 'package:gullyeats/features/menu/widgets/staff_member_card.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:gullyeats/features/onboarding/screens/cart_details_screen.dart';
import 'package:gullyeats/features/onboarding/screens/cart_photo_screen.dart';
import 'package:gullyeats/features/onboarding/screens/carts_screen.dart';
import 'package:gullyeats/features/onboarding/screens/confirm_location_screen.dart';
import 'package:gullyeats/features/onboarding/screens/enable_location_screen.dart';
import 'package:gullyeats/features/onboarding/widgets/cart_card.dart';
import 'package:gullyeats/features/splash/presentation/splash_screen.dart';
import 'package:gullyeats/features/staff_management/providers/staff_provider.dart';
import 'package:gullyeats/features/staff_management/screens/operating_setup_screen.dart';
import 'package:gullyeats/features/staff_management/screens/staff_management_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _longCartName = "Ramesh's Famous Masala Dosa & Filter Coffee Point";

class _Entry {
  final String name;
  final Widget Function() build;
  final Object? arguments;
  const _Entry(this.name, this.build, {this.arguments});
}

final _entries = <_Entry>[
  _Entry('splash', () => const SplashScreen()),
  _Entry('signup', () => const SignupScreen()),
  _Entry('verify_otp', () => const VerifyOtpScreen(), arguments: '9876543210'),
  _Entry('carts', () => const CartsScreen(), arguments: {'userId': 'gallery', 'pin': '1234', 'phoneNumber': '9876543210'}),
  _Entry('cart_details', () => const CartDetailsScreen()),
  _Entry('cart_photo', () => const CartPhotoScreen()),
  _Entry('enable_location', () => const EnableLocationScreen()),
  _Entry(
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
  _Entry('add_menu', () => const AddMenuScreen()),
  _Entry(
    'menu_review',
    () => MenuReviewScreen(menuItems: [
      MenuItemModel(name: 'Masala Dosa', price: 60, isVeg: true),
      MenuItemModel(name: 'Ghee Roast Paper Dosa with Extra Chutney and Sambar', price: 1250, isVeg: true),
      MenuItemModel(name: 'Chicken 65', price: 180, isVeg: false),
    ]),
  ),
  _Entry('operating_setup', () => const OperatingSetupScreen()),
  _Entry('staff_management', () => const StaffManagementScreen()),
  _Entry('cart_activated', () => const CartActivatedScreen()),
  _Entry('qr_poster', () => const QrPosterScreen()),
  _Entry('edit_menu_sheet', () => const _EditSheetLauncher()),
  _Entry('cards_long_content', () => const _Cards()),
];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // What earlier screens in the real flow would have saved. The token is fake,
  // so authenticated API calls are rejected instead of changing data.
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('token', 'gallery-invalid-token');
  await prefs.setString(
    'cart',
    jsonEncode({
      '_id': '000000000000000000000000',
      'cartName': _longCartName,
      'cartCity': 'Bangalore',
      'cartId': 'GE-BLR-000123',
      'address': '12th Main Road, Indiranagar',
      'isActive': true,
      'isOpen': true,
      'userId': 'gallery',
    }),
  );

  runApp(const _Gallery());
}

class _Gallery extends StatefulWidget {
  const _Gallery();

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  int _index = 0;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _announce();
    getApplicationSupportDirectory().then((dir) {
      final file = File('${dir.path}/gallery_index');
      _poll = Timer.periodic(const Duration(milliseconds: 300), (_) {
        final index = file.existsSync() ? int.tryParse(file.readAsStringSync().trim()) : null;
        if (index == null || index == _index || index < 0 || index >= _entries.length) return;
        FocusManager.instance.primaryFocus?.unfocus();
        setState(() => _index = index);
        _announce();
      });
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _announce() => debugPrint('GALLERY_SCREEN $_index ${_entries[_index].name}');

  @override
  Widget build(BuildContext context) {
    final entry = _entries[_index];
    // Fresh providers and app per screen, like opening it for the first time.
    return MultiProvider(
      key: ValueKey(_index),
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..loadToken()),
        ChangeNotifierProvider(
          create: (_) => CartProvider()
            ..loadCartId()
            ..loadCartDetails(),
        ),
        ChangeNotifierProvider(create: (_) => CartActivatedProvider()),
        ChangeNotifierProvider(create: (_) => MenuProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.current,
        onGenerateRoute: (settings) => MaterialPageRoute(
          settings: settings.name == '/'
              ? RouteSettings(name: '/', arguments: entry.arguments)
              : settings,
          // Navigating away from the screen lands on a blank page.
          builder: (_) => settings.name == '/' ? entry.build() : const Scaffold(),
        ),
      ),
    );
  }
}

class _EditSheetLauncher extends StatefulWidget {
  const _EditSheetLauncher();

  @override
  State<_EditSheetLauncher> createState() => _EditSheetLauncherState();
}

class _EditSheetLauncherState extends State<_EditSheetLauncher> {
  @override
  void initState() {
    super.initState();
    // Opened the same way MenuReviewScreen opens it.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => const EditMenuDialog(
          initialName: 'Masala Dosa',
          initialPrice: 60,
          initialIsVeg: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => const Scaffold();
}

class _Cards extends StatelessWidget {
  const _Cards();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                address: '42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
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
              name: 'Ghee Roast Paper Dosa with Extra Chutney and Sambar',
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
    );
  }
}
