import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/utils/session.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<AuthProvider> _app(WidgetTester tester) async {
  final auth = AuthProvider();
  await auth.loadToken();
  await tester.pumpWidget(ChangeNotifierProvider.value(
    value: auth,
    child: MaterialApp(
      navigatorKey: navigatorKey,
      routes: {
        '/': (_) => const Text('Your Carts'),
        AppRoutes.signup: (_) => const Text('Sign up'),
      },
    ),
  ));
  return auth;
}

void main() {
  testWidgets('a 401 while logged in signs out to sign-up', (tester) async {
    SharedPreferences.setMockInitialValues({'token': 'old', 'userId': 'u1', 'phoneNumber': '9876543210'});
    final auth = await _app(tester);

    final message = AppExceptionHandler.getMessage(ApiException('Invalid or expired token', 401));
    await tester.pumpAndSettle();

    expect(message, 'Your login has expired. Please log in again.');
    expect(find.text('Sign up'), findsOneWidget);
    expect(find.text('Your Carts'), findsNothing);
    expect(auth.token, isNull);
    expect((await SharedPreferences.getInstance()).getString('token'), isNull);
  });

  testWidgets('a 401 with nobody logged in (a wrong PIN) just shows the message', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await _app(tester);

    final message = AppExceptionHandler.getMessage(ApiException('Invalid credentials', 401));
    await tester.pumpAndSettle();

    expect(message, 'Invalid credentials');
    expect(find.text('Your Carts'), findsOneWidget);
  });
}
