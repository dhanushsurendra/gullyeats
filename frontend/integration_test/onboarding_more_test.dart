// FLT-ONB device test: the remaining paths. A PC watcher acts on the
// ">>> PC:" lines this test prints (see docs/qa or the run notes):
//   PC:EXPIRE <phone>   set that number's OTP expiry in the past (database)
//   PC:NET-OFF / ON     cut / restore the USB route to the backend
//   PC:LOC-OFF / ON     turn the phone's location services off / on
//   PC:INET-OFF / ON    turn Wi-Fi and mobile data off / on (the backend stays reachable over USB)
//   PC:GRANT-LOC        grant location permission
//   PC:BACK             press Back once if Settings is in front
// and always presses Back in Messages or the share sheet. A person taps the
// camera and location popups and takes two photos when the test says so.
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/staff_management/widgets/add_staff_form.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

// --dart-define=FROM_LOCATION=true starts at the location step with a cart set
// up through the API (skips the OTP screen, cart details and camera parts).
const _fromLocation = bool.fromEnvironment('FROM_LOCATION');
// --dart-define=SKIP_DENY=true skips location-off and the two denies (needs a person).
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
  return {'status': res.statusCode, ...jsonDecode(res.body.isEmpty ? '{}' : res.body) as Map<String, dynamic>};
}

void _say(String s) => debugPrint('\n>>> $s\n');
Future<void> _pc(String command, {int wait = 5}) async {
  _say('PC:$command');
  await Future<void>.delayed(Duration(seconds: wait));
}

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
  await _waitFor(tester, find.text(text));
  await _idle(tester);
  if (find.text(text).hitTestable().evaluate().isEmpty) {
    await tester.scrollUntilVisible(find.text(text), -300, scrollable: find.byType(Scrollable).hitTestable().first);
  }
  await tester.ensureVisible(find.text(text).first);
  await tester.tap(find.text(text).first);
  await tester.pump();
}

