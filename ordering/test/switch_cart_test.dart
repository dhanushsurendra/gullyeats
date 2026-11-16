import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/fake_backend.dart';

/// A screen with the cart switcher (like Orders overview or Sales), and the
/// welcome screen it may go to.
Future<CartProvider> _open(WidgetTester tester, {required bool stay}) async {
  // A tall phone window, so the sheet's pinned button doesn't cover the cart rows.
  tester.view.physicalSize = const Size(1080, 3600);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({
    'token': 't',
    'user': jsonEncode({'id': 'u1', 'role': 'vendor'}),
  });
  final carts = CartProvider();
  await carts.selectCart(CartModel.fromJson(cartJson));
  await http.runWithClient(() => carts.loadCarts('t', 'u1'), () => fakeBackend);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider.value(value: carts),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routes: {AppRoutes.welcome: (_) => const Text('WELCOME SCREEN')},
        home: Scaffold(
          body: Column(
            children: [
              const Text('OVERVIEW SCREEN'),
              CartSelector(stayOnScreen: stay),
            ],
          ),
        ),
      ),
    ),
  );
  return carts;
}

Future<void> _switchToJuiceCorner(WidgetTester tester) async {
  await http.runWithClient(() async {
    await tester.tap(find.byType(CartSelector));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Juice Corner'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SWITCH CART'));
    await tester.pumpAndSettle();
  }, () => fakeBackend);
}

void main() {
  testWidgets(
    'switching from a screen stays on that screen with the new cart',
    (tester) async {
      final carts = await _open(tester, stay: true);
      await _switchToJuiceCorner(tester);

      expect(carts.selectedCart?.id, 'c2');
      expect(find.text('OVERVIEW SCREEN'), findsOneWidget);
      expect(find.text('WELCOME SCREEN'), findsNothing);
      expect(
        find.text('SWITCH CART'),
        findsNothing,
        reason: 'the sheet closed',
      );
    },
  );

  testWidgets('switching from Orders goes through the welcome screen', (
    tester,
  ) async {
    final carts = await _open(tester, stay: false);
    await _switchToJuiceCorner(tester);

    expect(carts.selectedCart?.id, 'c2');
    expect(find.text('WELCOME SCREEN'), findsOneWidget);
    expect(
      find.text('OVERVIEW SCREEN'),
      findsNothing,
      reason: 'nothing old underneath',
    );
  });
}
