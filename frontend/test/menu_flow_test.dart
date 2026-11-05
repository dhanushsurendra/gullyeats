import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/menu/screens/add_menu_screen.dart';

import 'responsive/harness.dart';

void main() {
  Future<void> addItemAndOpenReview(WidgetTester tester) async {
    await tester.pumpWidget(buildApp(TestProviders(), const AddMenuScreen()));
    await tester.tap(find.text('+ ADD ITEM'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(0), 'Masala Dosa');
    await tester.enterText(find.byType(TextField).at(1), '60');
    await tester.tap(find.text('SAVE & CONTINUE'));
    await tester.pumpAndSettle();
    expect(find.text('Menu Review'), findsOneWidget);
  }

  Future<void> deleteOnReview(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pump();
    expect(find.text('Masala Dosa'), findsNothing);
  }

  testWidgets('deleting on review sticks after the back arrow', (tester) async {
    await addItemAndOpenReview(tester);
    await deleteOnReview(tester);

    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pumpAndSettle();

    expect(find.text('Add Menu'), findsOneWidget);
    expect(find.text('Masala Dosa'), findsNothing);
  });

  testWidgets('deleting on review sticks after system back', (tester) async {
    await addItemAndOpenReview(tester);
    await deleteOnReview(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('Add Menu'), findsOneWidget);
    expect(find.text('Masala Dosa'), findsNothing);
  });
}
