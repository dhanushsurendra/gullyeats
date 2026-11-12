// FLT-ONB-041 (OTP rate limit shown in the app) and FLT-ONB-045 (map without
// internet). Needs the PC watcher used by onboarding_more_test.dart for the
// ">>> PC:INET-OFF / INET-ON" lines (Wi-Fi and mobile data off; the backend
// stays reachable over USB). No person needed. Numbers are 60000999xx.
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _png = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
final _used = <String>{};
String _qaPhone() {
  String p;
  do {
    p = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
  } while (!_used.add(p));
  return p;
}

Future<Map<String, dynamic>> _call(String method, String path, {Object? body, String? token}) async {
  final req = http.Request(method, Uri.parse('${ApiConstants.baseUrl}$path'));
  req.headers.addAll({'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'});
  if (body != null) req.body = jsonEncode(body);
  final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 20)));
  return {'status': res.statusCode, ...jsonDecode(res.body.isEmpty ? '{}' : res.body) as Map<String, dynamic>};
}

void _say(String s) => debugPrint('\n>>> $s\n');

String _onScreen() =>
    find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toSet().join(' | ');

Future<void> _waitFor(WidgetTester tester, Finder finder, {int seconds = 25}) async {
  final end = DateTime.now().add(Duration(seconds: seconds));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw TestFailure('Timed out after ${seconds}s waiting for $finder. On screen: ${_onScreen()}');
}

Future<void> _idle(WidgetTester tester, {int ms = 1200}) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _tapText(WidgetTester tester, String text) async {
  await _waitFor(tester, find.text(text).hitTestable());
  await _idle(tester);
  await tester.tap(find.text(text).hitTestable().first);
  await tester.pump();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB-041 rate limit message, FLT-ONB-045 map without internet', (tester) async {
    tester.testTextInput.register();

    // A vendor with a cart and a photo, ready for the location step.
    final phone = _qaPhone();
    final otp = await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'});
    final v = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': phone, 'otp': otp['otp']});
    final token = v['token'] as String;
    final cartId = ((await _call('POST', '/carts/create-basic-cart', token: token,
        body: {'cartName': 'QA-Offline Cart', 'cartCity': 'Bangalore'}))['cart'] as Map)['_id'] as String;
    final signed = await _call('POST', '/carts/generate-cart-image-url/$cartId', token: token, body: {'fileType': 'image/png'});
    await http.put(Uri.parse(signed['uploadUrl'] as String), headers: {'Content-Type': 'image/png'}, body: _png);
    await _call('PUT', '/carts/update-cart-image/$cartId', token: token, body: {'imageUrl': signed['fileUrl']});

    // FLT-ONB-041: ten codes already sent for a number, then SEND OTP in the app.
    final limited = _qaPhone();
    for (var i = 0; i < 10; i++) {
      await _call('POST', '/vendors/send-otp', body: {'phoneNumber': limited, 'role': 'vendor'});
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();
    _say('STEP 041 rate limit');
    await _waitFor(tester, find.text('SEND OTP'));
    await _idle(tester);
    await tester.enterText(find.byType(TextField).hitTestable().first, limited);
    await _tapText(tester, 'SEND OTP');
    await _waitFor(tester, find.text('Too many attempts. Please try again in 15 minutes.'));
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no SMS app opened');

    // FLT-ONB-045: internet off before the location screen opens, so nothing is cached.
    _say('STEP 045 map offline');
    await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
    await _waitFor(tester, find.text('LOG IN'));
    final f = find.byType(TextField).hitTestable();
    await tester.enterText(f.at(0), phone);
    await tester.enterText(f.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _tapText(tester, 'LOG IN');
    await _tapText(tester, 'QA-Offline Cart');
    await _waitFor(tester, find.text('Cart Details'));
    _say('PC:GRANT-LOC');
    _say('PC:INET-OFF');
    await Future<void>.delayed(const Duration(seconds: 10));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('Enable Location'));
    // The map shows only once a position is captured (GPS needs no internet).
    await _tapText(tester, 'ENABLE LOCATION');
    await _waitFor(tester, find.text('CONTINUE').hitTestable(), seconds: 60);
    await _waitFor(tester, find.text('Map unavailable'), seconds: 30);
    _say('STEP offline screen: ${_onScreen()}');

    // Back online, Tap to retry draws the map.
    _say('PC:INET-ON');
    await Future<void>.delayed(const Duration(seconds: 12));
    await _tapText(tester, 'Tap to retry');
    await _waitFor(tester, find.textContaining('OpenStreetMap'), seconds: 30);
    expect(find.text('Map unavailable'), findsNothing);
    await _idle(tester, ms: 1500);
  });
}
