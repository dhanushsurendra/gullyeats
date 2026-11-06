import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_theme.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

import 'fake_backend.dart';

/// Logical sizes from the responsive spec, plus landscape and keyboard checks.
class Device {
  final String name;
  final Size size;
  final double keyboard;
  final double textScale;
  final String locale;
  const Device(
    this.name,
    this.size, {
    this.keyboard = 0,
    this.textScale = 1,
    this.locale = 'en',
  });
}

const portraitDevices = [
  Device('small_320x568', Size(320, 568)),
  Device('compact_360x800', Size(360, 800)),
  Device('standard_375x812', Size(375, 812)),
  Device('modern_393x852', Size(393, 852)),
  Device('large_430x932', Size(430, 932)),
  Device('tablet_600x960', Size(600, 960)),
];

const landscapeDevices = [
  Device('landscape_812x375', Size(812, 375)),
  Device('landscape_tablet_960x600', Size(960, 600)),
];

// Typical soft-keyboard height on a phone.
// Phone accessibility text sizes: 1.3 is Android's "Largest" / iOS's largest
// standard size, 1.5 is a common accessibility setting.
final largeTextDevices = [
  for (final scale in [1.3, 1.5])
    for (final d in portraitDevices)
      Device('text${scale}_${d.name}', d.size, textScale: scale),
];

/// Devices that also get a golden (reference screenshot) comparison. A subset,
/// to keep the repo small; every device still runs the layout-error checks.
const goldenDeviceNames = {
  'small_320x568',
  'standard_375x812',
  'tablet_600x960',
  'text1.5_small_320x568',
};

/// The translations are often longer than English; the longest-looking ones
/// on the smallest phone, at normal and large text.
final localeDevices = [
  for (final locale in ['kn', 'ta'])
    for (final scale in [1.0, 1.3])
      Device('${locale}_text${scale}_small_320x568', Size(320, 568), locale: locale, textScale: scale),
];

const keyboardDevices = [
  Device('keyboard_320x568', Size(320, 568), keyboard: 260),
  Device('keyboard_393x852', Size(393, 852), keyboard: 300),
];

/// Screenshots are written only when run with `--dart-define=SHOTS=<dir>`.
const shotsDir = String.fromEnvironment('SHOTS');

bool _fontsLoaded = false;

/// Loads the real fonts so text measures like it does on a device
/// (the test default, Ahem, draws every glyph as a 1em square).
Future<void> loadFonts() async {
  if (_fontsLoaded) return;
  _fontsLoaded = true;

  final poppins = FontLoader('Poppins');
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    poppins.addFont(rootBundle.load('assets/fonts/Poppins-$w.ttf'));
  }
  await poppins.load();

  final fonts =
      '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts';
  final roboto = FontLoader('Roboto');
  for (final w in ['regular', 'medium', 'bold']) {
    final bytes = File('$fonts/roboto-$w.ttf').readAsBytesSync();
    roboto.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await roboto.load();

  // Kannada, Tamil and Hindi glyphs, so translated screens measure like a
  // phone's system font fallback instead of drawing boxes. Windows only.
  final nirmala = File('C:/Windows/Fonts/Nirmala.ttc');
  if (nirmala.existsSync()) {
    final bytes = nirmala.readAsBytesSync();
    await (FontLoader('Nirmala')..addFont(Future.value(ByteData.view(bytes.buffer)))).load();
  }

  await (FontLoader(
    'MaterialIcons',
  )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  await (FontLoader('packages/cupertino_icons/CupertinoIcons')..addFont(
        rootBundle.load('packages/cupertino_icons/assets/CupertinoIcons.ttf'),
      ))
      .load();
}

/// Providers wired the same way as main.dart.
class TestProviders {
  final order = OrderProvider();
  final menu = MenuProvider();
  final auth = AuthProvider();
  final cart = CartProvider();
  final profile = ProfileProvider();
  final staff = StaffProvider();
  final payment = PaymentProvider();
  final language = LanguageProvider();
}

ThemeData _withIndicFallback(ThemeData theme) {
  const fallback = ['Nirmala'];
  final buttonText = WidgetStatePropertyAll(
    AppTextStyles.button.copyWith(fontFamilyFallback: fallback),
  );
  return theme.copyWith(
    textTheme: theme.textTheme.apply(fontFamilyFallback: fallback),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: (theme.elevatedButtonTheme.style ?? const ButtonStyle()).copyWith(textStyle: buttonText),
    ),
    textButtonTheme: TextButtonThemeData(style: ButtonStyle(textStyle: buttonText)),
    outlinedButtonTheme: OutlinedButtonThemeData(style: ButtonStyle(textStyle: buttonText)),
  );
}

