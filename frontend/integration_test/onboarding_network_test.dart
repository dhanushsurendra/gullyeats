// FLT-ONB-058..064 device test: losing the connection at each onboarding step that
// talks to the server, and coming back. Run through ordering/integration_test/watch.sh,
// which acts on these lines:
//   ">>> NET-OFF" / ">>> NET-ON"     cut / restore the USB route to the test backend
//   ">>> RADIO-OFF" / ">>> RADIO-ON" Wi-Fi and mobile data off / on (the backend stays
//                                     reachable over USB; S3 images and maps are not)
//   ">>> BACK"                        press Back while the Messages app is in front
//
//   cd frontend
//   adb reverse tcp:5050 tcp:5050
//   bash ../ordering/integration_test/watch.sh flutter test integration_test/onboarding_network_test.dart \
//     -d <device> --dart-define=API_BASE_URL=http://localhost:5050/api
// Numbers are 60000999xx (node scripts/qa.js cleanup). No person needed.
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/features/staff_management/widgets/add_staff_form.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _offline = 'Check your internet connection';

Future<Map<String, dynamic>> _call(String method, String path, {Object? body, String? token}) async {
  final req = http.Request(method, Uri.parse('${ApiConstants.baseUrl}$path'));
  req.headers.addAll({'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'});
  if (body != null) req.body = jsonEncode(body);
  final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 20)));
  return {'status': res.statusCode, ...jsonDecode(res.body.isEmpty ? '{}' : res.body) as Map<String, dynamic>};
}

void _say(String s) => debugPrint('\n>>> $s\n');

