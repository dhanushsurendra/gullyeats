import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/menu/providers/menu_provider.dart';

void main() {
  test('suggests names with a word starting with the text, then ones containing it', () {
    final provider = MenuProvider()
      ..debugFoodNames = ['Pani Puri', 'Masala Dosa', 'Mysore Masala Dosa', 'Gulab Jamun', 'Rasmalai'];

    expect(provider.suggestFoodNames('mas'), ['Masala Dosa', 'Mysore Masala Dosa']);
    expect(provider.suggestFoodNames(' DOSA '), ['Masala Dosa', 'Mysore Masala Dosa']);
    expect(provider.suggestFoodNames('mal'), ['Rasmalai']);
    expect(provider.suggestFoodNames(''), isEmpty);
    expect(provider.suggestFoodNames('a', limit: 2).length, 2);
  });
}