Widget buildApp(
  TestProviders p,
  Widget screen, {
  Object? arguments,
  String locale = 'en',
  List<NavigatorObserver> navigatorObservers = const [],
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: p.order),
      ChangeNotifierProvider.value(value: p.menu),
      ChangeNotifierProvider.value(value: p.auth),
      ChangeNotifierProvider.value(value: p.cart),
      ChangeNotifierProvider.value(value: p.profile),
      ChangeNotifierProvider.value(value: p.staff),
      ChangeNotifierProvider.value(value: p.payment),
      ChangeNotifierProvider.value(value: p.language),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      // Nirmala (loaded in loadFonts) stands in for the phone's fallback font.
      theme: _withIndicFallback(AppTheme.lightTheme),
      locale: Locale(locale),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      navigatorObservers: navigatorObservers,
      onGenerateRoute: (settings) => MaterialPageRoute(
        settings: settings.name == '/'
            ? RouteSettings(name: '/', arguments: arguments)
            : settings,
        // Any navigation away from the screen under test lands on a blank page.
        builder: (_) => settings.name == '/' ? screen : const Scaffold(),
      ),
    ),
  );
}

/// Pumps [app] at [device], waits for images, compares it with its golden (for
/// [goldenDeviceNames]), optionally saves a screenshot, and returns every
/// layout error (overflows, unbounded constraints) raised while rendering.
Future<List<String>> renderAt(
  WidgetTester tester,
  Device device,
  Widget app, {
  required String screenName,
  Future<void> Function(WidgetTester tester)? interact,
}) async {
  final errors = <String>[];
  final previousOnError = FlutterError.onError;
  FlutterError.onError = (details) => errors.add(details.exceptionAsString());

  try {
    tester.view.devicePixelRatio = 2;
    tester.view.physicalSize = device.size * 2;
    // Status bar on top, gesture bar at the bottom (in physical pixels).
    tester.view.padding = const FakeViewPadding(top: 48, bottom: 32);
    tester.view.viewInsets = FakeViewPadding(bottom: device.keyboard * 2);
    tester.platformDispatcher.textScaleFactorTestValue = device.textScale;

    // Requests made while the screen loads get the sample data.
    await http.runWithClient(() async {
      await tester.pumpWidget(app);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      if (interact != null) await interact(tester);
      await tester.pump(const Duration(milliseconds: 300));
    }, () => fakeBackend);

    await tester.runAsync(() async {
      for (final element in find.byType(Image).evaluate().toList()) {
        await precacheImage(
          (element.widget as Image).image,
          element,
          onError: (_, _) {},
        );
      }
    });
    await tester.pump(const Duration(milliseconds: 300));

    if (goldenDeviceNames.contains(device.name)) {
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/$screenName/${device.name}.png'),
      );
    }

    if (shotsDir.isNotEmpty) {
      await tester.runAsync(() async {
        final image = await captureImage(
          find.byType(MaterialApp).evaluate().single,
        );
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File('$shotsDir/$screenName/${device.name}.png');
        await file.create(recursive: true);
        await file.writeAsBytes(png!.buffer.asUint8List());
      });
    }

    // Unmount so screen timers and animations are disposed before the test ends.
    await tester.pumpWidget(const SizedBox());
    // Long enough for screen timeouts (e.g. the 12s map style load) to fire.
    await tester.pump(const Duration(seconds: 15));
  } finally {
    FlutterError.onError = previousOnError;
    tester.view.reset();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  }
  return errors;
}
