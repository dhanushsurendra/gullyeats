import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_theme.dart';
import 'package:gullyeats/features/activation/screens/qr_poster_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

final _navigator = GlobalKey<NavigatorState>();

/// Your Carts → (some onboarding step) → QR poster, like the real flow.
Future<void> _openPoster(WidgetTester tester) async {
  tester.view.physicalSize = const Size(393, 852);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final p = TestProviders();
  await p.cart.loadCartId();
  await p.cart.loadCartDetails();
  await tester.pumpWidget(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: p.auth),
      ChangeNotifierProvider.value(value: p.cart),
      ChangeNotifierProvider.value(value: p.activated),
    ],
    child: MaterialApp(
      navigatorKey: _navigator,
      theme: AppTheme.current,
      initialRoute: AppRoutes.carts,
      routes: {
        AppRoutes.carts: (_) => const Scaffold(body: Text('OUTLETS')),
        AppRoutes.cartActivated: (_) => const Scaffold(body: Text('ACTIVATED')),
        AppRoutes.qrPoster: (_) => const QrPosterScreen(),
      },
    ),
  ));
  _navigator.currentState!.pushNamed(AppRoutes.cartActivated);
  _navigator.currentState!.pushNamed(AppRoutes.qrPoster);
  await tester.pumpAndSettle();
}

/// Fakes the file and share-sheet plugins so sharing succeeds in a test.
void _fakeSharePlugins() {
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/path_provider'),
    (_) async => Directory.systemTemp.path,
  );
  messenger.setMockMethodCallHandler(
    const MethodChannel('dev.fluttercommunity.plus/share'),
    (_) async => 'dev.fluttercommunity.plus/share/success',
  );
}

Future<void> _share(WidgetTester tester) async {
  await tester.runAsync(() async {
    await tester.tap(find.text('SHARE QR'));
    // Capturing the poster and writing the PDF need real async time.
    for (var i = 0; i < 20 && find.text('BACK TO OUTLETS').evaluate().isEmpty; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      await tester.pump();
    }
  });
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'cart': jsonEncode({'_id': 'c1', 'cartName': 'Dosa Point', 'cartId': 'CRT-1'}),
    });
    _fakeSharePlugins();
  });

  testWidgets('before sharing, back returns to the previous step', (tester) async {
    await _openPoster(tester);
    expect(find.text('BACK TO OUTLETS'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('ACTIVATED'), findsOneWidget);
  });

  testWidgets('after sharing, the new button goes straight to Your Carts', (tester) async {
    await _openPoster(tester);
    await _share(tester);

    await tester.tap(find.text('BACK TO OUTLETS'));
    await tester.pumpAndSettle();
    expect(find.text('OUTLETS'), findsOneWidget);
  });

  testWidgets('after sharing, system back also goes to Your Carts', (tester) async {
    await _openPoster(tester);
    await _share(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('OUTLETS'), findsOneWidget);
    expect(find.text('ACTIVATED'), findsNothing);
  });
}
