// FLT-VEN device tests, part 7: menu list and search, add item with checks,
// veg / stock, edit item and its checks, delete, stock filters, new-order
// search and empty sheet, the order card's items and total. Run like vendor_flow_test.dart.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';

import 'qa.dart';

Future<List<Map<String, dynamic>>> _menu(Map<String, dynamic> v) async =>
    ((await api('GET', '/carts/get-menu-items/${v['cartId']}'))['data'] as List).cast<Map<String, dynamic>>();

Future<Map<String, dynamic>?> _item(Map<String, dynamic> v, String name) async =>
    (await _menu(v)).where((m) => m['name'] == name).firstOrNull;

/// The icon [icon] on the row that shows [name].
Finder _rowIcon(String name, IconData icon) => find
    .descendant(of: find.ancestor(of: find.text(name), matching: find.byType(Row)), matching: find.byIcon(icon))
    .first;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN menu: search, add, edit, delete, stock filters, new-order search, card', (tester) async {
    final v = await onboard();
    final token = v['token'] as String;
    // FLT-VEN-053 (part): a two-line order's card shows its items and total. ('+N more' needs 4+ lines: not covered.)
    final big = await api('POST', '/orders/create-order', body: {
      'cartId': v['cartId'],
      'orderItems': [
        {'menuItemId': (v['menu'] as List)[0]['_id'], 'quantity': 2},
        {'menuItemId': (v['menu'] as List)[1]['_id'], 'quantity': 1},
      ],
    });
    expect(big['status'], 201);
    final order = big['data'] as Map;

    await login(tester, v);
    await waitFor(tester, find.text('#${order['orderNumber']}'));
    expect(find.text('₹${(order['totalPrice'] as num).round()}'), findsWidgets);
    expect(find.textContaining('Masala Dosa'), findsWidgets);

    // FLT-VEN-062/065: new-order sheet search, and nothing can be created empty.
    await noSnackBar(tester);
    await tester.tap(find.byIcon(Icons.add).first);
    await waitFor(tester, find.text('Create Order'));
    await idle(tester);
    final sheet = find.byType(AddNewOrder);
    final search = find.descendant(of: sheet, matching: find.byType(TextField)).first;
    await typeInto(tester, search, 'dosa');
    await idle(tester);
    expect(find.descendant(of: sheet, matching: find.text('Masala Dosa')), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.text('Pani Puri')), findsNothing);
    await typeInto(tester, search, 'zzz');
    await waitFor(tester, find.text('No menu items found'));
    final before = ((await api('GET', '/orders/orders-today/${v['cartId']}', token: token))['data'] as List).length;
    await tester.tap(find.text('MARK AS PAID'), warnIfMissed: false);
    await tester.tap(find.text('SKIP'), warnIfMissed: false);
    await idle(tester, ms: 2000);
    expect(((await api('GET', '/orders/orders-today/${v['cartId']}', token: token))['data'] as List).length, before,
        reason: 'no order with no items');
    await tester.tap(find.byIcon(Icons.close));
    await idle(tester);

    // FLT-VEN-066: Menu Management lists the items and searches them.
    await tester.tap(find.text('Profile').last);
    await tapText(tester, 'Menu Management');
    await waitFor(tester, find.text('Pani Puri'));
    final menuSearch = find.byType(TextField).first;
    await typeInto(tester, menuSearch, 'puri');
    await idle(tester);
    expect(find.text('Pani Puri'), findsOneWidget);
    expect(find.text('Masala Dosa'), findsNothing);
    await typeInto(tester, menuSearch, 'zzz');
    await waitFor(tester, find.text('No menu items found'));
    await typeInto(tester, menuSearch, '');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester);

    // FLT-VEN-067: add-item checks on the phone.
    await tapText(tester, '+ ADD ITEM');
    await waitFor(tester, find.text('Add New Item'));
    await idle(tester);
    await tapText(tester, 'ADD ITEM');
    await waitFor(tester, find.text('Item name is required'));
    expect(find.text('Price is required'), findsOneWidget);
    final form = find.byType(TextField);
    await typeInto(tester, form.at(0), 'A');
    await tester.showKeyboard(form.at(1));
    await tester.enterText(form.at(1), '-5'); // the digits-only filter drops the '-'
    await tester.pump();
    final typed = (tester.widget(form.at(1)) as TextField).controller?.text;
    expect(typed, '5', reason: 'the price field only takes digits');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tapText(tester, 'ADD ITEM');
    await waitFor(tester, find.text('Item name must be at least 2 characters'));

    // FLT-VEN-069: a Non-Veg, out-of-stock item is saved that way.
    await typeInto(tester, form.at(0), 'QA Samosa');
    await typeInto(tester, form.at(1), '15');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await idle(tester);
    await tapText(tester, 'Non-Veg');
    await tapText(tester, 'Out of Stock');
    await tapText(tester, 'ADD ITEM');
    await waitFor(tester, find.text('Added Item Successfully'));
    final samosa = await _item(v, 'QA Samosa');
    expect(samosa, isNotNull);
    expect(samosa!['price'], 15);
    expect(samosa['isVeg'], false);
    expect(samosa['isInStock'], false);
    await noSnackBar(tester);

    // FLT-VEN-077: the stock page filters and searches.
    await tester.binding.handlePopRoute(); // back to Profile
    await idle(tester);
    await tester.tap(find.text('Orders').last);
    await idle(tester);
    final stockTab = find.text('Stock').first;
    await tester.ensureVisible(stockTab);
    await idle(tester, ms: 300);
    await tester.tap(stockTab);
    await waitFor(tester, find.text('QA Samosa'));
    await tester.tap(find.text('Out of Stock').first);
    await idle(tester);
    expect(find.text('QA Samosa'), findsOneWidget);
    expect(find.text('Pani Puri'), findsNothing);
    await tester.tap(find.text('In Stock').first);
    await idle(tester);
    expect(find.text('QA Samosa'), findsNothing);
    expect(find.text('Pani Puri'), findsOneWidget);
    await tester.tap(find.text('All Items').first);
    await idle(tester);
    await typeInto(tester, find.byType(TextField).first, 'samosa');
    await idle(tester);
    expect(find.text('QA Samosa'), findsOneWidget);
    expect(find.text('Masala Dosa'), findsNothing);
    await tester.binding.handlePopRoute();
    await idle(tester);

    // FLT-VEN-073/072: edit checks, then a new price; the order keeps its old price.
    await tester.tap(find.text('Profile').last);
    await tapText(tester, 'Menu Management');
    await waitFor(tester, find.text('Masala Dosa'));
    await tester.tap(_rowIcon('Masala Dosa', Icons.edit_outlined));
    await waitFor(tester, find.text('UPDATE ITEM'));
    await idle(tester);
    // The edit sheet sits over the menu list: field 0 is the list's search bar.
    final edit = find.byType(TextField);
    final editName = edit.at(1);
    await typeInto(tester, editName, '');
    await typeInto(tester, edit.last, ''); // blank is refused; Rs0 is allowed (free add-ons)
    await tapText(tester, 'UPDATE ITEM');
    await waitFor(tester, find.text('Item name cannot be empty'));
    expect(find.text('Please enter a valid price'), findsOneWidget); // for the blank price
    await typeInto(tester, editName, 'Masala Dosa Special');
    await typeInto(tester, edit.last, '65');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tapText(tester, 'UPDATE ITEM');
    await waitFor(tester, find.text('Item updated successfully!'));
    final dosa = await _item(v, 'Masala Dosa Special');
    expect(dosa?['price'], 65);
    final kept = (await api('GET', '/orders/order/${order['_id']}', token: token))['data'] as Map;
    final line = (kept['orderItems'] as List).first as Map;
    expect(line['price'], 60, reason: 'ordered prices never change');
    await noSnackBar(tester);

    // FLT-VEN-074: delete asks first; Cancel keeps it; Delete removes it; the order keeps the line.
    await tester.tap(_rowIcon('Pani Puri', Icons.delete_outline));
    await waitFor(tester, find.text('Delete Item?'));
    await tester.tap(find.text('CANCEL'));
    await idle(tester);
    expect(await _item(v, 'Pani Puri'), isNotNull);
    await tester.tap(_rowIcon('Pani Puri', Icons.delete_outline));
    await waitFor(tester, find.text('Delete Item?'));
    await tester.tap(find.text('DELETE').last);
    await waitFor(tester, find.text('Item deleted successfully!'));
    expect(await _item(v, 'Pani Puri'), isNull);
    final after = (await api('GET', '/orders/order/${order['_id']}', token: token))['data'] as Map;
    expect((after['orderItems'] as List).map((i) => i['name']), contains('Pani Puri'));
    await idle(tester, ms: 2000);
  });
}