/// Asks the PC watcher for a network change and gives it time to happen.
Future<void> _pc(WidgetTester tester, String command, {int seconds = 4}) async {
  _say(command);
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

String _onScreen() =>
    find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toSet().join(' | ');

Future<void> _waitFor(WidgetTester tester, Finder finder, {int seconds = 30}) async {
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
  await _waitFor(tester, find.text(text));
  await _idle(tester);
  await tester.ensureVisible(find.text(text).first);
  await tester.tap(find.text(text).first);
  await tester.pump();
}

/// The offline message appears, and the screen with [stays] is still there.
Future<void> _expectOffline(WidgetTester tester, String stays) async {
  await _waitFor(tester, find.text(_offline), seconds: 40);
  expect(find.text(stays), findsWidgets, reason: 'still on the same screen');
  await _idle(tester, ms: 4500); // let the message go
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB network: login, Your Carts, menu, staff, QR poster offline and back', (tester) async {
    // A vendor with a cart whose details, photo and location are done, so the
    // app resumes it at the menu step.
    final phone = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
    final otp = await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'});
    expect(otp['status'], 200, reason: '${otp['message']}');
    final v = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': phone, 'otp': otp['otp']});
    final token = v['token'] as String;
    final userId = (v['user'] as Map)['_id'] as String;
    final cartName = 'QA-OnbNet ${DateTime.now().millisecondsSinceEpoch % 100000}';
    final c = await _call('POST', '/carts/create-basic-cart', token: token, body: {'cartName': cartName, 'cartCity': 'Bengaluru'});
    final cartId = (c['cart'] as Map)['_id'] as String;
    final signed = await _call('POST', '/carts/generate-cart-image-url/$cartId', token: token, body: {'fileType': 'image/png'});
    await http.put(Uri.parse(signed['uploadUrl'] as String), headers: {'Content-Type': 'image/png'},
        body: base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    await _call('PUT', '/carts/update-cart-image/$cartId', token: token, body: {'imageUrl': signed['fileUrl']});
    await _call('POST', '/carts/update-location/$cartId', token: token, body: {'address': 'QA Street, Bengaluru', 'lat': 12.9716, 'lng': 77.5946});

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();
    // The test types through its own keyboard; otherwise the emulator's keyboard
    // can send its (empty) text back over what was typed.
    tester.testTextInput.register();

    // FLT-ONB-058: PIN login with the server unreachable: the message, still on login; then it works.
    await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
    await _waitFor(tester, find.text('LOG IN'));
    final fields = find.byType(TextField).hitTestable();
    await tester.enterText(fields.at(0), phone);
    await tester.enterText(fields.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _pc(tester, 'NET-OFF');
    await _tapText(tester, 'LOG IN');
    await _expectOffline(tester, 'LOG IN');
    _say('STEP 058 login offline: ok');
    await _pc(tester, 'NET-ON');
    await _tapText(tester, 'LOG IN');
    await _waitFor(tester, find.text(cartName));

    // FLT-ONB-059: Your Carts refreshed offline: the message, and the list stays; then a refresh works.
    await _pc(tester, 'NET-OFF');
    await tester.fling(find.text(cartName), const Offset(0, 400), 1500);
    await _expectOffline(tester, cartName);
    _say('STEP 059 carts offline: ok');
    await _pc(tester, 'NET-ON');
    await tester.fling(find.text(cartName), const Offset(0, 400), 1500);
    await _idle(tester, ms: 3000);
    expect(find.text(_offline), findsNothing);
    expect(find.text(cartName), findsOneWidget);

    // FLT-ONB-060: saving the menu offline: the message, nothing saved; then it saves once.
    await _tapText(tester, cartName);
    await _waitFor(tester, find.text('Cart Details'));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('Add Menu'), seconds: 40);
    await _idle(tester);
    if (find.widgetWithText(TextField, 'Item Name').hitTestable().evaluate().isEmpty) {
      await _tapText(tester, '+ ADD ITEM');
    }
    await tester.enterText(find.widgetWithText(TextField, 'Item Name').hitTestable().first, 'Masala Dosa');
    await tester.enterText(find.widgetWithText(TextField, '0').hitTestable().first, '60');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _idle(tester);
    // The menu is saved from Menu Review's CONTINUE.
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Menu Review'), seconds: 40);
    await _pc(tester, 'NET-OFF');
    await _tapText(tester, 'CONTINUE');
    await _expectOffline(tester, 'Menu Review');
    _say('STEP 060 menu offline: ok');
    await _pc(tester, 'NET-ON');
    List items(Map<String, dynamic> m) => (m['data'] is List ? m['data'] : (m['data'] as Map)['items']) as List;
    var menu = await _call('GET', '/carts/get-menu-items/$cartId');
    expect(items(menu), isEmpty, reason: 'nothing saved while offline');
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('My staff also runs it'), seconds: 40);
    menu = await _call('GET', '/carts/get-menu-items/$cartId');
    expect(items(menu).map((i) => i['name']).toList(), ['Masala Dosa'], reason: 'saved exactly once');

    // FLT-ONB-061: adding a helper offline: the message, no staff; then it adds.
    await _tapText(tester, 'My staff also runs it');
    await _tapText(tester, 'ADD STAFF MEMBERS');
    await _waitFor(tester, find.text('SEND DETAILS'));
    await _idle(tester);
    final staffPhone = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
    final staffFields = find.descendant(of: find.byType(AddStaffForm), matching: find.byType(EditableText));
    final inputs = find.descendant(of: find.byType(AddStaffForm), matching: find.byType(TextFormField));
    for (final (i, text) in [(0, 'QA-Helper'), (1, staffPhone)]) {
      await tester.showKeyboard(inputs.at(i));
      await tester.pump();
      tester.testTextInput.enterText(text);
      await tester.pump();
    }
    await _idle(tester);
    String typed(int i) => tester.widget<EditableText>(staffFields.at(i)).controller.text;
    expect(typed(0), 'QA-Helper', reason: 'name typed');
    expect(typed(1), staffPhone, reason: 'number typed');
    await _pc(tester, 'NET-OFF');
    await tester.testTextInput.receiveAction(TextInputAction.done); // close the keyboard, as a person would
    await _idle(tester);
    await _tapText(tester, 'SEND DETAILS');
    await tester.pump(const Duration(milliseconds: 300));
    await _expectOffline(tester, 'SEND DETAILS');
    _say('STEP 061 staff offline: ok');
    await _pc(tester, 'NET-ON');
    final noStaff = await _call('GET', '/carts/get-all-staff/$cartId', token: token);
    expect(jsonEncode(noStaff), isNot(contains(staffPhone)));
    await _tapText(tester, 'SEND DETAILS');
    // Adding opens the Messages app with the helper's login: wait for it, then come back.
    final left = DateTime.now().add(const Duration(seconds: 30));
    while (tester.binding.lifecycleState == AppLifecycleState.resumed && DateTime.now().isBefore(left)) {
      await tester.pump(const Duration(milliseconds: 300));
    }
    await Future<void>.delayed(const Duration(seconds: 2));
    _say('BACK');
    final back = DateTime.now().add(const Duration(seconds: 40));
    while (tester.binding.lifecycleState != AppLifecycleState.resumed && DateTime.now().isBefore(back)) {
      await Future<void>.delayed(const Duration(milliseconds: 300));
    }
    await _waitFor(tester, find.text('QA-Helper'), seconds: 60);
    await _idle(tester, ms: 3000);

    // FLT-ONB-062: the QR poster with the server unreachable: no QR, and SHARE QR
    // refuses (it used to share a poster with a grey placeholder and nothing to scan).
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('Cart Activated'), seconds: 40);
    await _pc(tester, 'NET-OFF');
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('SHARE QR'), seconds: 40);
    await _waitFor(tester, find.text(_offline), seconds: 40); // the QR didn't load
    await _idle(tester, ms: 4500);
    await _tapText(tester, 'SHARE QR');
    await _waitFor(tester, find.text(_offline), seconds: 40);
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no share sheet opened');
    expect(find.text('BACK TO OUTLETS'), findsNothing, reason: 'nothing was shared');
    _say('STEP 062 QR offline: share refused');
    await _idle(tester, ms: 4500);

    // FLT-ONB-063: the server back but no internet (the QR image is on S3): still refused.
    await _pc(tester, 'NET-ON');
    await _pc(tester, 'RADIO-OFF', seconds: 8);
    await _tapText(tester, 'SHARE QR');
    await _waitFor(tester, find.text(_offline), seconds: 60);
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no share sheet opened');
    _say('STEP 063 QR image offline: share refused');
    await _pc(tester, 'RADIO-ON', seconds: 10);

    // FLT-ONB-064: everything back: the QR is on the server, and the share sheet opens.
    final cart = await _call('GET', '/carts/get-all-carts/$userId', token: token);
    expect(((cart['carts'] as List).first as Map)['qrImageUrl'], startsWith('https://'));
    await _idle(tester, ms: 4500);
    await _tapText(tester, 'SHARE QR');
    final end = DateTime.now().add(const Duration(seconds: 60));
    while (tester.binding.lifecycleState == AppLifecycleState.resumed && DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(tester.binding.lifecycleState, isNot(AppLifecycleState.resumed), reason: 'the share sheet opened');
    _say('STEP 064 share sheet opened');
    _say('KEY-BACK');
    await Future<void>.delayed(const Duration(seconds: 4));
    await _idle(tester, ms: 2000);
  });
}
