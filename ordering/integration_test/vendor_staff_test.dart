// FLT-VEN device tests, part 4: the staff view. Run like vendor_flow_test.dart
// (no watcher needed). Staff phones start 60000999 (qa.js cleanup).
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'qa.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN staff: login, Handover, owner screens hidden and refused, stock, sync', (tester) async {
    final v = await onboard();
    late String phone;
    late Map<String, dynamic> added;
    for (var i = 0; i < 10; i++) { // 100 QA numbers: retry on one left from an earlier run
      phone = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
      added = await api('POST', '/carts/add-staff/${v['cartId']}',
          token: v['token'] as String, body: {'name': 'QA Staff', 'phoneNumber': phone, 'cartId': v['cartId']});
      if (added['status'] != 409) break;
    }
    expect(added['status'], 201, reason: '${added['message']}');
    final staff = added['data'] as Map;
    final order = await customerOrder(v);

    // FLT-VEN-040: staff log in with their phone + PIN and land on Orders.
    await login(tester, {...v, 'phone': phone, 'pin': staff['pinHash']});
    await waitFor(tester, find.text('#${order['orderNumber']}'));

    // FLT-VEN-059: the owner marks it paid on another phone; this one follows live.
    await api('PUT', '/orders/mark-order-paid/${order['_id']}', token: v['token'] as String);
    await waitFor(tester, find.byKey(const ValueKey('serve')));

    // FLT-VEN-095/023: Handover instead of Sales.
    expect(find.text('Sales'), findsNothing);
    await tester.tap(find.text('Handover'));
    await idle(tester, ms: 2500);
    expect(tester.takeException(), isNull);

    // FLT-VEN-105/075/023: Profile hides the owner's screens and the cart edit button.
    await tester.tap(find.text('Profile'));
    await waitFor(tester, find.text('Orders Overview'));
    for (final hidden in ['Payments History', 'Menu Management', 'Staff Management']) {
      expect(find.text(hidden), findsNothing, reason: '$hidden is owner-only');
    }
    expect(find.byIcon(Icons.edit_outlined), findsNothing);

    // FLT-VEN-023: and the server refuses the owner's routes with a staff login.
    final staffToken = (await api('POST', '/vendors/login',
        body: {'vendorIdentifier': phone, 'pin': staff['pinHash']}))['token'] as String;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    for (final r in [
      ['GET', '/carts/sales-insights/${v['cartId']}?startDate=$today&endDate=$today'],
      ['POST', '/carts/add-menu-item/${v['cartId']}'],
      ['POST', '/carts/add-staff/${v['cartId']}'],
    ]) {
      // Valid bodies, so only the role can be the reason (a QA phone in case it slips through).
      final res = await api(r[0], r[1], token: staffToken, body: r[0] == 'POST'
          ? {'name': 'QA Extra', 'price': 10, 'phoneNumber': phone.endsWith('00') ? '6000099901' : '6000099900', 'cartId': v['cartId']}
          : null);
      expect(res['status'], 403, reason: '${r[1]}: ${res['message']}');
    }

    // FLT-VEN-078: staff can still mark items out of stock.
    await tester.tap(find.text('Orders'));
    await idle(tester);
    final stock = find.text('Stock').first;
    await tester.ensureVisible(stock);
    await idle(tester, ms: 300);
    await tester.tap(stock);
    await waitFor(tester, find.text('Out'));
    await idle(tester);
    final rows = find.ancestor(of: find.text('Masala Dosa'), matching: find.byType(Row));
    await tester.tap(find.descendant(of: rows, matching: find.text('Out')).first);
    final itemId = (v['menu'] as List)[0]['_id'];
    bool? inStock;
    for (var i = 0; i < 40 && inStock != false; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      final menu = (await api('GET', '/carts/get-menu-items/${v['cartId']}'))['data'] as List;
      inStock = menu.firstWhere((m) => m['_id'] == itemId)['isInStock'] as bool?;
    }
    expect(inStock, false);
    await idle(tester, ms: 2000);
  });
}

