import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ordering/app/home/home_screen.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/payment/presentation/payment_lock_screen.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/fake_backend.dart';
import 'responsive/harness.dart';

Map<String, dynamic> _status({bool locked = false, num pending = 0, bool canPay = false}) => {
  'isLocked': locked,
  'totalOrders': 3,
  'totalPending': pending,
  'canPay': canPay,
  'dueAt': DateTime.now().add(const Duration(hours: 2)).toUtc().toIso8601String(),
  'cartName': longCartName,
  'address': '',
};

/// The fake backend, with the payment status replaced by [status].
MockClient _backend(Map<String, dynamic> Function() status) => MockClient((request) async {
  if (request.url.path.contains('/payments/payment-status/')) {
    return http.Response(jsonEncode(status()), 200, headers: {'content-type': 'application/json'});
  }
  return fakeBackend.get(request.url, headers: request.headers);
});

Future<TestProviders> _session({bool staff = false}) async {
  SharedPreferences.setMockInitialValues({
    'token': 't',
    'user': jsonEncode({
      'id': 'u1',
      'userId': staff ? 'STF-AB12CD' : 'VEN-AB12CD',
      'role': staff ? 'staff' : 'vendor',
      'name': 'Ramesh',
    }),
    'selected_cart': jsonEncode(cartJson),
  });
  final p = TestProviders();
  await p.auth.loadToken();
  await p.auth.loadUser();
  await p.cart.loadSelectedCart();
  return p;
}

Widget _app(TestProviders p, Widget home) => MultiProvider(
  providers: [
    ChangeNotifierProvider.value(value: p.order),
    ChangeNotifierProvider.value(value: p.menu),
    ChangeNotifierProvider.value(value: p.auth),
    ChangeNotifierProvider.value(value: p.cart),
    ChangeNotifierProvider.value(value: p.profile),
    ChangeNotifierProvider.value(value: p.staff),
    ChangeNotifierProvider.value(value: p.payment),
    ChangeNotifierProvider.value(value: p.theme),
    ChangeNotifierProvider.value(value: p.language),
  ],
  child: MaterialApp(
    navigatorKey: navigatorKey,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routes: {AppRoutes.paymentLockScreen: (_) => const Scaffold(body: Text('LOCK SCREEN'))},
    home: home,
  ),
);

void main() {
  setUpAll(() {
    OrderProvider.liveUpdates = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('razorpay_flutter'), (_) async => null);
  });

  // The home screen checks every 10 minutes; unmount so the timer stops.
  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
  }

  testWidgets('during the day, the running fee shows no warning', (tester) async {
    final p = await _session();
    await http.runWithClient(() async {
      await tester.pumpWidget(_app(p, const HomeScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
    }, () => _backend(() => _status(pending: 6, canPay: false)));

    expect(find.textContaining('locks at'), findsNothing);
    await unmount(tester);
  });

  testWidgets('after midnight, before the lock, a warning offers Pay now', (tester) async {
    final p = await _session();
    await http.runWithClient(() async {
      await tester.pumpWidget(_app(p, const HomeScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
    }, () => _backend(() => _status(pending: 6, canPay: true)));

    expect(find.textContaining('Pay ₹6 now'), findsOneWidget);
    expect(find.text('PAY NOW'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('staff see the warning but no Pay now', (tester) async {
    final p = await _session(staff: true);
    await http.runWithClient(() async {
      await tester.pumpWidget(_app(p, const HomeScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
    }, () => _backend(() => _status(pending: 6, canPay: true)));

    expect(find.textContaining('Pay ₹6 now'), findsOneWidget);
    expect(find.text('PAY NOW'), findsNothing);
    await unmount(tester);
  });

  testWidgets('a cart that becomes locked while open goes to the lock screen on resume', (tester) async {
    final p = await _session();
    var locked = false;
    await http.runWithClient(() async {
      await tester.pumpWidget(_app(p, const HomeScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('LOCK SCREEN'), findsNothing);

      locked = true;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
    }, () => _backend(() => _status(locked: locked, pending: 6, canPay: true)));

    expect(find.text('LOCK SCREEN'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('staff on the lock screen are told to ask the owner', (tester) async {
    final p = await _session(staff: true);
    await tester.pumpWidget(_app(
      p,
      const PaymentLockScreen(cartName: longCartName, platformFee: 6, amountDue: 6),
    ));
    await tester.pump();

    expect(find.textContaining('Ask the cart owner'), findsOneWidget);
    expect(find.textContaining('UNLOCK NOW'), findsNothing);
  });
}
