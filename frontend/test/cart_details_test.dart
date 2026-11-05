import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/screens/cart_details_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

final _cartJson = {
  '_id': 'c1',
  'cartName': 'Dosa Point',
  'cartCity': 'Bangalore',
  'cartId': 'CRT-1',
};

/// Records each request and answers like the backend's cart endpoints.
MockClient _backend(List<String> requests) => MockClient((request) async {
  requests.add('${request.method} ${request.url.path}');
  return switch (request.method) {
    'POST' => http.Response(jsonEncode({'cart': _cartJson}), 201),
    'PUT' => http.Response(jsonEncode({'cart': _cartJson}), 200),
    _ => http.Response('{}', 404),
  };
});

void _phoneSize(WidgetTester tester) {
  tester.view.physicalSize = const Size(393, 852);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> _fillAndContinue(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField), 'Dosa Point');
  await tester.pump();
  if (find.text('Select City').evaluate().isNotEmpty) {
    await tester.tap(find.text('Select City'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bangalore').last);
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text('CONTINUE'));
  await tester.pump();
  await tester.pump(const Duration(seconds: 1)); // snackbar delay, then navigation
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({'token': 't'}));

  testWidgets('going back from the photo step and continuing updates the cart',
      (tester) async {
    _phoneSize(tester);
    final requests = <String>[];
    await http.runWithClient(() async {
      final providers = TestProviders();
      await providers.auth.loadToken();
      await tester.pumpWidget(buildApp(providers, const CartDetailsScreen()));

      await _fillAndContinue(tester);
      expect(find.text('Cart Details'), findsNothing); // on the photo step

      await tester.binding.handlePopRoute();
      await tester.pump(const Duration(seconds: 4)); // let the snackbar close
      await tester.pumpAndSettle();
      await _fillAndContinue(tester);
    }, () => _backend(requests));

    expect(requests, [
      'POST /api/carts/create-basic-cart',
      'PUT /api/carts/update-cart/c1',
    ]);
  });

  testWidgets('opening an existing cart prefills it and updates on continue',
      (tester) async {
    _phoneSize(tester);
    final requests = <String>[];
    await http.runWithClient(() async {
      final providers = TestProviders();
      await providers.auth.loadToken();
      await tester.pumpWidget(buildApp(
        providers,
        const CartDetailsScreen(),
        arguments: CartModel.fromJson(_cartJson),
      ));
      await tester.pump();
      expect(find.text('Dosa Point'), findsOneWidget);
      expect(find.text('Bangalore'), findsOneWidget);

      await _fillAndContinue(tester);
    }, () => _backend(requests));

    expect(requests, ['PUT /api/carts/update-cart/c1']);
  });
}
