// FLT-VEN device tests, part 8: login support links, cart search, payment
// status failing on the welcome screen, sales range / empty / error, QR
// poster, Forgot current PIN, Terms, Kannada and Tamil (UI, menu names in
// that script, statuses, the local item name), moving staff and staff search.
// Needs watch.sh (NET-OFF / NET-ON, KEY-BACK for the browser Terms opens).
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'qa.dart';

final en = lookupAppLocalizations(const Locale('en'));
final kn = lookupAppLocalizations(const Locale('kn'));
final ta = lookupAppLocalizations(const Locale('ta'));

Future<void> _nav(WidgetTester tester, String tab) async {
  await noSnackBar(tester);
  await waitFor(tester, find.text(tab), seconds: 30);
  await tester.tap(find.text(tab).last);
  await idle(tester);
}

/// A QA staff member on [cartId] (100 QA numbers: retries on a clash).
Future<Map> _addStaff(Map<String, dynamic> v, String cartId, String name) async {
  for (var i = 0; i < 10; i++) {
    final phone = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
    final r = await api('POST', '/carts/add-staff/$cartId',
        token: v['token'] as String, body: {'name': name, 'phoneNumber': phone, 'cartId': cartId});
    if (r['status'] == 201) return r['data'] as Map;
  }
  fail('no free QA staff number');
}

