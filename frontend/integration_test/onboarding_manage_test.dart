// FLT-ONB device test with a person at the phone: the real sign-up (OTP),
// camera photo and SMS hand-offs, plus editing and deleting menu items and
// staff. The test waits (up to 3 minutes) at each step that needs a person:
//
//   1. SEND OTP opens the SMS app with "Code - NNNNNN" as a draft. Read the
//      code, press Back (don't send), and type it into the app.
//   2. Cart Photo: tap OPEN CAMERA and take any photo.
//   3. Each staff member added opens the SMS app with their PIN: press Back.
//   4. Send Credentials opens the SMS app again: press Back.
//
// Numbers are 60000999xx (cleaned up by `node scripts/qa.js cleanup`).
// Run like onboarding_flow_test.dart, with location granted after install.
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/features/menu/widgets/edit_menu_dialog.dart';
import 'package:gullyeats/features/menu/widgets/menu_review_card.dart';
import 'package:gullyeats/features/menu/widgets/staff_member_card.dart';
import 'package:gullyeats/features/staff_management/widgets/add_staff_form.dart';
import 'package:gullyeats/main.dart' as app;
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Resume an earlier run's vendor at the staff step (no OTP or camera needed):
// --dart-define=RESUME_PHONE=... --dart-define=RESUME_PIN=... --dart-define=RESUME_CART=...
const _resumePhone = String.fromEnvironment('RESUME_PHONE');
const _resumePin = String.fromEnvironment('RESUME_PIN');
const _resumeCart = String.fromEnvironment('RESUME_CART');

final _rand = Random();
String _qaPhone() => '60000999${_rand.nextInt(100).toString().padLeft(2, '0')}';

Future<Map<String, dynamic>> _get(String path) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  final res = await http.get(Uri.parse('${ApiConstants.baseUrl}$path'),
      headers: {'Authorization': 'Bearer ${prefs.getString('token')}'}).timeout(const Duration(seconds: 20));
  return {'status': res.statusCode, ...jsonDecode(res.body) as Map<String, dynamic>};
}

Future<String> _userId() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  return prefs.getString('userId')!;
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
  // A long list can drop it while scrolled away; bring it back first.
  if (find.text(text).evaluate().isEmpty) {
    await tester.scrollUntilVisible(find.text(text), -300, scrollable: find.byType(Scrollable).hitTestable().first);
  }
  await tester.ensureVisible(find.text(text).first);
  await tester.tap(find.text(text).first);
  await tester.pump();
}

/// For a hand-off to another app (SMS, camera): waits until the person comes back.
Future<void> _waitForReturn(WidgetTester tester, String what) async {
  _say('ACTION NEEDED: $what');
  final end = DateTime.now().add(const Duration(minutes: 3));
  var left = false;
  final handOff = DateTime.now().add(const Duration(seconds: 20));
  while (DateTime.now().isBefore(end)) {
    if (!left && DateTime.now().isAfter(handOff)) {
      throw TestFailure('The app never left for: $what. On screen: ${_onScreen()}');
    }
    final state = tester.binding.lifecycleState;
    if (state != AppLifecycleState.resumed) left = true;
    if (left && state == AppLifecycleState.resumed) return _idle(tester);
    // No pumping while away: no frames are drawn, so a pump would wait.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (state == AppLifecycleState.resumed) await tester.pump();
  }
  throw TestFailure('Nobody came back from: $what');
}

