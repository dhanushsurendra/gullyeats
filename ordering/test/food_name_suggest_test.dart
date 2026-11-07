import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/models/food_name_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';

void main() {
  test('suggests by any word, in English or the app language, prefix matches first', () {
    final provider = MenuProvider();
    provider.debugSetFoodNames([
      for (final j in jsonDecode('''[
        {"name":"Pani Puri","kn":"ಪಾನಿ ಪುರಿ"},
        {"name":"Masala Dosa","kn":"ಮಸಾಲಾ ದೋಸೆ"},
        {"name":"Mysore Masala Dosa","kn":"ಮೈಸೂರ್ ಮಸಾಲಾ ದೋಸೆ"},
        {"name":"Gulab Jamun"}
      ]'''))
        FoodNameModel.fromJson(j),
    ]);

    LanguageProvider.current = const Locale('en');
    expect(provider.suggestFoodNames('mas').map((n) => n.name), ['Masala Dosa', 'Mysore Masala Dosa']);
    expect(provider.suggestFoodNames('osa').map((n) => n.name), ['Masala Dosa', 'Mysore Masala Dosa']);
    expect(provider.suggestFoodNames('  '), isEmpty);

    LanguageProvider.current = const Locale('kn');
    expect(provider.suggestFoodNames('ದೋಸೆ').map((n) => n.name), ['Masala Dosa', 'Mysore Masala Dosa']);
    expect(provider.suggestFoodNames('gul').single.displayName, 'Gulab Jamun');
  });
}
