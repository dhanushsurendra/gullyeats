// FLT-VEN device tests, part 10: Sales details: compared with the day before,
// charts, top sellers / didn't sell, customers and ratings, QR vs manual and
// parcel orders. Run like vendor_flow_test.dart.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/l10n/app_localizations.dart';

import 'qa.dart';

final en = lookupAppLocalizations(const Locale('en'));

/// The page's vertical list (the range chips above it scroll sideways).
final _page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;

/// Scrolls the Sales page down until [f] is built, then brings the first match into view.
Future<void> _see(WidgetTester tester, Finder f) async {
  for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
    await tester.drag(_page, const Offset(0, -250));
    await idle(tester, ms: 300);
  }
  expect(f, findsWidgets, reason: onScreen());
  await tester.ensureVisible(f.first);
  await idle(tester, ms: 300);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN sales: compare, charts, sellers, customers, order types', (tester) async {
    final v = await onboard();
    final token = v['token'] as String;
    final menu = v['menu'] as List;
    await api('POST', '/carts/add-menu-item/${v['cartId']}', token: token, body: {'name': 'Vada Pav', 'price': 20, 'isVeg': true});

    // shortcut: no sales the day before (a paid order yesterday would leave an unpaid
    // fee and lock the cart past 2am), so 088 only checks the 'None before' case.
    // Today: a served QR order (2 x Masala Dosa) rated 5 with feedback, and a
    // paid manual Pani Puri with a Rs10 parcel charge. Vada Pav never sells.
    final r = await api('POST', '/orders/create-order', body: {
      'cartId': v['cartId'],
      'phoneNumber': '6000099977', // a QA number (qa.js cleanup)
      'orderItems': [
        {'menuItemId': menu[0]['_id'], 'quantity': 2},
      ],
    });
    expect(r['status'], 201, reason: '${r['message']}');
    final qr = r['data'] as Map;
    await api('PUT', '/orders/mark-order-paid/${qr['_id']}', token: token);
    await api('PUT', '/orders/serve-order/${qr['_id']}', token: token);
    final fb = await api('PUT', '/orders/submit-feedback/${qr['_id']}',
        headers: {'X-Gully-Order': '${qr['_id']}.${qr['accessKey']}'}, body: {'rating': 5, 'feedback': 'QA great dosa'});
    expect(fb['status'], 200, reason: '${fb['message']}');
    final m = await api('POST', '/orders/create-order', token: token, body: {
      'cartId': v['cartId'],
      'status': 'PAID',
      'parcelCharge': 10,
      'orderItems': [
        {'menuItemId': menu[1]['_id'], 'quantity': 1},
      ],
    });
    expect(m['status'], 201, reason: '${m['message']}');
    final manual = m['data'] as Map;
    final todayRevenue = (qr['totalPrice'] as num) + (manual['totalPrice'] as num);

    await login(tester, v);
    await tester.tap(find.text(en.sales).last);
    await waitFor(tester, find.text(en.totalRevenue), seconds: 30);
    await idle(tester, ms: 1500);
    expect(find.text('₹${todayRevenue.round()}'), findsWidgets, reason: onScreen());

    // FLT-VEN-088 (part): compared with the day before, which had no sales.
    await _see(tester, find.text(en.comparedDayBefore));
    await _see(tester, find.text(en.noSalesBefore));

    // FLT-VEN-092: customers, rating and the latest feedback.
    await _see(tester, find.text(en.customersAndService));
    await _see(tester, find.text(en.ratingCount(1)));
    await _see(tester, find.textContaining('QA great dosa')); // shown in quotes

    // FLT-VEN-090: top sellers and the item that didn't sell.
    await _see(tester, find.text(en.topSellers));
    await _see(tester, find.text(en.soldCount(2)));
    await _see(tester, find.text(en.notSold));
    await _see(tester, find.text('Vada Pav'));

    // FLT-VEN-094: QR vs manual, parcel orders and the average parcel charge.
    await _see(tester, find.text(en.orderType));
    await _see(tester, find.text(en.qrOrdersSummary(1, '₹${(qr['totalPrice'] as num).round()}')));
    expect(find.text(en.manualOrdersSummary(1, '₹${(manual['totalPrice'] as num).round()}')), findsOneWidget, reason: onScreen());
    await _see(tester, find.text(en.avgParcelCharge));
    expect(find.text('₹10'), findsWidgets);

    // FLT-VEN-089: over Last 7 Days the daily chart and busy hours render.
    for (var i = 0; i < 40 && find.text(en.rangeLabel('last7')).hitTestable().evaluate().isEmpty; i++) {
      await tester.drag(_page, const Offset(0, 400));
      await idle(tester, ms: 200);
    }
    await tester.tap(find.text(en.rangeLabel('last7')).hitTestable().first);
    await waitFor(tester, find.text(en.totalRevenue), seconds: 30);
    await idle(tester, ms: 1500);
    await _see(tester, find.text(en.dailySales));
    await _see(tester, find.text(en.busyHours));
    expect(find.textContaining('Peak:'), findsWidgets, reason: onScreen());
    expect(tester.takeException(), isNull);
  });
}