Finder _inside(Type parent, Finder child) => find.descendant(of: find.byType(parent), matching: child);

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-ONB sign-up with OTP, camera photo, menu edit/delete, staff add/delete, edit cart, credentials',
      (tester) async {
    // Let the person's own taps reach the app (tests drop them by default).
    binding.shouldPropagateDevicePointerEvents = true;
    // Device tests leave the keyboard to the phone; enterText needs the test's.
    tester.testTextInput.register();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    app.main();

    var phone = _resumePhone;
    var cartName = _resumeCart;
    final resuming = _resumePhone.isNotEmpty;
    if (resuming) {
      // PIN login, reopen the half-done cart, CONTINUE resumes at operating setup.
      _say('STEP PIN login, reopen the half-done cart, CONTINUE resumes at op');
      await _tapText(tester, 'Vendor already onboarded? Log in with PIN');
      await _waitFor(tester, find.text('LOG IN'));
      final f = find.byType(TextField).hitTestable();
      await tester.enterText(f.at(0), _resumePhone);
      await tester.enterText(f.at(1), _resumePin);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await _tapText(tester, 'LOG IN');
      await _tapText(tester, cartName);
      await _waitFor(tester, find.text('Cart Details'));
      await _tapText(tester, 'CONTINUE');
    } else {
      // FLT-ONB-002: a bad number is refused on the phone.
      _say('STEP FLT-ONB-002: a bad number is refused on the phone.');
      await _waitFor(tester, find.text('SEND OTP'));
      await _idle(tester);
      final phoneField = find.byType(TextField).hitTestable().first;
      await tester.enterText(phoneField, '12345');
      await _tapText(tester, 'SEND OTP');
      await _waitFor(tester, find.text('Please enter a valid 10-digit mobile number'));

      // FLT-ONB-001/005: SEND OTP, then the person types the code from the SMS draft.
      _say('STEP FLT-ONB-001/005: SEND OTP, then the person types the code fr');
      phone = _qaPhone();
      await tester.enterText(phoneField, phone);
      await _tapText(tester, 'SEND OTP');
      await _waitForReturn(tester, 'SMS app opened with the code. Read it, press Back, then type it in the app.');
      _say('Type the 6-digit code into the app now.');
      // Hand the real keyboard back for the code, then take it again.
      tester.testTextInput.unregister();
      // Refocus the first box so the phone's own keyboard connects to it.
      await _waitFor(tester, find.text('VERIFY & CONTINUE'));
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await tester.tap(find.byType(EditableText).hitTestable().first);
      await tester.pump();
      await _waitFor(tester, find.text('+ ADD NEW OUTLET'), seconds: 180);
      tester.testTextInput.register();

      // FLT-ONB-012: a new cart.
      _say('STEP FLT-ONB-012: a new cart.');
      cartName = 'QA-Manual ${DateTime.now().millisecondsSinceEpoch % 100000}';
      await _tapText(tester, '+ ADD NEW OUTLET');
      await _waitFor(tester, find.text('Cart Name'));
      await _idle(tester);
      await tester.enterText(find.byType(TextFormField).hitTestable().first, cartName);
      await tester.tap(find.byType(DropdownButton<String>));
      await _idle(tester);
      await tester.tap(find.text('Bangalore').last);
      await _idle(tester);
      await _tapText(tester, 'CONTINUE');

      // FLT-ONB-017: a real camera photo.
      _say('STEP FLT-ONB-017: a real camera photo.');
      await _tapText(tester, 'OPEN CAMERA');
      await _waitForReturn(tester, 'Camera opened: take any photo and accept it.');
      await _tapText(tester, 'CONFIRM & UPLOAD');

      // FLT-ONB-020: location.
      _say('STEP FLT-ONB-020: location.');
      await _tapText(tester, 'ENABLE LOCATION');
      await _waitFor(tester, find.text('CONTINUE'), seconds: 60);
      await _tapText(tester, 'CONTINUE');
      await _tapText(tester, 'CONFIRM & CONTINUE');

      // FLT-ONB-022/025/027: three items, then edit one and delete one on review.
      _say('STEP FLT-ONB-022/025/027: three items, then edit one and delete o');
      await _waitFor(tester, find.text('Add Menu'));
      await _idle(tester);
      const items = [['Masala Dosa', '60'], ['Pani Puri', '30'], ['Chicken Roll', '90']];
      for (var i = 0; i < items.length; i++) {
        if (find.widgetWithText(TextField, 'Item Name').hitTestable().evaluate().length <= i) {
          await _tapText(tester, '+ ADD ITEM');
          await _idle(tester);
        }
        final names = find.widgetWithText(TextField, 'Item Name').hitTestable();
        await tester.ensureVisible(names.at(i));
        await tester.enterText(names.at(i), items[i][0]);
        await tester.enterText(find.widgetWithText(TextField, '0').hitTestable().last, items[i][1]);
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await _idle(tester, ms: 500);
      }
      await _tapText(tester, 'SAVE & CONTINUE');
      await _waitFor(tester, find.text('Menu Review'));
      await _idle(tester);

      // Edit Pani Puri's price to 35.
      _say('STEP Edit Pani Puris price to 35.');
      final puri = find.ancestor(of: find.text('Pani Puri'), matching: find.byType(MenuReviewCard));
      await tester.tap(find.descendant(of: puri, matching: find.byIcon(Icons.edit_outlined)));
      await _waitFor(tester, find.text('Edit Item'));
      await _idle(tester);
      final editFields = _inside(EditMenuDialog, find.byType(TextField));
      await tester.enterText(editFields.at(1), '35');
      await _tapText(tester, 'UPDATE ITEM');
      await _waitFor(tester, find.text('₹35'));

      // Delete Chicken Roll.
      _say('STEP Delete Chicken Roll.');
      final roll = find.ancestor(of: find.text('Chicken Roll'), matching: find.byType(MenuReviewCard));
      await tester.tap(find.descendant(of: roll, matching: find.byIcon(Icons.delete_outline)));
      await _idle(tester);
      expect(find.text('Chicken Roll'), findsNothing);
      await _tapText(tester, 'CONTINUE');

    }

    // FLT-ONB-028/029: staff run it too: add two, a duplicate is refused, delete one.
    _say('STEP FLT-ONB-028/029: staff run it too: add two, a duplicate is r');
    await _tapText(tester, 'My staff also runs it');
    await _tapText(tester, 'ADD STAFF MEMBERS');
    await _waitFor(tester, find.text('Add Helper'));
    final staffFields = _inside(AddStaffForm, find.byType(EditableText));
    final staff = <String>[];
    if (resuming) {
      final cartId = ((await _get('/carts/get-all-carts/${await _userId()}'))['carts'] as List).first['_id'];
      for (final st in (await _get('/carts/get-all-staff/$cartId'))['staff'] as List) {
        staff.add(st['phoneNumber'] as String);
      }
      // Wait for the list to load: the empty note, or the staff the server has.
      await _waitFor(tester, staff.isEmpty ? find.text('No staff added yet') : find.byType(StaffMemberCard));
      await _idle(tester);
    }
    // A resumed run re-adds whoever an earlier run deleted.
    for (final name in ['QA Ravi', 'QA Meena'].where((n) => !resuming || find.text(n).evaluate().isEmpty)) {
      var p = _qaPhone();
      while (p == phone || staff.contains(p)) {
        p = _qaPhone();
      }
      staff.add(p);
      await tester.enterText(staffFields.at(0), name);
      await tester.enterText(staffFields.at(1), p);
      await _tapText(tester, 'SEND DETAILS');
      await _waitForReturn(tester, 'SMS app opened with $name\'s PIN. Press Back.');
      await _waitFor(tester, find.text(name));
    }
    FocusManager.instance.primaryFocus?.unfocus();
    await _idle(tester);
    await tester.scrollUntilVisible(find.text('Add Helper'), -300, scrollable: find.byType(Scrollable).hitTestable().first);
    await _idle(tester);
    if (staffFields.evaluate().length < 2) {
      fail('Staff form fields not found (${staffFields.evaluate().length}; '
          '${find.byType(EditableText).evaluate().length} text fields on screen). On screen: ${_onScreen()}');
    }
    await tester.enterText(staffFields.at(0), 'QA Copy');
    await tester.enterText(staffFields.at(1), staff[0]);
    await _tapText(tester, 'SEND DETAILS');
    await _waitFor(tester, find.text('User with this phone number already exists'));
    // Still typed in the form after the error; it must not be a staff card.
    expect(find.descendant(of: find.byType(StaffMemberCard), matching: find.text('QA Copy')), findsNothing);

    final meena = find.ancestor(of: find.text('QA Meena'), matching: find.byType(StaffMemberCard));
    await tester.ensureVisible(meena);
    await tester.tap(find.descendant(of: meena, matching: find.byIcon(Icons.delete_outline)));
    await _idle(tester, ms: 2500);
    expect(find.text('QA Meena'), findsNothing);
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('Cart Activated'));
    await _tapText(tester, 'CONTINUE');
    await _waitFor(tester, find.text('SHARE QR'), seconds: 40);

    // The server agrees with every edit and delete.
    _say('STEP The server agrees with every edit and delete.');
    final userId = await _userId();
    var carts = (await _get('/carts/get-all-carts/$userId'))['carts'] as List;
    expect(carts.length, 1);
    final cartId = carts.first['_id'] as String;
    final menu = ((await _get('/carts/get-menu-items/$cartId'))['data'] as List)
        .map((i) => '${i['name']}=${i['price']}')
        .toSet();
    expect(menu, {'Masala Dosa=60', 'Pani Puri=35'});
    final staffNames = ((await _get('/carts/get-all-staff/$cartId'))['staff'] as List).map((s) => s['name']).toList();
    expect(staffNames, ['QA Ravi']);
    expect(carts.first['cartImageUrl'], isNotNull);

    // FLT-ONB-014: back to Your Carts, rename the cart, no duplicate.
    _say('STEP FLT-ONB-014: back to Your Carts, rename the cart, no duplica');
    for (var i = 0; i < 15 && find.text('+ ADD NEW OUTLET').evaluate().isEmpty; i++) {
      await tester.binding.handlePopRoute();
      await _idle(tester);
    }
    await _tapText(tester, cartName);
    await _waitFor(tester, find.text('Cart Details'));
    await _idle(tester);
    await tester.enterText(find.byType(TextFormField).hitTestable().first, '$cartName edited');
    await _tapText(tester, 'CONTINUE');
    await _idle(tester, ms: 3000);
    carts = (await _get('/carts/get-all-carts/$userId'))['carts'] as List;
    expect(carts.length, 1);
    expect(carts.first['cartName'], '$cartName edited');

    // FLT-ONB-030: Send Credentials asks first, then opens the SMS app.
    _say('STEP FLT-ONB-030: Send Credentials asks first, then opens the SMS');
    for (var i = 0; i < 15 && find.text('+ ADD NEW OUTLET').evaluate().isEmpty; i++) {
      await tester.binding.handlePopRoute();
      await _idle(tester);
    }
    await _tapText(tester, 'SEND CREDENTIALS');
    await _waitFor(tester, find.text('Send new login PIN?'));
    await _tapText(tester, 'Send');
    await _waitForReturn(tester, 'SMS app opened with the vendor\'s new PIN. Press Back.');
    await _idle(tester, ms: 2000);
    binding.shouldPropagateDevicePointerEvents = false; // the binding checks it is reset
  });
}
