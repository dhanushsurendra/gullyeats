// FLT-VEN device tests, part 2: login checks, manual orders, delete/undo,
// tabs and stock. Run like vendor_flow_test.dart.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';

import 'qa.dart';

Future<List<Map<String, dynamic>>> _todayOrders(Map<String, dynamic> v) async =>
    ((await api('GET', '/orders/orders-today/${v['cartId']}', token: v['token'] as String))['data'] as List)
        .cast<Map<String, dynamic>>();

/// Waits until the server has the order in [status].
Future<void> _serverStatus(WidgetTester tester, Map<String, dynamic> v, String id, String status) async {
  for (var i = 0; i < 40 && await orderStatus(v, id) != status; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
  expect(await orderStatus(v, id), status);
}

/// Opens the + sheet, adds the menu item at [item], and taps [button].
Future<Map<String, dynamic>> _manualOrder(WidgetTester tester, Map<String, dynamic> v, int item, String button) async {
  final before = (await _todayOrders(v)).length;
  await noSnackBar(tester); // a snackbar covers the + button
  await tester.tap(find.byIcon(Icons.add).first);
  await waitFor(tester, find.text('Create Order'));
  await idle(tester);
  await tester.tap(find.descendant(of: find.byType(AddNewOrder), matching: find.byIcon(Icons.add)).at(item));
  await tester.pump();
  await tester.tap(find.text(button));
  await waitFor(tester, find.textContaining('Order created'));
  await idle(tester);
  final orders = await _todayOrders(v);
  expect(orders.length, before + 1);
  return orders.first; // newest first
}

/// Taps an Orders tab, scrolling the tab row to it first (it scrolls on small phones).
Future<void> _tab(WidgetTester tester, String label) async {
  final tab = find.text(label).first;
  await tester.ensureVisible(tab);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(tab);
  await tester.pump();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN login checks, manual orders, delete/undo, tabs, stock', (tester) async {
    final v = await onboard();
    await startApp(tester);
    final fields = find.byType(TextField);

    // FLT-VEN-038: empty ID and a short PIN are caught on the phone.
    await tester.tap(find.text('LOGIN'));
    await tester.pump();
    expect(find.text('Vendor ID or Mobile Number is required'), findsOneWidget);
    expect(find.text('Please enter a 4-digit PIN'), findsOneWidget);
    await tester.enterText(fields.at(0), v['phone'] as String);
    await tester.enterText(fields.at(1), '12');
    await tester.tap(find.text('LOGIN'));
    await tester.pump();
    expect(find.text('Please enter a 4-digit PIN'), findsOneWidget);

    // FLT-VEN-004: a wrong PIN stays on login.
    final wrong = v['pin'] == '0000' ? '1111' : '0000';
    await tester.enterText(fields.at(1), wrong);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.tap(find.text('LOGIN'));
    await idle(tester, ms: 3000);
    expect(find.text('LOGIN'), findsOneWidget);
    expect(find.text(v['cartName'] as String), findsNothing);
    await idle(tester, ms: 3000); // let the error snackbar go

    // FLT-VEN-037: log in with the Vendor ID instead of the phone.
    await login(tester, v, id: v['vendorId'] as String, start: false);

    // FLT-VEN-049: empty tabs on a fresh cart.
    await waitFor(tester, find.text('No active orders')); // opens on Active
    await _tab(tester, 'QR Orders');
    await waitFor(tester, find.text('No QR orders today'));
    await _tab(tester, 'Manual');
    await waitFor(tester, find.text('No manual orders today'));
    await _tab(tester, 'All');
    await waitFor(tester, find.text('No orders today'));

    // FLT-VEN-061: manual orders, as paid and as unpaid. Total = items + Rs 2 fee.
    await _tab(tester, 'All');
    await tester.pump();
    final paid = await _manualOrder(tester, v, 0, 'MARK AS PAID');
    expect(paid['status'], 'PAID');
    expect(paid['isQrOrder'], isNot(true));
    final unpaid = await _manualOrder(tester, v, 1, 'SKIP');
    expect(unpaid['status'], 'PENDING');
    expect(unpaid['totalPrice'], 30 + (unpaid['platformFee'] as num));
    await waitFor(tester, find.text('#${unpaid['orderNumber']}'));

    // A QR order so the tabs have both kinds (FLT-VEN-048).
    final qr = await customerOrder(v);
    await waitFor(tester, find.text('#${qr['orderNumber']}'));
    await _tab(tester, 'QR Orders');
    await idle(tester);
    expect(find.text('#${qr['orderNumber']}'), findsOneWidget);
    expect(find.text('#${unpaid['orderNumber']}'), findsNothing);
    await _tab(tester, 'Manual');
    await idle(tester);
    expect(find.text('#${unpaid['orderNumber']}'), findsOneWidget);
    expect(find.text('#${qr['orderNumber']}'), findsNothing);
    await _tab(tester, 'All');
    await idle(tester);

    // FLT-VEN-054: delete asks first; Cancel keeps it, Delete cancels it.
    // The QR order is the newest, so its card (and delete button) is first.
    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await waitFor(tester, find.text('Are you sure you want to delete this order?'));
    await tester.tap(find.text('Cancel'));
    await idle(tester);
    expect(await orderStatus(v, qr['_id'] as String), 'PENDING');
    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await waitFor(tester, find.text('Delete'));
    await tester.tap(find.text('Delete'));
    await waitFor(tester, find.text('Order cancelled'));
    // Shown only after the server answered, and gone in 3 s: check once, then undo.
    expect(await orderStatus(v, qr['_id'] as String), 'CANCELLED');

    // FLT-VEN-016/055: undo the cancel from the snackbar.
    await idle(tester, ms: 500); // snackbar slides in
    await tester.tap(find.text('UNDO'));
    await waitFor(tester, find.text('Order restored'));
    await _serverStatus(tester, v, qr['_id'] as String, 'PENDING');
    await idle(tester, ms: 4000);

    // FLT-VEN-009/055: mark paid, then undo returns it to PENDING.
    await tester.tap(find.byKey(const ValueKey('paid')).first);
    await waitFor(tester, find.text('Order marked as paid'));
    expect(await orderStatus(v, qr['_id'] as String), 'PAID');
    await idle(tester, ms: 500); // snackbar slides in
    await tester.tap(find.text('UNDO'));
    await waitFor(tester, find.text('Payment reverted'));
    await _serverStatus(tester, v, qr['_id'] as String, 'PENDING');
    await idle(tester, ms: 4000);

    // FLT-VEN-076/020: Pani Puri out of stock; the server and customers follow.
    await _tab(tester, 'Stock');
    await waitFor(tester, find.text('Out')); // order cards also say "Pani Puri"
    await idle(tester);
    // The nearest Row around the name that also holds the In/Out switch.
    final rows = find.ancestor(of: find.text('Pani Puri'), matching: find.byType(Row));
    final out = find.descendant(of: rows, matching: find.text('Out'));
    await tester.tap(out.first);
    final itemId = (v['menu'] as List)[1]['_id'];
    bool? inStock;
    for (var i = 0; i < 40 && inStock != false; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      final menu = (await api('GET', '/carts/get-menu-items/${v['cartId']}'))['data'] as List;
      inStock = menu.firstWhere((m) => m['_id'] == itemId)['isInStock'] as bool?;
    }
    expect(inStock, false);
    final refused = await customerOrderRaw(v, item: 1);
    expect(refused['status'], isNot(201));
    expect('${refused['message']}', contains('out of stock'));

    // FLT-VEN-063: the manual-order sheet shows it as out of stock.
    await tester.binding.handlePopRoute(); // Android back: Stock is its own page
    await idle(tester);
    await noSnackBar(tester);
    await waitFor(tester, find.byIcon(Icons.add));
    await tester.tap(find.byIcon(Icons.add).first);
    await waitFor(tester, find.text('Create Order'));
    await idle(tester);
    expect(find.descendant(of: find.byType(AddNewOrder), matching: find.text('Out of Stock')), findsOneWidget);
    await tester.tap(find.byIcon(Icons.close));
    await idle(tester);
  });
}
