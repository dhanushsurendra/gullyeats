import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/menu/screens/add_menu_screen.dart';
import 'package:gullyeats/features/menu/screens/menu_review_screen.dart';

import 'responsive/harness.dart';

void main() {
  testWidgets('picking a suggestion fills the name that gets saved', (tester) async {
    final p = TestProviders();
    p.menu.debugFoodNames = ['Masala Dosa', 'Mysore Masala Dosa', 'Pani Puri'];
    await tester.pumpWidget(buildApp(p, const AddMenuScreen()));

    await tester.tap(find.text('+ ADD ITEM'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Item Name'), 'mas');
    await tester.pumpAndSettle();

    expect(find.text('Mysore Masala Dosa'), findsOneWidget);
    await tester.tap(find.text('Masala Dosa'));
    await tester.pumpAndSettle();
    expect(find.text('Mysore Masala Dosa'), findsNothing);

    await tester.enterText(find.widgetWithText(TextField, '0'), '60');
    await tester.tap(find.text('SAVE & CONTINUE'));
    await tester.pumpAndSettle();

    final review = tester.widget<MenuReviewScreen>(find.byType(MenuReviewScreen));
    expect(review.menuItems.single.name, 'Masala Dosa');
  });
}
