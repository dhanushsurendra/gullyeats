import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<AuthProvider> pumpApp(WidgetTester tester, Map<String, Object> prefs) async {
  SharedPreferences.setMockInitialValues(prefs);
  final auth = AuthProvider();
  await auth.loadToken();

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => MenuProvider()),
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProfileProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
        ChangeNotifierProvider(create: (_) => PaymentProvider()),
      ],
      child: MaterialApp(
        navigatorKey: navigatorKey,
        routes: {AppRoutes.login: (_) => const Text('LOGIN')},
        home: const Text('HOME'),
      ),
    ),
  );
  return auth;
}

void main() {
  testWidgets('a 401 with a saved session logs out to the login screen', (tester) async {
    final auth = await pumpApp(tester, {'token': 'old', 'user': '{}'});

    final message = AppExceptionHandler.getMessage(ApiException('Invalid or expired token', 401));
    await tester.pumpAndSettle();

    expect(message, contains('expired'));
    expect(find.text('LOGIN'), findsOneWidget);
    expect(auth.token, isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('token'), isNull);
  });

  testWidgets('a failed login (no session) stays put', (tester) async {
    await pumpApp(tester, {});

    AppExceptionHandler.getMessage(ApiException('Invalid credentials', 401));
    await tester.pumpAndSettle();

    expect(find.text('HOME'), findsOneWidget);
  });
}
