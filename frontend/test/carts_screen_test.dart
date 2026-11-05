import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/onboarding/screens/carts_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({'token': 'vendor-token'}));

  Future<List<http.Request>> openAndSendCredentials(
    WidgetTester tester, {
    required String choice,
  }) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final requests = <http.Request>[];
    await http.runWithClient(() async {
      final providers = TestProviders();
      await providers.auth.loadToken();
      await tester.pumpWidget(buildApp(
        providers,
        const CartsScreen(),
        arguments: {'userId': 'u1', 'phoneNumber': '9876543210'},
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Send Credentials'));
      await tester.pumpAndSettle();
      expect(find.text('Send new login PIN?'), findsOneWidget);

      await tester.tap(find.text(choice));
      await tester.pumpAndSettle();
    }, () => MockClient((request) async {
      requests.add(request);
      return request.url.path.endsWith('/reset-pin')
          ? http.Response(jsonEncode({'userId': 'VEN-AB12CD', 'pin': '4821'}), 200)
          : http.Response(jsonEncode({'carts': []}), 200);
    }));
    return requests;
  }

  testWidgets('Send Credentials asks first and does nothing on cancel', (tester) async {
    final requests = await openAndSendCredentials(tester, choice: 'Cancel');
    expect(requests.map((r) => r.url.path), isNot(contains('/api/vendors/reset-pin')));
  });

  testWidgets('Send Credentials issues a new PIN for the vendor', (tester) async {
    final requests = await openAndSendCredentials(tester, choice: 'Send');
    final reset = requests.singleWhere((r) => r.url.path == '/api/vendors/reset-pin');
    expect(reset.method, 'POST');
    expect(reset.headers['Authorization'], 'Bearer vendor-token');
  });
}
