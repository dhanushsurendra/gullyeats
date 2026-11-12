// FLT-VEN device tests, part 3: Sales, every Profile feature (cart open
// switch, edit cart, staff, orders overview, payments, theme, change PIN,
// log out) and lost internet. Needs the PC-side watcher:
//
//   bash integration_test/watch.sh flutter test integration_test/vendor_profile_test.dart \
//     -d <device> --dart-define=API_BASE_URL=http://localhost:5050/api \
//     --dart-define=QA_ADMIN_EMAIL=... --dart-define=QA_ADMIN_PASSWORD=...
//
// Adding staff opens the Messages app; watch.sh presses Back. Staff phones
// start 60000999 (qa.js cleanup removes them).
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/features/profile/widgets/add_staff_form.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'qa.dart';

Future<Map<String, dynamic>> _cart(Map<String, dynamic> v) async {
  final carts = await api('GET', '/carts/get-all-carts/${v['userId']}', token: v['token'] as String);
  return ((carts['carts'] ?? carts['data']) as List).cast<Map<String, dynamic>>().firstWhere((c) => c['_id'] == v['cartId']);
}

Future<List> _staff(Map<String, dynamic> v) async =>
    (await api('GET', '/carts/get-all-staff/${v['cartId']}', token: v['token'] as String))['staff'] as List;

Future<void> _nav(WidgetTester tester, String tab) async {
  await noSnackBar(tester);
  await tester.tap(find.text(tab).last);
  await idle(tester);
}

/// Opens a Profile row and waits for [until].
Future<void> _open(WidgetTester tester, String row, Finder until) async {
  await tapText(tester, row);
  await waitFor(tester, until);
  await idle(tester);
}

