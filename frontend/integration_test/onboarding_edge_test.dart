// FLT-ONB device test: the error paths. Needs a person once (tap Deny on the
// location popup) and a PC-side watcher that:
//   - presses Back only while Messages / the app chooser is in front, and
//   - on ">>> NET-OFF" runs `adb reverse --remove tcp:5050`, on ">>> NET-ON"
//     `adb reverse tcp:5050 tcp:5050` (the phone reaches the backend over USB,
//     so airplane mode would not cut it).
// Run without granting location, with --dart-define=API_BASE_URL=... and
// QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD. Numbers are 60000999xx (qa.js cleanup).
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _adminEmail = String.fromEnvironment('QA_ADMIN_EMAIL');
const _adminPassword = String.fromEnvironment('QA_ADMIN_PASSWORD');
// --dart-define=SKIP_DENY=true skips the step that needs a person to tap Deny.
const _skipDeny = bool.fromEnvironment('SKIP_DENY');

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
  return {'status': res.statusCode, 'headers': res.headers, ...jsonDecode(res.body.isEmpty ? '{}' : res.body) as Map<String, dynamic>};
}

/// A vendor who has verified their number (as after OTP) but not finished onboarding.
Future<Map<String, dynamic>> _vendor() async {
  final phone = _qaPhone();
  final otp = await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'});
  final v = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': phone, 'otp': otp['otp']});
  return {'phone': phone, 'token': v['token'], 'userId': (v['user'] as Map)['_id']};
}

void _say(String s) => debugPrint('\n>>> $s\n');

String _onScreen() =>
    find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toSet().join(' | ');

Future<void> _waitFor(WidgetTester tester, Finder finder, {int seconds = 25}) async {
  final end = DateTime.now().add(Duration(seconds: seconds));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
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
  await _waitFor(tester, find.text(text));
  await _idle(tester);
  await tester.ensureVisible(find.text(text).first);
  await tester.tap(find.text(text).first);
  await tester.pump();
}

/// For a hand-off to another app: waits until the app is back in front.
Future<void> _waitForReturn(WidgetTester tester, String what) async {
  _say('WAITING: $what');
  final end = DateTime.now().add(const Duration(minutes: 3));
  final handOff = DateTime.now().add(const Duration(seconds: 20));
  var left = false;
  while (DateTime.now().isBefore(end)) {
    final state = tester.binding.lifecycleState;
    if (!left && DateTime.now().isAfter(handOff)) {
      throw TestFailure('The app never left for: $what. On screen: ${_onScreen()}');
    }
    if (state != AppLifecycleState.resumed) left = true;
    if (left && state == AppLifecycleState.resumed) return _idle(tester);
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (state == AppLifecycleState.resumed) await tester.pump();
  }
  throw TestFailure('Nobody came back from: $what');
}

Future<void> _typeOtp(WidgetTester tester, String code) async {
  await _waitFor(tester, find.text('VERIFY & CONTINUE'));
  final boxes = find.byType(TextField).hitTestable();
  for (var i = 0; i < 6; i++) {
    await tester.enterText(boxes.at(i), code[i]);
    await tester.pump();
  }
}

