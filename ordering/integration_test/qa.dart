// Shared helpers for the FLT-VEN device tests (see vendor_flow_test.dart for how to run them).
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/main.dart' as app;
import 'package:shared_preferences/shared_preferences.dart';

const adminEmail = String.fromEnvironment('QA_ADMIN_EMAIL');
const adminPassword = String.fromEnvironment('QA_ADMIN_PASSWORD');

Future<Map<String, dynamic>> api(String method, String path,
    {Object? body, String? token, Map<String, String>? headers}) async {
  final req = http.Request(method, Uri.parse('${ApiConstants.baseUrl}$path'));
  req.headers.addAll({
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
    ...?headers,
  });
  if (body != null) req.body = jsonEncode(body);
  final res = await http.Response.fromStream(await req.send());
  final json = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body) as Map<String, dynamic>;
  return {'status': res.statusCode, ...json, 'headers': res.headers};
}

/// A fresh QA vendor with an open cart and two menu items, onboarded the
/// way the onboarding app does it.
///
/// [realPhone] gives a valid-looking Indian number (60000999xx) for flows that
/// check the number's format, such as Razorpay's prefill.
Future<Map<String, dynamic>> onboard({bool realPhone = false}) async {
  final phone = realPhone
      ? '60000999${Random().nextInt(100).toString().padLeft(2, '0')}'
      : '00999${Random().nextInt(100000).toString().padLeft(5, '0')}';
  final otp = await api('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'});
  final v = await api('POST', '/vendors/verify-otp', body: {'phoneNumber': phone, 'otp': otp['otp']});
  final token = v['token'] as String;
  final name = 'QA-Phone ${DateTime.now().millisecondsSinceEpoch % 100000}';
  final cart = await api('POST', '/carts/create-basic-cart', token: token, body: {'cartName': name, 'cartCity': 'Bengaluru'});
  final cartId = (cart['cart'] as Map)['_id'] as String;
  await api('POST', '/carts/update-location/$cartId',
      token: token, body: {'address': 'QA Street', 'lat': 12.97, 'lng': 77.59});
  final menu = await api('POST', '/carts/create-menu/$cartId', token: token, body: {
    'items': [
      {'name': 'Masala Dosa', 'price': 60, 'isVeg': true},
      {'name': 'Pani Puri', 'price': 30, 'isVeg': true},
    ],
  });
  await api('PUT', '/carts/toggle-cart-status/$cartId', token: token, body: {'isOpen': true});
  return {
    'phone': phone,
    'pin': v['pin'],
    'token': token,
    'userId': (v['user'] as Map)['_id'],
    'vendorId': (v['user'] as Map)['userId'],
    'cartId': cartId,
    'cartName': name,
    'menu': menu['data'],
  };
}

Future<Map<String, dynamic>> customerOrder(Map<String, dynamic> v, {int item = 0}) async {
  final r = await customerOrderRaw(v, item: item);
  expect(r['status'], 201, reason: 'customer order: ${r['message']}');
  return r['data'] as Map<String, dynamic>;
}

Future<Map<String, dynamic>> customerOrderRaw(Map<String, dynamic> v, {int item = 0}) =>
    api('POST', '/orders/create-order', body: {
      'cartId': v['cartId'],
      'orderItems': [
        {'menuItemId': (v['menu'] as List)[item]['_id'], 'quantity': 1},
      ],
    });

Future<String> orderStatus(Map<String, dynamic> v, String orderId) async =>
    (await api('GET', '/orders/order/$orderId', token: v['token'] as String))['data']['status'] as String;

Future<String> adminToken() async {
  final r = await api('POST', '/admin/login', body: {'email': adminEmail, 'password': adminPassword});
  final cookie = (r['headers'] as Map<String, String>)['set-cookie'] ?? '';
  return RegExp(r'token=([^;]+)').firstMatch(cookie)!.group(1)!;
}

/// Pumps until [finder] shows up (network and sockets are real, so no settle).
Future<void> waitFor(WidgetTester tester, Finder finder, {int seconds = 20}) async {
  final end = DateTime.now().add(Duration(seconds: seconds));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw TestFailure('Timed out after ${seconds}s waiting for $finder. On screen: ${onScreen()}');
}

/// Lets transitions and short sounds finish (real sockets keep pumpAndSettle busy).
Future<void> idle(WidgetTester tester, {int ms = 1500}) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Clears any saved login and starts the app on the login screen.
Future<void> startApp(WidgetTester tester) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.clear();
  await prefs.setString('languageCode', 'en');
  app.main();
  await waitFor(tester, find.byType(TextField));
}

