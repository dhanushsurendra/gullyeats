import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/features/auth/screens/pin_login_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

class _Pushes extends NavigatorObserver {
  final routes = <RouteSettings>[];
  @override
  void didPush(Route route, Route? previousRoute) => routes.add(route.settings);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('PIN login opens the vendor\'s outlets', (tester) async {
    final pushes = _Pushes();
    Map<String, dynamic>? sent;
    final providers = TestProviders();

    await http.runWithClient(() async {
      await tester.pumpWidget(
        buildApp(providers, const PinLoginScreen(), navigatorObservers: [pushes]),
      );
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'VEN-AB12CD');
      await tester.enterText(fields.at(1), '1234');
      await tester.tap(find.text('LOG IN'));
      await tester.pumpAndSettle();
    }, () => MockClient((request) async {
      sent = jsonDecode(request.body);
      return http.Response(
        jsonEncode({
          'token': 'tok',
          'user': {'id': 'u1', 'userId': 'VEN-AB12CD', 'phoneNumber': '9876543210'},
        }),
        200,
      );
    }));

    expect(sent, {'vendorIdentifier': 'VEN-AB12CD', 'pin': '1234'});
    expect(providers.auth.token, 'tok');
    expect(pushes.routes.last.name, AppRoutes.carts);
    expect(pushes.routes.last.arguments, {'userId': 'u1', 'phoneNumber': '9876543210'});
  });

  testWidgets('a wrong PIN shows the server message', (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(buildApp(TestProviders(), const PinLoginScreen()));
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), '9876543210');
      await tester.enterText(fields.at(1), '0000');
      await tester.tap(find.text('LOG IN'));
      await tester.pumpAndSettle();
    }, () => MockClient((_) async => http.Response(
          jsonEncode({'success': false, 'message': 'Invalid credentials'}),
          401,
        )));

    expect(find.text('Invalid credentials'), findsOneWidget);
    expect(find.text('LOG IN'), findsOneWidget);
  });
}
