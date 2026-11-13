// FLT-ONB device test: the onboarding app on a phone against the QA test backend.
//
//   adb reverse tcp:5050 tcp:5050
//   adb shell pm grant com.gullyeats.onboard android.permission.ACCESS_FINE_LOCATION
//   flutter test integration_test -d <device> --dart-define=API_BASE_URL=http://localhost:5050/api
//
// Two steps leave the app, so the test does them through the API the same way
// the app does: the OTP (SEND OTP opens the SMS app) and the cart photo (the
// camera app). Everything else is tapped on screen. Clean up with
// `node scripts/qa.js cleanup` in backend/ (QA phones start 00999).
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

// A 1x1 PNG, standing in for the camera photo.
final _png = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

Future<Map<String, dynamic>> _call(String method, String path, {Object? body, String? token}) async {
  final req = http.Request(method, Uri.parse('${ApiConstants.baseUrl}$path'));
  req.headers.addAll({
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  });
  if (body != null) req.body = jsonEncode(body);
  final res = await http.Response.fromStream(await req.send());
  final json = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body) as Map<String, dynamic>;
  return {'status': res.statusCode, ...json};
}

Future<void> _waitFor(WidgetTester tester, Finder finder, {int seconds = 25}) async {
  final end = DateTime.now().add(Duration(seconds: seconds));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  final onScreen = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toSet();
  throw TestFailure('Timed out after ${seconds}s waiting for $finder. On screen: $onScreen');
}

/// Lets page transitions finish; taps during one are dropped.
Future<void> _idle(WidgetTester tester, {int ms = 1200}) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _tapText(WidgetTester tester, String text) async {
  await _waitFor(tester, find.text(text));
  await _idle(tester);
  await tester.ensureVisible(find.text(text).first);
  await tester.tap(find.text(text).first);
  await tester.pump();
}

Future<Map<String, dynamic>> _cart(String token, String userId) async {
  final r = await _call('GET', '/carts/get-all-carts/$userId', token: token);
  return (r['carts'] as List).first as Map<String, dynamic>;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB device flow: PIN login, new cart, location, menu, solo setup, QR poster', (tester) async {
    // FLT-ONB-001/005: the vendor's number and OTP, as SEND OTP + VERIFY would do.
    final phone = '00999${Random().nextInt(100000).toString().padLeft(5, '0')}';
    final otp = await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'});
    expect(otp['status'], 200);
    final v = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': phone, 'otp': otp['otp']});
    expect(v['status'], 200);
    final token = v['token'] as String;
    final userId = (v['user'] as Map)['_id'] as String;
    final cartName = 'QA-Onb ${DateTime.now().millisecondsSinceEpoch % 100000}';

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();

    // FLT-ONB-008: PIN login.
    await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
    await _waitFor(tester, find.text('LOG IN'));
    // hitTestable: the sign-up screen below still has its own (hidden) field.
    final fields = find.byType(TextField).hitTestable();
    await tester.enterText(fields.at(0), phone);
    await tester.enterText(fields.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _tapText(tester, 'LOG IN');

    // FLT-ONB-012: a new cart from Your Carts.
    await _tapText(tester, '+ ADD NEW OUTLET');
    await _waitFor(tester, find.text('Cart Name'));
    await _idle(tester);
    await tester.enterText(find.byType(TextFormField).hitTestable().first, cartName);
    await tester.tap(find.byType(DropdownButton<String>));
    await _idle(tester);
    await tester.tap(find.text('Bangalore').last);
    await _idle(tester);
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('OPEN CAMERA'));

    var cart = await _cart(token, userId);
    expect(cart['cartName'], cartName);
    final cartId = cart['_id'] as String;

    // FLT-ONB-017: the photo, uploaded the way the app does after the camera.
    final signed = await _call('POST', '/carts/generate-cart-image-url/$cartId', token: token, body: {'fileType': 'image/png'});
    expect(signed['status'], 200, reason: '${signed['message']}');
    final put = await http.put(Uri.parse(signed['uploadUrl'] as String), headers: {'Content-Type': 'image/png'}, body: _png);
    expect(put.statusCode, 200);
    final saved = await _call('PUT', '/carts/update-cart-image/$cartId', token: token, body: {'imageUrl': signed['fileUrl']});
    expect(saved['status'], 200, reason: '${saved['message']}');

    // FLT-ONB-010/014: back to Your Carts; reopening the cart resumes at its first unfinished step (location).
    // The system back gesture (the screens draw their own back arrow).
    await tester.binding.handlePopRoute();
    await _idle(tester);
    await tester.binding.handlePopRoute();
    await _waitFor(tester, find.text(cartName));
    await _tapText(tester, cartName);
    // Details open prefilled; CONTINUE skips the finished steps (details, photo).
    await _waitFor(tester, find.text('Cart Details'));
    await _tapText(tester, 'CONTINUE');

    // FLT-ONB-020: location (permission granted with adb before the run).
    await _tapText(tester, 'ENABLE LOCATION');
    await _waitFor(tester, find.text('CONTINUE'), seconds: 90);
    await _tapText(tester, 'CONTINUE');
    await _tapText(tester, 'CONFIRM & CONTINUE');

    // FLT-ONB-022/027: menu, review.
    await _waitFor(tester, find.text('Add Menu'));
    await _idle(tester);
    if (find.widgetWithText(TextField, 'Item Name').hitTestable().evaluate().isEmpty) {
      await _tapText(tester, '+ ADD ITEM');
    }
    await tester.enterText(find.widgetWithText(TextField, 'Item Name').hitTestable().first, 'Masala Dosa');
    await tester.enterText(find.widgetWithText(TextField, '0').hitTestable().first, '60');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _idle(tester);
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Menu Review'));
    await _tapText(tester, 'CONTINUE');

    // Operating setup: run it myself, then activation and the QR poster.
    await _waitFor(tester, find.text('I run it myself'));
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Cart Activated'));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('SHARE QR'), seconds: 40);

    // The server has every step: photo, location, menu, QR.
    // The poster generates the QR after it opens, so give it a moment.
    cart = await _cart(token, userId);
    for (var i = 0; i < 60 && cart['qrImageUrl'] == null; i++) {
      await _idle(tester, ms: 500);
      cart = await _cart(token, userId);
    }
    expect(cart['cartImageUrl'], isNotNull);
    expect(((cart['location'] as Map?)?['coordinates'] as List?)?.length, 2);
    expect(cart['qrImageUrl'], startsWith('https://'));
    final menu = await _call('GET', '/carts/get-menu-items/$cartId');
    final items = (menu['data'] is List ? menu['data'] : (menu['data'] as Map)['items']) as List;
    expect(items.map((i) => i['name']), contains('Masala Dosa'));

    // FLT-ONB-031: SHARE QR opens Android's share sheet (another app), so what
    // follows sharing is left to qr_poster_test.dart.
    expect(find.text('SHARE QR'), findsOneWidget);
    await _idle(tester, ms: 2000);
  });
}
