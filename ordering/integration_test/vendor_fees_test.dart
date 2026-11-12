// FLT-VEN device tests, part 5: the platform-fee lock and a Razorpay test
// payment. Needs watch.sh (BACKDATE gives the cart an unpaid past-day bill; NET-OFF / NET-ON)
// and the backend on Razorpay TEST keys. When the test prints
// ">>> RAZORPAY FAIL" / ">>> RAZORPAY PAY", watch.sh runs razorpay.sh (or a person) to complete
// Razorpay's checkout: FAIL = card 4100 2800 0007 0002 and pick Failure on
// the bank page; PAY = card 4100 2800 0000 1007, any CVV, a future expiry,
// any 4-10 digit OTP. Test cards: razorpay.com/docs/payments/payments/test-card-details
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'qa.dart';

Future<Map<String, dynamic>> _status(Map<String, dynamic> v) =>
    api('GET', '/payments/payment-status/${v['cartId']}', token: v['token'] as String);

/// Waits (without pumping: Razorpay's own screen is in front) until the app is
/// back and [done] shows, for up to [minutes].
Future<void> _afterCheckout(WidgetTester tester, Finder done, {int minutes = 6}) async {
  final end = DateTime.now().add(Duration(minutes: minutes));
  while (DateTime.now().isBefore(end)) {
    await Future<void>.delayed(const Duration(seconds: 2));
    if (WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) continue;
    await tester.pump(const Duration(milliseconds: 200));
    if (done.evaluate().isNotEmpty) return;
  }
  fail('Checkout not finished in $minutes min. On screen: ${onScreen()}');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN fee lock, locked new order, Razorpay fail then pay', (tester) async {
    final v = await onboard(realPhone: true); // Razorpay only prefills a valid number
    final token = v['token'] as String;
    final o = await customerOrder(v);
    await api('PUT', '/orders/mark-order-paid/${o['_id']}', token: token);

    // An unpaid bill from two days ago locks the cart.
    say('BACKDATE ${v['cartId']} 2');
    Map<String, dynamic> s = {};
    for (var i = 0; i < 60 && s['isLocked'] != true; i++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      s = await _status(v);
    }
    expect(s['isLocked'], true, reason: 'cart should lock after BACKDATE: $s');
    final due = s['totalPending'] as num;
    expect(due, o['platformFee']);

    // FLT-VEN-064: the server refuses a new order on the locked cart with the lock status.
    final locked = await api('POST', '/orders/create-order', token: token, body: {
      'cartId': v['cartId'],
      'orderItems': [
        {'menuItemId': (v['menu'] as List)[0]['_id'], 'quantity': 1},
      ],
    });
    expect(locked['status'], 403, reason: '${locked['message']}');

    // FLT-VEN-028 on a phone: logging in to a locked cart opens the lock screen.
    await startApp(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), v['phone'] as String);
    await tester.enterText(fields.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.tap(find.text('LOGIN'));
    await waitFor(tester, find.text(v['cartName'] as String));
    await idle(tester);
    await waitFor(tester, find.text(v['cartName'] as String));
    await tester.tap(find.text(v['cartName'] as String).first);
    await waitFor(tester, find.text('Platform Fee Pending'), seconds: 40);
    final pay = find.text('PAY ₹${due.round()} & UNLOCK NOW');
    expect(pay, findsOneWidget, reason: onScreen());

    // FLT-VEN-101: no backend when PAY is tapped: a message, no gateway, still locked.
    await netOff(tester);
    await tester.tap(pay);
    await waitFor(tester, find.byWidgetPredicate((w) => w is Text &&
        ((w.data ?? '').contains('internet') || w.data == 'Unable to start payment. Please try again.')), seconds: 30);
    expect(WidgetsBinding.instance.lifecycleState, AppLifecycleState.resumed, reason: 'Razorpay must not open');
    await netOn(tester);
    await noSnackBar(tester);
    await waitFor(tester, pay);

    // FLT-VEN-097: a failed payment: a message, still locked.
    await tester.tap(pay);
    await idle(tester, ms: 500);
    say('RAZORPAY FAIL');
    await _afterCheckout(tester, find.text('Payment failed. You can retry using the same payment.'));
    expect((await _status(v))['isLocked'], true);
    await noSnackBar(tester);

    // FLT-VEN-030: the test card pays the bill and unlocks the cart.
    await waitFor(tester, pay);
    await tester.tap(pay);
    await idle(tester, ms: 500);
    say('RAZORPAY PAY');
    await _afterCheckout(tester, find.text('Payment done!'));
    expect((await _status(v))['isLocked'], false);
    final history = await api('GET', '/payments/payment-history/${v['cartId']}', token: token);
    expect('$history', contains('VERIFIED'));
    await idle(tester, ms: 3000);
  });
}
