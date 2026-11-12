// FLT-VEN device tests, part 6: serve rules, preparing, customer changes,
// editing an order, parcel charge, Active / suspended carts, two carts and a
// disabled vendor at login. Run like vendor_flow_test.dart (no watcher needed).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';

import 'qa.dart';

Future<Map<String, dynamic>> _order(Map<String, dynamic> v, String id) async =>
    (await api('GET', '/orders/order/$id', token: v['token'] as String))['data'] as Map<String, dynamic>;

Future<void> _until(WidgetTester tester, Future<bool> Function() ok, String what) async {
  for (var i = 0; i < 60; i++) {
    if (await ok()) return;
    await idle(tester, ms: 300);
  }
  fail('Server never showed: $what');
}

Future<void> _nav(WidgetTester tester, String tab) async {
  await noSnackBar(tester);
  await waitFor(tester, find.text(tab), seconds: 30);
  await tester.tap(find.text(tab).last);
  await idle(tester);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN orders and cart rules', (tester) async {
    final v = await onboard();
    final token = v['token'] as String;
    final c2 = await api('POST', '/carts/create-basic-cart',
        token: token, body: {'cartName': '${v['cartName']} Two', 'cartCity': 'Bengaluru'});
    final cart2 = (c2['cart'] as Map)['_id'] as String;
    await api('POST', '/carts/update-location/$cart2', token: token, body: {'address': 'QA Road', 'lat': 12.9, 'lng': 77.6});
    await api('POST', '/carts/create-menu/$cart2', token: token, body: {
      'items': [
        {'name': 'Vada Pav', 'price': 20, 'isVeg': true},
      ],
    });
    final a = await customerOrder(v); // Masala Dosa 60
    final b = await customerOrder(v, item: 1); // Pani Puri 30

    // FLT-VEN-044: the picker lists both carts; pick the first.
    await startApp(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), v['phone'] as String);
    await tester.enterText(fields.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.tap(find.text('LOGIN'));
    await waitFor(tester, find.text('${v['cartName']} Two'));
    expect(find.text(v['cartName'] as String), findsOneWidget);
    await idle(tester);
    await tester.tap(find.text(v['cartName'] as String));
    await idle(tester, ms: 300);
    await tester.tap(find.text('SWITCH CART')); // with several carts: pick, then confirm
    await waitFor(tester, find.text('#${a['orderNumber']}'), seconds: 30);

    // FLT-VEN-010: an unpaid order offers MARK PAID, never SERVE; the server refuses too.
    expect(find.byKey(const ValueKey('serve')), findsNothing);
    final early = await api('PUT', '/orders/serve-order/${a['_id']}', token: token);
    expect(early['status'], 400, reason: '${early['message']}');
    expect('${early['message']}'.toLowerCase(), contains('paid'));

    // FLT-VEN-058: the customer adds an item and cancels the other order; the cards follow live.
    final keyA = '${a['_id']}.${a['accessKey']}';
    final add = await api('PUT', '/orders/update-order/${a['_id']}', headers: {'X-Gully-Order': keyA}, body: {
      'orderItems': [
        {'menuItemId': (v['menu'] as List)[0]['_id'], 'quantity': 2},
      ],
    });
    expect(add['status'], 200, reason: '${add['message']}');
    final newTotal = (add['data'] as Map)['totalPrice'] as num;
    await waitFor(tester, find.text('₹${newTotal.round()}'));
    final cancel = await api('DELETE', '/orders/delete-order/${b['_id']}',
        headers: {'X-Gully-Order': '${b['_id']}.${b['accessKey']}'});
    expect(cancel['status'], 200, reason: '${cancel['message']}');
    for (var i = 0; i < 60 && find.text('#${b['orderNumber']}').evaluate().isNotEmpty; i++) {
      await idle(tester, ms: 250);
    }
    expect(find.text('#${b['orderNumber']}'), findsNothing, reason: 'a cancelled order leaves the Active tab');

    // FLT-VEN-012: mark paid, then Start preparing sets preparingAt.
    await tester.tap(find.byKey(const ValueKey('paid')).first);
    await _until(tester, () async => (await _order(v, a['_id'] as String))['status'] == 'PAID', 'PAID');
    await noSnackBar(tester);
    await waitFor(tester, find.text('Start preparing'));
    await tester.tap(find.text('Start preparing'));
    await _until(tester, () async => (await _order(v, a['_id'] as String))['preparingAt'] != null, 'preparingAt');
    await waitFor(tester, find.text('Preparing'));

    // FLT-VEN-056/057: edit the paid order up; the vendor is told to collect the difference.
    await noSnackBar(tester);
    await tester.tap(find.text('#${a['orderNumber']}'));
    await waitFor(tester, find.text('UPDATE ORDER'));
    await idle(tester);
    final sheet = find.byType(AddNewOrder);
    // Pani Puri is the second item; its + is the last add button in the sheet.
    await tester.tap(find.descendant(of: sheet, matching: find.byIcon(Icons.add)).last);
    await tester.pump();
    await waitFor(tester, find.text('Customer needs to pay ₹30 more'));
    await tester.tap(find.text('UPDATE ORDER'));
    await waitFor(tester, find.text('Collect ₹30 from customer'), seconds: 30);
    final edited = await _order(v, a['_id'] as String);
    expect(edited['totalPrice'], newTotal + 30);
    expect(edited['status'], 'PENDING', reason: 'partly paid: waits for the rest');

    // FLT-VEN-011: collect the rest, serve, then Undo returns it to PAID.
    await noSnackBar(tester);
    await tester.tap(find.byKey(const ValueKey('paid')).first);
    await _until(tester, () async => (await _order(v, a['_id'] as String))['status'] == 'PAID', 'PAID again');
    await noSnackBar(tester);
    await waitFor(tester, find.byKey(const ValueKey('serve')));
    await tester.tap(find.byKey(const ValueKey('serve')).first);
    await waitFor(tester, find.text('Order marked as served'));
    await idle(tester, ms: 500);
    await tester.tap(find.text('UNDO'));
    await waitFor(tester, find.text('Serve reverted'));
    await _until(tester, () async => (await _order(v, a['_id'] as String))['status'] == 'PAID', 'PAID after undo');

    // FLT-VEN-013: a manual order with a Rs 10 parcel charge.
    await noSnackBar(tester);
    await tester.tap(find.byIcon(Icons.add).first);
    await waitFor(tester, find.text('Create Order'));
    await idle(tester);
    await tester.tap(find.descendant(of: find.byType(AddNewOrder), matching: find.byIcon(Icons.add)).first);
    await tester.pump();
    final parcel = find.descendant(of: find.byType(AddNewOrder), matching: find.byType(TextField)).last;
    await tester.ensureVisible(parcel);
    await tester.enterText(parcel, '10');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester);
    await tester.ensureVisible(find.text('MARK AS PAID'));
    await tester.tap(find.text('MARK AS PAID'));
    await waitFor(tester, find.textContaining('Order created'));
    final today = (await api('GET', '/orders/orders-today/${v['cartId']}', token: token))['data'] as List;
    final manual = today.first as Map;
    expect(manual['parcelCharge'], 10);
    expect(manual['totalPrice'], 60 + 10 + (manual['platformFee'] as num));

    // FLT-VEN-084: Cart Active off (Edit cart) hides the cart: customers can't order.
    await _nav(tester, 'Profile');
    await waitFor(tester, find.byIcon(Icons.edit_outlined));
    await tester.tap(find.byIcon(Icons.edit_outlined));
    await waitFor(tester, find.text('Cart Active'));
    await tester.ensureVisible(find.text('Cart Active'));
    await idle(tester);
    await tester.tap(find.text('Cart Active'));
    await idle(tester);
    await tapText(tester, 'SAVE CHANGES');
    await waitFor(tester, find.text('Cart details updated!'));
    final hidden = await customerOrderRaw(v);
    expect(hidden['status'], 403, reason: '${hidden['message']}');
    await api('PUT', '/carts/update-cart/${v['cartId']}', token: token, body: {'isActive': true});

    // FLT-VEN-085: suspended by an admin: the open switch is refused with the reason.
    final admin = await adminToken();
    expect((await api('POST', '/admin/carts/${v['cartId']}/suspend', token: admin, body: {'reason': 'QA'}))['status'], 200);
    try {
      await waitFor(tester, find.text('Cart Details'));
      await noSnackBar(tester);
      // Pull the new state (closed by the suspend) by leaving and reopening Profile.
      await _nav(tester, 'Orders');
      await _nav(tester, 'Profile');
      await waitFor(tester, find.text('Closed'), seconds: 30);
      await tester.tap(find.byType(Switch).first);
      await waitFor(tester, find.textContaining('paused by GullyEats'));
      expect(await _cartOpen(v), false);
    } finally {
      await api('POST', '/admin/carts/${v['cartId']}/resume', token: admin);
    }

    // FLT-VEN-047/022: switch to the second cart from the cart selector.
    await noSnackBar(tester);
    await tester.tap(find.text(v['cartName'] as String).first);
    await waitFor(tester, find.text('SWITCH CART'));
    await idle(tester);
    await tester.tap(find.text('${v['cartName']} Two').last);
    await idle(tester, ms: 300);
    await tester.tap(find.text('SWITCH CART'));
    await idle(tester, ms: 4000); // switching goes through the welcome screen
    await _nav(tester, 'Orders');
    await waitFor(tester, find.text('No active orders'));
    expect(find.text('#${a['orderNumber']}'), findsNothing, reason: 'cart 1 orders must not show on cart 2');

    // FLT-VEN-039: a disabled vendor sees the reason at login.
    await _nav(tester, 'Profile');
    await tapText(tester, 'LOG OUT');
    await waitFor(tester, find.text('LOGIN'));
    expect((await api('POST', '/admin/owners/${v['userId']}/disable', token: admin))['status'], 200);
    try {
      final f = find.byType(TextField);
      await tester.enterText(f.at(0), v['phone'] as String);
      await tester.enterText(f.at(1), v['pin'] as String);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.tap(find.text('LOGIN'));
      await waitFor(tester, find.textContaining('disabled'), seconds: 30);
      expect(find.text('LOGIN'), findsOneWidget);
    } finally {
      await api('POST', '/admin/owners/${v['userId']}/enable', token: admin);
    }
    await idle(tester, ms: 2000);
  });
}

Future<bool> _cartOpen(Map<String, dynamic> v) async {
  final carts = await api('GET', '/carts/get-all-carts/${v['userId']}', token: v['token'] as String);
  return ((carts['carts'] as List).firstWhere((c) => c['_id'] == v['cartId']) as Map)['isOpen'] == true;
}