Future<void> _back(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await idle(tester);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN sales, profile, staff, edit cart, change PIN, log out, offline', (tester) async {
    final v = await onboard();
    final token = v['token'] as String;

    // Today's orders: one served, one unpaid, one cancelled.
    final served = await customerOrder(v);
    await api('PUT', '/orders/mark-order-paid/${served['_id']}', token: token);
    await api('PUT', '/orders/serve-order/${served['_id']}', token: token);
    final unpaid = await customerOrder(v, item: 1);
    final cancelled = await customerOrder(v);
    await api('DELETE', '/orders/delete-order/${cancelled['_id']}', token: token);

    await login(tester, v);

    // FLT-VEN-025/087/091: Sales shows the paid revenue and the missed money.
    await _nav(tester, 'Sales');
    await waitFor(tester, find.text('Total Revenue'));
    await idle(tester, ms: 2000); // the total counts up
    final rev = served['totalPrice'] as num;
    expect(find.text('₹${rev.round()}'), findsWidgets, reason: onScreen());
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final insights = await api('GET', '/carts/sales-insights/${v['cartId']}?startDate=$today&endDate=$today', token: token);
    expect((insights['data'] as Map)['revenue'], rev, reason: 'API revenue = paid orders only');
    await tester.ensureVisible(find.text('Missed money'));
    await idle(tester);
    expect(find.text('1 unpaid · ₹${(unpaid['totalPrice'] as num).round()}'), findsOneWidget, reason: onScreen());
    expect(find.text('1 cancelled · ₹${(cancelled['totalPrice'] as num).round()}'), findsOneWidget, reason: onScreen());

    // FLT-VEN-122: no internet when marking an order paid: a message, nothing changes.
    await _nav(tester, 'Orders');
    await waitFor(tester, find.text('#${unpaid['orderNumber']}'));
    await netOff(tester);
    await tester.tap(find.byKey(const ValueKey('paid')).first);
    await waitFor(tester, find.textContaining('internet'), seconds: 25);
    await netOn(tester);
    expect(await orderStatus(v, unpaid['_id'] as String), 'PENDING');
    await idle(tester, ms: 3000);

    // FLT-VEN-021: closing the cart from Profile stops customer orders.
    await _nav(tester, 'Profile');
    await waitFor(tester, find.text('Cart Open'));
    await tester.tap(find.byType(Switch).first);
    await waitFor(tester, find.text('Closed'));
    for (var i = 0; i < 20 && (await _cart(v))['isOpen'] != false; i++) {
      await idle(tester, ms: 250);
    }
    expect((await _cart(v))['isOpen'], false);
    final refused = await customerOrderRaw(v);
    expect(refused['status'], 403);
    expect('${refused['message']}', contains('not taking orders'));
    await tester.tap(find.byType(Switch).first);
    await waitFor(tester, find.text('Cart Open'));

    // FLT-VEN-079/080: edit cart: empty name refused, back asks first, valid save.
    await tester.tap(find.byIcon(Icons.edit_outlined));
    await waitFor(tester, find.text('Edit Cart Details'));
    await idle(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '');
    await tapText(tester, 'SAVE CHANGES');
    await waitFor(tester, find.text("Cart name can't be empty."));
    await tester.binding.handlePopRoute();
    await waitFor(tester, find.text('Discard changes?'));
    await tester.tap(find.text('Keep Editing'));
    await idle(tester);
    expect(find.text('Edit Cart Details'), findsOneWidget);
    final newName = '${v['cartName']} R';
    await tester.enterText(fields.at(0), newName);
    await tester.enterText(fields.at(2), '5');
    await idle(tester, ms: 3000); // let the error snackbar go

    // FLT-VEN-122: saving offline keeps the screen and changes nothing.
    await netOff(tester);
    await tapText(tester, 'SAVE CHANGES');
    await waitFor(tester, find.textContaining('internet'), seconds: 25);
    expect(find.text('Edit Cart Details'), findsOneWidget);
    await netOn(tester);
    expect((await _cart(v))['cartName'], v['cartName']);
    await noSnackBar(tester);
    await tapText(tester, 'SAVE CHANGES');
    await waitFor(tester, find.text('Cart details updated!'));
    final saved = await _cart(v);
    expect(saved['cartName'], newName);
    expect(saved['parcelCharge'], 5);
    await waitFor(tester, find.text('Cart Details')); // back on Profile
    await idle(tester, ms: 3000);

    // FLT-VEN-116/117/118: staff: checks, add (SMS opens), duplicate refused, remove.
    await _open(tester, 'Staff Management', find.text('SEND DETAILS'));
    await waitFor(tester, find.text('No staff added yet'));
    final form = find.descendant(of: find.byType(AddStaffForm), matching: find.byType(TextField));
    await tapText(tester, 'SEND DETAILS');
    await waitFor(tester, find.text('Name is required'));
    expect(find.text('Phone number is required'), findsOneWidget);
    await tester.enterText(form.at(0), 'A');
    await tester.enterText(form.at(1), '12345');
    await tapText(tester, 'SEND DETAILS');
    await waitFor(tester, find.text('Enter a valid name'));
    expect(find.text('Enter a valid 10-digit number'), findsOneWidget);
    final staffPhone = '60000999${Random().nextInt(100).toString().padLeft(2, '0')}';
    await tester.enterText(form.at(0), 'QA Helper');
    await tester.enterText(form.at(1), staffPhone);
    await tapText(tester, 'SEND DETAILS');
    // The Messages app opens over the app; no frames while it is in front.
    await Future<void>.delayed(const Duration(seconds: 4));
    say('BACK'); // watch.sh presses Back until Messages is gone (up to ~8 s)
    await Future<void>.delayed(const Duration(seconds: 10));
    await waitFor(tester, find.text('QA Helper'));
    expect((await _staff(v)).map((s) => s['phoneNumber']), [staffPhone]);
    await idle(tester, ms: 3000);
    await tester.enterText(form.at(0), 'QA Twin');
    await tester.enterText(form.at(1), staffPhone);
    await tapText(tester, 'SEND DETAILS');
    await waitFor(tester, find.text('User with this phone number already exists'));
    expect((await _staff(v)).length, 1);
    await noSnackBar(tester);
    // The staff list is a lazy ListView: scroll the card into being first.
    final list = find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first;
    await tester.scrollUntilVisible(find.byIcon(Icons.more_vert), 200, scrollable: list);
    await idle(tester);
    await tester.tap(find.byIcon(Icons.more_vert));
    await idle(tester);
    await tester.tap(find.text('Remove').last);
    await waitFor(tester, find.text('Remove Staff?'));
    await tester.tap(find.text('REMOVE'));
    await idle(tester, ms: 2000);
    await tester.scrollUntilVisible(find.text('No staff added yet'), 200, scrollable: list);
    expect(find.text('QA Helper'), findsNothing);
    expect(await _staff(v), isEmpty);
    await _back(tester);

    // FLT-VEN-060: Orders Overview lists today's orders.
    String label(Map o) => '#${o['orderNumber']} · ${(o['_id'] as String).substring((o['_id'] as String).length - 5)}';
    await _open(tester, 'Orders Overview', find.text(label(served)));
    expect(find.text(label(unpaid)), findsOneWidget);
    await _back(tester);

    // FLT-VEN-103: Payments History with no payments.
    await _open(tester, 'Payments History', find.text('No transactions in this period yet'));
    await _back(tester);

    // FLT-VEN-113: dark theme switch flips the theme and is saved.
    final wasDark = Theme.of(tester.element(find.text('Cart Details'))).brightness == Brightness.dark;
    await tapText(tester, 'Dark theme');
    await idle(tester);
    expect(Theme.of(tester.element(find.text('Cart Details'))).brightness == Brightness.dark, !wasDark);
    expect((await SharedPreferences.getInstance()).getBool('darkTheme'), !wasDark);
    await tapText(tester, 'Dark theme');
    await idle(tester);

    // FLT-VEN-033/108/107: change PIN: phone-side rules, wrong current PIN, success.
    final pin = v['pin'] as String;
    final newPin = pin == '4826' ? '4827' : '4826';
    await _open(tester, 'Security & Login', find.text('UPDATE PIN'));
    final pins = find.byType(TextField);
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('Current PIN is required'));
    expect(find.text('New PIN is required'), findsOneWidget, reason: onScreen());
    expect(find.text('Confirm your PIN'), findsOneWidget, reason: onScreen());
    await tester.enterText(pins.at(0), pin);
    await tester.enterText(pins.at(1), '12');
    await tester.enterText(pins.at(2), '12');
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('PIN must be 4 digits'));
    await tester.enterText(pins.at(1), newPin);
    await tester.enterText(pins.at(2), '9999');
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('PIN does not match'));
    await tester.enterText(pins.at(1), pin);
    await tester.enterText(pins.at(2), pin);
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('New PIN cannot be same as current PIN'));
    await tester.enterText(pins.at(0), pin == '0000' ? '1111' : '0000');
    await tester.enterText(pins.at(1), newPin);
    await tester.enterText(pins.at(2), newPin);
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('Incorrect current PIN'));
    await noSnackBar(tester);
    await tester.enterText(pins.at(0), pin);
    await tapText(tester, 'UPDATE PIN');
    await waitFor(tester, find.text('PIN updated successfully'));
    await waitFor(tester, find.text('Cart Details')); // back on Profile
    await noSnackBar(tester);

    // FLT-VEN-115: log out clears the session.
    await tapText(tester, 'LOG OUT');
    await waitFor(tester, find.text('LOGIN'));
    expect((await SharedPreferences.getInstance()).getString('token'), isNull);

    // FLT-VEN-043: no internet at login: a message, still on login.
    final loginFields = find.byType(TextField);
    await tester.enterText(loginFields.at(0), v['phone'] as String);
    await tester.enterText(loginFields.at(1), newPin);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await netOff(tester);
    await tester.tap(find.text('LOGIN'));
    await waitFor(tester, find.textContaining('internet'), seconds: 25);
    expect(find.text('LOGIN'), findsOneWidget);
    await netOn(tester);
    await noSnackBar(tester);

    // FLT-VEN-107: the old PIN no longer works; the new one does.
    // After the offline try the field can miss enterText: focus it first, then check.
    await tester.tap(loginFields.at(1));
    await tester.pump();
    await tester.enterText(loginFields.at(1), pin);
    await tester.pump();
    expect((tester.widget(loginFields.at(1)) as TextField).controller?.text, pin);
    await tester.tap(find.text('LOGIN'));
    await idle(tester, ms: 1000);
    // Wait for the answer: the button shows a spinner (no LOGIN text) meanwhile.
    await waitFor(tester, find.text('LOGIN').evaluate().isEmpty ? find.byWidgetPredicate((w) =>
        w is Text && (w.data == 'LOGIN' || w.data == newName)) : find.text('LOGIN'), seconds: 40);
    expect(find.text(newName), findsNothing, reason: 'the old PIN must not log in');
    expect(find.text('LOGIN'), findsOneWidget);
    await noSnackBar(tester);
    await login(tester, {...v, 'pin': newPin, 'cartName': newName}, start: false);
    await idle(tester, ms: 2000);
  });
}
