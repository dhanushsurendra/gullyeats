import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/theme/app_theme.dart';
import 'package:gullyeats/features/activation/providers/activation_provider.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/menu/providers/menu_provider.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:gullyeats/features/staff_management/providers/staff_provider.dart';
import 'package:provider/provider.dart';

/// Logical sizes from the responsive spec, plus landscape and keyboard checks.
class Device {
  final String name;
  final Size size;
  final double keyboard;
  final double textScale;
  const Device(this.name, this.size, {this.keyboard = 0, this.textScale = 1});
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
  final auth = AuthProvider();
  final cart = CartProvider();
  final activated = CartActivatedProvider();
  final menu = MenuProvider();
  final staff = StaffProvider();
}

Widget buildApp(TestProviders p, Widget screen, {Object? arguments}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: p.auth),
      ChangeNotifierProvider.value(value: p.cart),
      ChangeNotifierProvider.value(value: p.activated),
      ChangeNotifierProvider.value(value: p.menu),
      ChangeNotifierProvider.value(value: p.staff),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
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

    await tester.pumpWidget(app);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    if (interact != null) await interact(tester);

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
