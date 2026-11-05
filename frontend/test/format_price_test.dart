import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/utils/format_price.dart';
import 'package:gullyeats/features/menu/widgets/edit_menu_dialog.dart';

void main() {
  test('formatPrice drops .0 from whole rupees and keeps real decimals', () {
    expect(formatPrice(60), '60');
    expect(formatPrice(60.0), '60');
    expect(formatPrice(1250), '1250');
    expect(formatPrice(12500.5), '12500.50');
  });

  testWidgets('the edit sheet prefills the price as "60", not "60.0"', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EditMenuDialog(initialName: 'Dosa', initialPrice: 60, initialIsVeg: true),
        ),
      ),
    );
    // The field only accepts digits, so typing after "60.0" turned into 6005.
    final price = tester.widget<TextField>(find.byType(TextField).at(1));
    expect(price.controller!.text, '60');
  });
}
