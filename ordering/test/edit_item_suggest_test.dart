import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/models/food_name_model.dart';
import 'package:ordering/features/orders/widgets/edit_menu_dialog.dart';

import 'responsive/harness.dart';

void main() {
  testWidgets('picking a suggestion fills the English and the local name', (tester) async {
    final p = TestProviders();
    p.menu.debugSetFoodNames(const [
      FoodNameModel(name: 'Masala Dosa', names: {'kn': 'ಮಸಾಲಾ ದೋಸೆ'}),
      FoodNameModel(name: 'Pani Puri', names: {'kn': 'ಪಾನಿ ಪುರಿ'}),
    ]);
    tester.view.physicalSize = const Size(1080, 2400);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(buildApp(
      p,
      const Scaffold(
        body: EditMenuDialog(
          initialName: 'Dosa',
          initialNames: {'kn': 'ದೋಸೆ'},
          initialPrice: 40,
          initialIsVeg: true,
          initialInStock: true,
          initialImageUrl: '',
          id: 'm1',
          cartId: 'c1',
        ),
      ),
      locale: 'kn',
    ));

    await tester.enterText(find.byType(TextField).first, 'mas');
    await tester.pumpAndSettle();
    expect(find.text('Masala Dosa'), findsOneWidget); // English under the Kannada name
    await tester.tap(find.text('ಮಸಾಲಾ ದೋಸೆ'));
    await tester.pumpAndSettle();

    String field(int i) =>
        tester.widget<TextField>(find.byType(TextField).at(i)).controller!.text;
    expect(field(0), 'Masala Dosa');
    expect(field(1), 'ಮಸಾಲಾ ದೋಸೆ');
    expect(find.text('Pani Puri'), findsNothing);
  });
}