/// Logs in from the login screen with [id] (phone by default) and opens the cart.
Future<void> login(WidgetTester tester, Map<String, dynamic> v, {String? id, bool start = true}) async {
  if (start) await startApp(tester);
  final fields = find.byType(TextField);
  // Focus first: an earlier failed try can leave enterText typing nowhere.
  for (final (i, text) in [(0, id ?? v['phone'] as String), (1, v['pin'] as String)]) {
    await tester.tap(fields.at(i));
    await tester.pump();
    await tester.enterText(fields.at(i), text);
  }
  await tester.testTextInput.receiveAction(TextInputAction.done);
  await tester.pump();
  await idle(tester, ms: 800); // let the keyboard close; it covers LOGIN while it animates
  await noSnackBar(tester);
  await tester.ensureVisible(find.text('LOGIN'));
  await tester.tap(find.text('LOGIN'));
  await waitFor(tester, find.byWidgetPredicate((w) =>
      (w is Text && w.data == v['cartName']) || (w is Icon && w.icon == Icons.add)));
  await idle(tester); // the cart list slides in; taps during the transition are dropped
  // With one cart the picker can move on by itself; otherwise tap the cart.
  final cart = find.text(v['cartName'] as String);
  if (find.byIcon(Icons.add).evaluate().isEmpty && cart.evaluate().isNotEmpty) {
    await tester.tap(cart.first, warnIfMissed: false);
  }
  await waitFor(tester, find.byIcon(Icons.add)); // the + button is on the Orders tab
}


/// Every text on screen, for failure messages.
String onScreen() =>
    find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toSet().join(' | ');

/// A line for integration_test/watch.sh on the PC (NET-OFF, NET-ON, BACK).
void say(String s) => debugPrint('\n>>> $s\n');

/// Cuts the app off from the backend (watch.sh removes the adb reverse).
Future<void> netOff(WidgetTester tester) async {
  say('NET-OFF');
  await idle(tester, ms: 4000);
}

/// Restores it and waits until the backend answers again.
Future<void> netOn(WidgetTester tester) async {
  say('NET-ON');
  for (var i = 0; i < 30; i++) {
    await idle(tester, ms: 1000);
    try {
      await http.get(Uri.parse('${ApiConstants.baseUrl}/carts/food-names')).timeout(const Duration(seconds: 2));
      return;
    } catch (_) {}
  }
  fail('Backend not reachable after NET-ON (run the test through integration_test/watch.sh)');
}

/// Scrolls [text] into view and taps it.
Future<void> tapText(WidgetTester tester, String text) async {
  await waitFor(tester, find.text(text));
  final f = find.text(text).first;
  await tester.ensureVisible(f);
  await idle(tester, ms: 400);
  await tester.tap(f);
  await tester.pump();
}

/// Waits until no snackbar is showing (they cover the bottom buttons).
Future<void> noSnackBar(WidgetTester tester) async {
  for (var i = 0; i < 60 && find.byType(SnackBar).evaluate().isNotEmpty; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

/// Types [text] into [field] and checks it arrived. On a device a second
/// enterText on a field can go to a stale text connection, so this tries
/// enterText, then tap + enterText, then a direct editing update.
Future<void> typeInto(WidgetTester tester, Finder field, String text) async {
  // Read the inner EditableText: a TextField may have no controller of its own.
  String now() => tester.widget<EditableText>(find.descendant(of: field, matching: find.byType(EditableText))).controller.text;
  final tries = <Future<void> Function()>[
    () => tester.enterText(field, text),
    () async {
      await tester.tap(field);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(field, text);
    },
    () async {
      await tester.showKeyboard(field);
      tester.testTextInput.updateEditingValue(
          TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length)));
    },
    // Last resort when the keyboard connection is stuck: set the text and fire onChanged.
    () async {
      final editable = tester.widget<EditableText>(find.descendant(of: field, matching: find.byType(EditableText)));
      editable.controller.text = text;
      tester.widget<TextField>(field).onChanged?.call(text);
    },
  ];
  for (final attempt in tries) {
    await attempt();
    await tester.pump(const Duration(milliseconds: 200));
    if (now() == text) return;
  }
  fail('Could not type "$text" into $field (field has "${now()}")');
}
