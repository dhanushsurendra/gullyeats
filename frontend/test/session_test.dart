import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/features/onboarding/screens/carts_screen.dart';
import 'package:gullyeats/features/splash/presentation/splash_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

class _Pushes extends NavigatorObserver {
  final routes = <String?>[];
  Object? lastArguments;
  @override
  void didPush(Route route, Route? previousRoute) {
    routes.add(route.settings.name);
    lastArguments = route.settings.arguments;
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) => routes.add(newRoute?.settings.name);
}

MockClient _noCarts() => MockClient((_) async => http.Response(jsonEncode({'count': 0, 'carts': []}), 200));

void main() {
  testWidgets('a vendor still logged in opens on Your Carts, with sign-up underneath', (tester) async {
    SharedPreferences.setMockInitialValues({'token': 't', 'userId': 'u1', 'phoneNumber': '9876543210'});
    final pushes = _Pushes();
    final providers = TestProviders();
    await tester.pumpWidget(buildApp(providers, const SplashScreen(), navigatorObservers: [pushes]));
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    expect(pushes.routes, ['/', AppRoutes.signup, AppRoutes.carts]);
    expect(pushes.lastArguments, {'userId': 'u1', 'phoneNumber': '9876543210'});
    expect(providers.auth.token, 't');
  });

  testWidgets('with no saved login it opens on sign-up', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final pushes = _Pushes();
    await tester.pumpWidget(buildApp(TestProviders(), const SplashScreen(), navigatorObservers: [pushes]));
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    expect(pushes.routes, ['/', AppRoutes.signup]);
  });

  testWidgets('going back from Your Carts logs out, so reopening asks for the next vendor', (tester) async {
    SharedPreferences.setMockInitialValues({'token': 't', 'userId': 'u1', 'phoneNumber': '9876543210'});
    final providers = TestProviders();
    await providers.auth.loadToken();
    await http.runWithClient(() async {
      await tester.pumpWidget(buildApp(
        providers,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                settings: const RouteSettings(arguments: {'userId': 'u1', 'phoneNumber': '9876543210'}),
                builder: (_) => const CartsScreen(),
              ),
            ),
            child: const Text('open'),
          ),
        ),
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Your Carts'), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
    }, _noCarts);

    final prefs = await SharedPreferences.getInstance();
    expect(find.text('Your Carts'), findsNothing);
    expect(prefs.getString('token'), isNull);
    expect(prefs.getString('userId'), isNull);
    expect(providers.auth.token, isNull);
  });
}
