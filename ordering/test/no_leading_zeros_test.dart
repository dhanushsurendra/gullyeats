import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/screens/add_new_order.dart';

void main() {
  test('money fields drop leading zeros, but a lone 0 stays', () {
    String type(String text) => noLeadingZeros
        .formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: text))
        .text;
    expect(type('060'), '60');
    expect(type('0060'), '60');
    expect(type('0'), '0');
    expect(type('60'), '60');
    expect(type('100'), '100');
    expect(type(''), '');
  });
}