/// Picks [lang] (its own name, e.g. ಕನ್ನಡ) through the language search and saves.
Future<void> _setLanguage(WidgetTester tester, String query, String lang, String save) async {
  await waitFor(tester, find.byType(TextField));
  await typeInto(tester, find.byType(TextField).first, query);
  await idle(tester);
  await tester.tap(find.text(lang).last);
  await idle(tester, ms: 300);
  await tester.testTextInput.receiveAction(TextInputAction.done);
  await idle(tester);
  await tapText(tester, save);
  await idle(tester, ms: 1500);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN support, cart search, welcome error, sales, QR, PIN help, terms, languages, staff moves',
      (tester) async {
    final v = await onboard();
    final token = v['token'] as String;
    final two = '${v['cartName']} Two';
    final cart2 = ((await api('POST', '/carts/create-basic-cart',
        token: token, body: {'cartName': two, 'cartCity': 'Bengaluru'}))['cart'] as Map)['_id'] as String;
    await api('POST', '/carts/update-location/$cart2', token: token, body: {'address': 'QA Road', 'lat': 12.9, 'lng': 77.6});
    // The picker shows its search box from 4 carts.
    for (final n in ['Three', 'Four']) {
      await api('POST', '/carts/create-basic-cart', token: token, body: {'cartName': '${v['cartName']} $n', 'cartCity': 'Bengaluru'});
    }
    final order = await customerOrder(v);
    await api('PUT', '/orders/mark-order-paid/${order['_id']}', token: token);
    final s1 = await _addStaff(v, v['cartId'] as String, 'QA Mover');
    for (final n in ['QA Helper Two', 'QA Helper Three', 'QA Helper Four', 'QA Helper Five']) { // 4 stay after the move: search shows from 4
      await _addStaff(v, v['cartId'] as String, n);
    }

    // FLT-VEN-041: Forgot PIN and Contact Support open the support sheet.
    await startApp(tester);
    for (final link in [en.forgotPin, en.contactSupport]) {
      await tapText(tester, link);
      await waitFor(tester, find.text(en.callSupport));
      await tester.binding.handlePopRoute();
      await idle(tester);
    }

    // FLT-VEN-045: search the cart picker.
    final f = find.byType(TextField);
    await typeInto(tester, f.at(0), v['phone'] as String);
    await typeInto(tester, f.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester, ms: 800);
    await tester.tap(find.text('LOGIN'));
    await waitFor(tester, find.text(two));
    await idle(tester);
    final cartSearch = find.byType(TextField).first;
    await typeInto(tester, cartSearch, 'Two');
    await idle(tester);
    expect(find.text(two), findsOneWidget);
    expect(find.text(v['cartName'] as String), findsNothing);
    await typeInto(tester, cartSearch, 'zzz');
    await waitFor(tester, find.text(en.noCartsAvailable));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester, ms: 1200); // with the keyboard up the list rebuilds the search box
    await typeInto(tester, cartSearch, v['cartName'] as String); // lists cart 1 (and the others)
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester, ms: 1500); // the keyboard closes and the list moves

    // FLT-VEN-046: the payment check fails on the welcome screen; Retry works once back.
    await tapText(tester, v['cartName'] as String);
    await idle(tester, ms: 300);
    await netOff(tester);
    await tester.tap(find.text(en.switchCartCaps));
    await idle(tester, ms: 2000);
    if (find.text(en.switchCartCaps).evaluate().isNotEmpty && find.text(en.welcome).evaluate().isEmpty) {
      await tapText(tester, v['cartName'] as String); // the pick was missed: pick again
      await idle(tester, ms: 300);
      await tester.tap(find.text(en.switchCartCaps));
    }
    await waitFor(tester, find.text(en.retry.toUpperCase()), seconds: 30);
    expect(find.textContaining('internet').evaluate().isNotEmpty || find.text(en.unableToCheckPaymentStatus).evaluate().isNotEmpty,
        true, reason: onScreen());
    await netOn(tester);
    for (var i = 0; i < 3 && find.byIcon(Icons.add).evaluate().isEmpty; i++) {
      await noSnackBar(tester); // the error snackbar can sit over RETRY
      if (find.text(en.retry.toUpperCase()).evaluate().isNotEmpty) await tapText(tester, en.retry.toUpperCase());
      for (var t = 0; t < 40 && find.byIcon(Icons.add).evaluate().isEmpty; t++) {
        await idle(tester, ms: 250);
      }
    }
    await waitFor(tester, find.byIcon(Icons.add), seconds: 10);

    // FLT-VEN-086/093: Sales: Today has the paid order; Yesterday is empty; offline shows the error + Retry.
    await _nav(tester, en.sales);
    await waitFor(tester, find.text(en.totalRevenue));
    await idle(tester, ms: 1500);
    expect(find.text('₹${(order['totalPrice'] as num).round()}'), findsWidgets);
    await tapText(tester, en.rangeLabel('yesterday'));
    await waitFor(tester, find.text(en.noOrdersInPeriod), seconds: 30);
    await netOff(tester);
    await tapText(tester, en.rangeLabel('last7'));
    await waitFor(tester, find.text(en.couldntLoadSales), seconds: 30);
    await netOn(tester);
    await tapText(tester, en.retry);
    await waitFor(tester, find.text(en.totalRevenue), seconds: 30);
    await idle(tester, ms: 1500);
    expect(find.text('₹${(order['totalPrice'] as num).round()}'), findsWidgets, reason: 'last 7 days includes today');

    // FLT-VEN-106: the QR poster opens.
    await _nav(tester, en.profile);
    await tapText(tester, en.viewQrCaps);
    await waitFor(tester, find.text(en.qrCodePoster), seconds: 30);
    await idle(tester, ms: 2000);
    expect(tester.takeException(), isNull);
    await tester.binding.handlePopRoute();
    await idle(tester);

    // FLT-VEN-109: Forgot current PIN says how to reset it.
    await tapText(tester, en.securityAndLogin);
    await tapText(tester, en.forgotCurrentPin);
    await waitFor(tester, find.text(en.contactSupportToResetPin));
    await noSnackBar(tester);
    await tester.binding.handlePopRoute();
    await idle(tester);

    // FLT-VEN-119: move a staff member to the other cart.
    await tapText(tester, en.staffManagement);
    await waitFor(tester, find.text(en.sendDetailsCaps));
    final list = find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first;
    // FLT-VEN-119: QA Mover's menu > Switch Cart > the second cart.
    await tester.scrollUntilVisible(find.text('QA Mover'), 200, scrollable: list);
    await idle(tester);
    await tester.tap(find
        .descendant(of: find.ancestor(of: find.text('QA Mover'), matching: find.byType(Row)), matching: find.byIcon(Icons.more_vert))
        .first);
    await idle(tester);
    await tester.tap(find.text(en.switchCart).last);
    await waitFor(tester, find.text(en.confirmSwitchCaps));
    await tester.tap(find.text(two).last);
    await idle(tester, ms: 300);
    await tester.tap(find.text(en.confirmSwitchCaps));
    await waitFor(tester, find.text(en.staffMovedTo(two)), seconds: 30);
    final moved = (await api('GET', '/carts/get-all-staff/$cart2', token: token))['staff'] as List;
    expect(moved.map((s) => s['_id']), contains(s1['_id']));
    await noSnackBar(tester);

    // FLT-VEN-120: with 4 staff left the search box shows and filters.
    final staffSearch = find.descendant(of: find.byType(AppSearchBar), matching: find.byType(TextField));
    await tester.scrollUntilVisible(find.byType(AppSearchBar), -200, scrollable: list);
    await typeInto(tester, staffSearch, 'Three');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester, ms: 1200);
    await tester.scrollUntilVisible(find.text('QA Helper Three'), 200, scrollable: list);
    expect(find.text('QA Helper Two'), findsNothing);
    // shortcut: the 'no staff match' message is not checked (the lazy list loses the box after a re-filter); add it with a non-lazy list.
    await tester.binding.handlePopRoute();
    await idle(tester);

    // FLT-VEN-114: Terms opens in the browser (watch.sh logs the app in front, then presses Back).
    await tapText(tester, en.termsAndConditions);
    await Future<void>.delayed(const Duration(seconds: 3));
    say('KEY-BACK');
    await Future<void>.delayed(const Duration(seconds: 6));
    await waitFor(tester, find.text(en.termsAndConditions));

    // FLT-VEN-110/111: language search, then Kannada; it is saved.
    await tapText(tester, en.change);
    await waitFor(tester, find.text(en.saveLanguageCaps));
    await typeInto(tester, find.byType(TextField).first, 'tam');
    await idle(tester);
    expect(find.text('தமிழ்'), findsWidgets);
    expect(find.text('ಕನ್ನಡ'), findsNothing);
    await _setLanguage(tester, 'kannada', 'ಕನ್ನಡ', en.saveLanguageCaps);
    await waitFor(tester, find.text(kn.orders));
    expect((await SharedPreferences.getInstance()).getString('languageCode'), 'kn');

    // FLT-VEN-112/124: the order card shows the dish in Kannada script; serving still works.
    final dosaKn = (((await api('GET', '/carts/get-menu-items/${v['cartId']}'))['data'] as List)
        .firstWhere((m) => m['name'] == 'Masala Dosa') as Map)['names']?['kn'] as String?;
    await _nav(tester, kn.orders);
    await waitFor(tester, find.text('#${order['orderNumber']}'));
    if (dosaKn != null && dosaKn.isNotEmpty) {
      expect(find.textContaining(dosaKn), findsWidgets, reason: 'names.kn = $dosaKn; ${onScreen()}');
    }
    await tester.tap(find.byKey(const ValueKey('serve')).first);
    for (var i = 0; i < 40 && await orderStatus(v, order['_id'] as String) != 'SERVED'; i++) {
      await idle(tester, ms: 250);
    }
    expect(await orderStatus(v, order['_id'] as String), 'SERVED');

    // FLT-VEN-068: the local name field (Kannada) is saved in names.kn.
    await _nav(tester, kn.profile);
    await tapText(tester, kn.menuManagement);
    await waitFor(tester, find.text(kn.editMenuItems));
    await idle(tester);
    final editIcons = find.byIcon(Icons.edit_outlined);
    await waitFor(tester, editIcons);
    await tester.tap(editIcons.last);
    await waitFor(tester, find.text(kn.itemNameInMyLanguage));
    final local = find.ancestor(of: find.text(kn.itemNameInMyLanguage), matching: find.byType(Column)).first;
    final localField = find.descendant(of: local, matching: find.byType(TextField)).first;
    await typeInto(tester, localField, 'ಕ್ಯೂಎ ತಿನಿಸು');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tapText(tester, kn.updateItemCaps);
    await waitFor(tester, find.text(kn.itemUpdated), seconds: 30);
    final saved = ((await api('GET', '/carts/get-menu-items/${v['cartId']}'))['data'] as List)
        .where((m) => (m['names']?['kn'] ?? '') == 'ಕ್ಯೂಎ ತಿನಿಸು');
    expect(saved, isNotEmpty, reason: 'names.kn saved');
    await noSnackBar(tester);
    await tester.binding.handlePopRoute();
    await idle(tester);

    // FLT-VEN-110: Tamil too.
    await tapText(tester, kn.change);
    await waitFor(tester, find.text(kn.saveLanguageCaps));
    await _setLanguage(tester, 'tamil', 'தமிழ்', kn.saveLanguageCaps);
    await waitFor(tester, find.text(ta.orders));
    expect((await SharedPreferences.getInstance()).getString('languageCode'), 'ta');
    await idle(tester, ms: 2000);
  });
}