/// Waits while another app or a system popup is in front, until the app is back.
Future<void> _waitForReturn(WidgetTester tester, String what, {int handOffSeconds = 20}) async {
  _say('WAITING: $what');
  final end = DateTime.now().add(const Duration(minutes: 3));
  final handOff = DateTime.now().add(Duration(seconds: handOffSeconds));
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

Future<String> _freshOtp(String phone) async =>
    (await _call('POST', '/vendors/send-otp', body: {'phoneNumber': phone, 'role': 'vendor'}))['otp'] as String;

Future<void> _signUpWith(WidgetTester tester, String phone) async {
  await _waitFor(tester, find.text('SEND OTP'));
  await _idle(tester);
  await tester.enterText(find.byType(TextField).hitTestable().first, phone);
  await _tapText(tester, 'SEND OTP');
}

Future<void> _back(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await _idle(tester);
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB remaining paths', (tester) async {
    binding.shouldPropagateDevicePointerEvents = true;
    tester.testTextInput.register();
    final notes = <String>[];
    void note(String s) {
      notes.add(s);
      _say('NOTE $s');
    }

    // Set-up: vendor V with a finished cart (QR) and a half-done one.
    final vPhone = _qaPhone();
    final v = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': vPhone, 'otp': await _freshOtp(vPhone)});
    final vToken = v['token'] as String;
    Future<String> newCart(String name) async =>
        ((await _call('POST', '/carts/create-basic-cart', token: vToken, body: {'cartName': name, 'cartCity': 'Bangalore'}))['cart']
            as Map)['_id'] as String;
    final done = await newCart('QA-More Alpha');
    // A real finished cart: photo, location, menu, then the QR.
    final signedA = await _call('POST', '/carts/generate-cart-image-url/$done', token: vToken, body: {'fileType': 'image/png'});
    await http.put(Uri.parse(signedA['uploadUrl'] as String), headers: {'Content-Type': 'image/png'}, body: _png);
    await _call('PUT', '/carts/update-cart-image/$done', token: vToken, body: {'imageUrl': signedA['fileUrl']});
    await _call('POST', '/carts/update-location/$done', token: vToken, body: {'address': 'QA Street', 'lat': 12.97, 'lng': 77.59});
    await _call('POST', '/carts/create-menu/$done', token: vToken, body: {
      'items': [{'name': 'Masala Dosa', 'price': 60, 'isVeg': true}],
    });
    await _call('POST', '/carts/generate-cart-qr/$done', token: vToken);
    await newCart('QA-More Beta');

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();

    if (_fromLocation) {
      // P with cart Gamma and a photo, as after the camera step; PIN login, resume.
      final p = _qaPhone();
      final pv = await _call('POST', '/vendors/verify-otp', body: {'phoneNumber': p, 'otp': await _freshOtp(p)});
      final t = pv['token'] as String;
      final id = ((await _call('POST', '/carts/create-basic-cart', token: t,
          body: {'cartName': 'QA-More Gamma', 'cartCity': 'Bangalore'}))['cart'] as Map)['_id'] as String;
      final signed = await _call('POST', '/carts/generate-cart-image-url/$id', token: t, body: {'fileType': 'image/png'});
      await http.put(Uri.parse(signed['uploadUrl'] as String), headers: {'Content-Type': 'image/png'}, body: _png);
      await _call('PUT', '/carts/update-cart-image/$id', token: t, body: {'imageUrl': signed['fileUrl']});
      await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
      await _waitFor(tester, find.text('LOG IN'));
      final f = find.byType(TextField).hitTestable();
      await tester.enterText(f.at(0), p);
      await tester.enterText(f.at(1), pv['pin'] as String);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await _tapText(tester, 'LOG IN');
      await _tapText(tester, 'QA-More Gamma');
      await _waitFor(tester, find.text('Cart Details'));
      await _tapText(tester, 'CONTINUE');
    } else {
      // ---------------- OTP screen (a new number P)
      final p = _qaPhone();
      _say('STEP OTP screen: Change, expiry, resend');
      await _signUpWith(tester, p);
      await _waitForReturn(tester, 'Messages (watcher presses Back)');
      await _waitFor(tester, find.text('VERIFY & CONTINUE'));
      // Change: back to the number, still filled in.
      await _tapText(tester, 'Change');
      await _waitFor(tester, find.text('SEND OTP'));
      final typed = tester.widget<EditableText>(find.byType(EditableText).hitTestable().first).controller.text;
      note('after Change the number field holds "$typed"');
      await _signUpWith(tester, p);
      await _waitForReturn(tester, 'Messages (watcher presses Back)');

      // FLT-ONB-006 expiry: a real code whose time is up.
      final expiring = await _freshOtp(p);
      await _pc('EXPIRE $p');
      await _typeOtp(tester, expiring);
      await _waitFor(tester, find.textContaining('expired'));

      // Resend becomes available after 2 minutes and opens Messages again.
      _say('STEP waiting for Resend (2 min)');
      await _waitFor(tester, find.text('Resend').hitTestable(), seconds: 150);
      final resendable = find.ancestor(of: find.text('Resend'), matching: find.byType(GestureDetector));
      for (var i = 0; i < 130 && find.textContaining('Resend available').evaluate().isNotEmpty; i++) {
        await _idle(tester, ms: 1000);
      }
      await tester.tap(resendable.first);
      await tester.pump();
      await _waitForReturn(tester, 'Messages after Resend (watcher presses Back)');
      await _waitFor(tester, find.textContaining('Resend available'));
      await _typeOtp(tester, await _freshOtp(p));
      await _waitFor(tester, find.text('+ ADD NEW OUTLET'));

      // ---------------- Cart details (P's first cart)
      _say('STEP 016 city required, 036 offline message');
      await _tapText(tester, '+ ADD NEW OUTLET');
      await _waitFor(tester, find.text('Cart Details'));
      await _idle(tester);
      await tester.enterText(find.byType(TextFormField).hitTestable().first, 'QA-More Gamma');
      await _tapText(tester, 'CONTINUE');
      await _idle(tester, ms: 2000);
      expect(find.text('Cart Details'), findsOneWidget, reason: 'no city: stays');
      final pToken0 = (await SharedPreferences.getInstance()).getString('token');
      final pId0 = (await SharedPreferences.getInstance()).getString('userId');
      expect(((await _call('GET', '/carts/get-all-carts/$pId0', token: pToken0))['carts'] as List), isEmpty,
          reason: 'no cart created without a city');
      await tester.tap(find.byType(DropdownButton<String>));
      await _idle(tester);
      await tester.tap(find.text('Bangalore').last);
      await _idle(tester);
      // FLT-ONB-036: the connection drops: the message must show.
      await _pc('NET-OFF');
      await _tapText(tester, 'CONTINUE');
      await _waitFor(tester, find.text('Check your internet connection'), seconds: 3);
      await _pc('NET-ON');
      await _idle(tester, ms: 3500);
      await _tapText(tester, 'CONTINUE');
      await _waitFor(tester, find.text('OPEN CAMERA'));

      // ---------------- Photo: deny, allow, photo, retake, upload
      _say('STEP camera: ACTION - tap Don\'t allow');
      await _tapText(tester, 'OPEN CAMERA');
      await _waitForReturn(tester, 'camera permission popup: tap Don\'t allow');
      await _waitFor(tester, find.textContaining('Camera'), seconds: 10);
      note('after denying the camera: ${_onScreen()}');
      if (find.text('Cancel').evaluate().isNotEmpty) await _tapText(tester, 'Cancel');
      _say('STEP camera: ACTION - tap Allow (While using the app), then take a photo');
      await _idle(tester, ms: 3000);
      await _tapText(tester, 'OPEN CAMERA');
      await _waitForReturn(tester, 'camera permission popup + camera: Allow, then take a photo', handOffSeconds: 30);
      // The popup and the camera are two hand-offs; wait for the photo.
      for (var i = 0; i < 3 && find.text('CONFIRM & UPLOAD').evaluate().isEmpty; i++) {
        if (find.text('OPEN CAMERA').hitTestable().evaluate().isNotEmpty && tester.binding.lifecycleState == AppLifecycleState.resumed) {
          await _idle(tester, ms: 2000);
          if (find.text('CONFIRM & UPLOAD').evaluate().isNotEmpty) break;
          await _waitForReturn(tester, 'camera: take a photo', handOffSeconds: 60);
        }
      }
      await _waitFor(tester, find.text('CONFIRM & UPLOAD'), seconds: 60);
      _say('STEP retake: ACTION - take another photo');
      await tester.tap(find.byIcon(Icons.refresh).first);
      await _idle(tester);
      await _tapText(tester, 'OPEN CAMERA');
      await _waitForReturn(tester, 'camera: take another photo', handOffSeconds: 60);
      await _tapText(tester, 'CONFIRM & UPLOAD');
      await _waitFor(tester, find.text('ENABLE LOCATION'), seconds: 90); // a real photo can take a while

    }
    final pToken = (await SharedPreferences.getInstance()).getString('token');
    final pId = (await SharedPreferences.getInstance()).getString('userId');

    await _waitFor(tester, find.text('ENABLE LOCATION'));
    if (!_skipDeny) {
      // ---------------- Location: services off, denied twice, then no internet (map + address)
      _say('STEP location services off');
      await _waitFor(tester, find.text('ENABLE LOCATION'));
      await _pc('LOC-OFF');
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitForReturn(tester, 'location settings (watcher presses Back)');
      note('after location services off: ${_onScreen()}');
      await _pc('LOC-ON');

      _say('STEP 019: ACTION - tap Don\'t allow on the location popup, twice when asked');
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitForReturn(tester, 'location popup #1: tap Don\'t allow');
      await _waitFor(tester, find.text('Location permission is required.'));
      await _idle(tester, ms: 3500);
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitForReturn(tester, 'location popup #2: tap Don\'t allow');
      await _idle(tester, ms: 1500);
      note('after the second deny: ${_onScreen()}');
      // Android now treats it as "don't ask again": the next try sends people to Settings.
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitForReturn(tester, 'app settings (watcher presses Back)', handOffSeconds: 10).catchError((Object e) {
        note('third try did not open Settings: $e');
      });
      await _pc('GRANT-LOC');

    } else {
      await _pc('GRANT-LOC');
    }
    // Settings closing can take the app back a screen; return to the location step.
    if (find.text('Cart Details').hitTestable().evaluate().isNotEmpty) await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('ENABLE LOCATION'));

    _say('STEP no internet: map and address lookup fail, the cart still saves');
    await _pc('INET-OFF', wait: 8);
    await _idle(tester, ms: 3000);
    await _tapText(tester, 'ENABLE LOCATION');
    await _waitFor(tester, find.text('CONTINUE'), seconds: 60);
    note('location screen offline: ${_onScreen()}');
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('CONFIRM & CONTINUE'));
    note('confirm screen offline: ${_onScreen()}');
    await _tapText(tester, 'CONFIRM & CONTINUE');
    await _waitFor(tester, find.text('Add Menu'), seconds: 30);
    await _pc('INET-ON');
    final carts = (await _call('GET', '/carts/get-all-carts/$pId', token: pToken))['carts'] as List;
    final gamma = carts.firstWhere((c) => c['cartName'] == 'QA-More Gamma');
    note('saved address without internet: "${gamma['address']}"');
    expect(((gamma['location'] as Map)['coordinates'] as List).length, 2);

    // ---------------- Add Menu: validation, non-veg, suggestion
    _say('STEP add menu');
    await _idle(tester);
    if (find.widgetWithText(TextField, 'Item Name').hitTestable().evaluate().isEmpty) await _tapText(tester, '+ ADD ITEM');
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Please fill all item details correctly.'));
    await tester.enterText(find.widgetWithText(TextField, 'Item Name').hitTestable().first, 'mas');
    await _idle(tester, ms: 1500);
    final hasSuggestion = find.text('Masala Dosa').hitTestable().evaluate().isNotEmpty;
    note('suggestions for "mas": $hasSuggestion');
    if (hasSuggestion) {
      await tester.tap(find.text('Masala Dosa').hitTestable().first);
    } else {
      await tester.enterText(find.widgetWithText(TextField, 'Item Name').hitTestable().first, 'Masala Dosa');
    }
    await _idle(tester);
    // A name but a blank price is refused (Rs0 itself is allowed: free add-ons).
    await tester.enterText(find.widgetWithText(TextField, '0').hitTestable().last, '');
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Please fill all item details correctly.'));
    await _idle(tester, ms: 3500);
    await tester.enterText(find.byType(TextField).hitTestable().at(1), '60');
    await _tapText(tester, 'Non-Veg');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _tapText(tester, 'SAVE & CONTINUE');
    await _waitFor(tester, find.text('Menu Review'));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('My staff also runs it')); // saved once setup opens
    final menu = (await _call('GET', '/carts/get-menu-items/${gamma['_id']}'))['data'] as List;
    expect(menu.map((i) => '${i['name']}|${i['price']}|${i['isVeg']}'), ['Masala Dosa|60|false']);

    // ---------------- Staff form: invalid number
    _say('STEP staff invalid number');
    await _tapText(tester, 'My staff also runs it');
    await _tapText(tester, 'ADD STAFF MEMBERS');
    await _waitFor(tester, find.text('Add Helper'));
    final staffFields = find.descendant(of: find.byType(AddStaffForm), matching: find.byType(EditableText));
    await tester.enterText(staffFields.at(0), 'QA Bad');
    await tester.enterText(staffFields.at(1), '12345');
    await _tapText(tester, 'SEND DETAILS');
    await _waitFor(tester, find.text('Enter a valid 10-digit number'));

    // ---------------- Your Carts for vendor V: several carts, search, refresh, finished cart, share
    _say('STEP Your Carts as vendor V');
    for (var i = 0; i < 12 && find.text('+ ADD NEW OUTLET').evaluate().isEmpty; i++) {
      await _back(tester);
    }
    await _back(tester); // leaving Your Carts logs P out
    // Back lands on whichever login P used: sign-up, or the PIN screen.
    await _idle(tester);
    if (find.text('LOG IN').hitTestable().evaluate().isEmpty) {
      await _waitFor(tester, find.text('SEND OTP').hitTestable());
      await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
    }
    expect((await SharedPreferences.getInstance()).getString('token'), isNull, reason: 'back logged out');
    final pinFields = find.byType(TextField).hitTestable();
    await _waitFor(tester, find.text('LOG IN'));
    await tester.enterText(pinFields.at(0), vPhone);
    await tester.enterText(pinFields.at(1), v['pin'] as String);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await _tapText(tester, 'LOG IN');
    await _waitFor(tester, find.text('QA-More Beta'));
    expect(find.text('QA-More Alpha'), findsOneWidget);
    final search = find.byType(TextField).hitTestable().first;
    await tester.enterText(search, 'beta');
    await _idle(tester);
    expect(find.text('QA-More Alpha'), findsNothing);
    expect(find.text('QA-More Beta'), findsOneWidget);
    await tester.enterText(search, 'zzz');
    await _idle(tester);
    expect(find.text("No outlets found matching 'zzz'"), findsOneWidget);
    await tester.enterText(search, '');
    await _idle(tester);
    // Pull to refresh shows a cart added meanwhile.
    await newCart('QA-More Delta');
    await tester.fling(find.text('QA-More Alpha').hitTestable().first, const Offset(0, 500), 1500);
    await _waitFor(tester, find.text('QA-More Delta'));

    // A finished cart reopens at its poster; sharing opens the share sheet.
    await _tapText(tester, 'QA-More Alpha');
    await _waitFor(tester, find.text('Cart Details'));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('SHARE QR'), seconds: 40);
    await _idle(tester, ms: 3000);
    await _tapText(tester, 'SHARE QR');
    await _waitForReturn(tester, 'share sheet (watcher presses Back)', handOffSeconds: 30);
    await _waitFor(tester, find.text('BACK TO OUTLETS'));
    await _tapText(tester, 'BACK TO OUTLETS');
    await _waitFor(tester, find.text('+ ADD NEW OUTLET'));

    // An expired / bad login on Your Carts.
    _say('STEP expired login');
    await prefs.setString('token', 'expired.token.value');
    final ctx = tester.element(find.text('+ ADD NEW OUTLET'));
    await Provider.of<AuthProvider>(ctx, listen: false).loadToken();
    await tester.fling(find.text('QA-More Alpha').hitTestable().first, const Offset(0, 500), 1500);
    await _idle(tester, ms: 4000);
    note('Your Carts with an expired login: ${_onScreen()}');

    _say('NOTES\n${notes.join('\n')}');
    binding.shouldPropagateDevicePointerEvents = false;
  });
}