Future<void> _signUpWith(WidgetTester tester, String phone) async {
  await _waitFor(tester, find.text('SEND OTP'));
  await _idle(tester);
  await tester.enterText(find.byType(TextField).hitTestable().first, phone);
  await _tapText(tester, 'SEND OTP');
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB error paths: staff number, disabled vendor, wrong OTP, theme, short name, offline, location denied',
      (tester) async {
    if (_adminPassword.isEmpty) fail('Pass --dart-define=QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD');
    binding.shouldPropagateDevicePointerEvents = true; // the person taps Deny
    tester.testTextInput.register();

    // Set-up through the API: a vendor with a cart and one staff member, and a
    // second vendor whom an admin disables.
    final owner = await _vendor();
    final cart = await _call('POST', '/carts/create-basic-cart',
        token: owner['token'] as String, body: {'cartName': 'QA-Edge Owner', 'cartCity': 'Bangalore'});
    final staffPhone = _qaPhone();
    final added = await _call('POST', '/carts/add-staff/${(cart['cart'] as Map)['_id']}',
        token: owner['token'] as String, body: {'name': 'QA Staff', 'phoneNumber': staffPhone});
    expect(added['status'], 201, reason: '${added['message']}');
    final disabled = await _vendor();
    final login = await _call('POST', '/admin/login', body: {'email': _adminEmail, 'password': _adminPassword});
    final adminToken = RegExp(r'token=([^;]+)').firstMatch((login['headers'] as Map)['set-cookie'] as String)!.group(1)!;
    expect((await _call('POST', '/admin/owners/${disabled['userId']}/disable', token: adminToken))['status'], 200);

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();

    // FLT-ONB-004: a staff member's number can't sign up as a vendor.
    _say('STEP 004 staff number');
    await _signUpWith(tester, staffPhone);
    await _waitFor(tester, find.text('This number belongs to a staff or admin account'));

    // FLT-ONB-007: a disabled vendor is refused at SEND OTP: no code, no SMS.
    _say('STEP 007 disabled vendor');
    await _signUpWith(tester, disabled['phone'] as String);
    await _waitFor(tester, find.textContaining('disabled'));
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no SMS app opened');

    // FLT-ONB-006: a wrong code is refused, the right one then works.
    _say('STEP 006 wrong OTP');
    final phone = _qaPhone();
    await _signUpWith(tester, phone);
    await _waitForReturn(tester, 'Messages (helper presses Back)');
    final code = (await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'}))['otp'] as String;
    final wrong = code == '000000' ? '111111' : '000000';
    await _typeOtp(tester, wrong);
    await _waitFor(tester, find.textContaining('Invalid OTP'));
    await _typeOtp(tester, code);
    await _waitFor(tester, find.text('+ ADD NEW OUTLET'));

    // FLT-ONB-035 (reopening keeps the login) needs a real restart, so it is
    // checked from the PC after this test, which ends logged in.

    // FLT-ONB-034: the theme toggle switches and stays switched on the next screen.
    _say('STEP 034 theme');
    await _tapText(tester, '+ ADD NEW OUTLET');
    await _waitFor(tester, find.text('Cart Details'));
    final wasDark = AppColors.dark;
    await tester.tap(find.byIcon(wasDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined).hitTestable().first);
    await _idle(tester);
    expect(AppColors.dark, !wasDark);
    expect(find.byIcon(!wasDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined).hitTestable(), findsOneWidget);

    // FLT-ONB-013: a one-letter name is refused on the phone, before any request.
    _say('STEP 013 short name');
    final name = find.byType(TextFormField).hitTestable().first;
    await tester.enterText(name, 'A');
    await tester.tap(find.byType(DropdownButton<String>));
    await _idle(tester);
    await tester.tap(find.text('Bangalore').last);
    await _idle(tester);
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('Cart name must be at least 2 characters'));

    // FLT-ONB-036: the connection drops on CONTINUE: an error, no crash, and it works once back.
    _say('NET-OFF');
    await Future<void>.delayed(const Duration(seconds: 6));
    await tester.enterText(name, 'QA-Edge Cart');
    await _tapText(tester, 'CONTINUE');
    await _idle(tester, ms: 4000);
    final offline = _onScreen();
    expect(find.text('Cart Details'), findsOneWidget, reason: 'still on Cart Details while offline');
    _say('STEP offline screen: $offline');
    _say('NET-ON');
    await Future<void>.delayed(const Duration(seconds: 6));
    await _idle(tester, ms: 4000); // let the error snackbar go
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('OPEN CAMERA'));
    // Wait until the server answers again before talking to it.
    final token = (await SharedPreferences.getInstance()).getString('token');
    final carts = await _call('GET', '/carts/get-all-carts/${(await SharedPreferences.getInstance()).getString('userId')}', token: token);
    expect((carts['carts'] as List).length, 1, reason: 'one cart, not a duplicate from the failed try');
    final cartId = (carts['carts'] as List).first['_id'] as String;

    // The photo through the API (the camera is another app), then on to location.
    final signed = await _call('POST', '/carts/generate-cart-image-url/$cartId', token: token, body: {'fileType': 'image/png'});
    await http.put(Uri.parse(signed['uploadUrl'] as String), headers: {'Content-Type': 'image/png'}, body: _png);
    await _call('PUT', '/carts/update-cart-image/$cartId', token: token, body: {'imageUrl': signed['fileUrl']});
    await tester.binding.handlePopRoute();
    await _idle(tester);
    await tester.binding.handlePopRoute();
    await _tapText(tester, 'QA-Edge Cart');
    await _waitFor(tester, find.text('Cart Details'));
    await _tapText(tester, 'CONTINUE');

    if (!_skipDeny) {
      // FLT-ONB-019: location permission denied: guidance, no crash.
      _say('STEP 019 location: ACTION NEEDED - tap Deny (Don\'t allow) on the popup');
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitForReturn(tester, 'location popup: tap Don\'t allow');
      await _waitFor(tester, find.textContaining('permission'), seconds: 30);
      expect(find.text('ENABLE LOCATION'), findsOneWidget, reason: 'can try again');

    }

    // Put the theme back as it was.
    await tester.tap(find.byIcon(AppColors.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined).hitTestable().first);
    await _idle(tester, ms: 1500);
    binding.shouldPropagateDevicePointerEvents = false;
  });
}
