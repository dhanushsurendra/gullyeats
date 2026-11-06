import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/screens/add_new_item.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets('an item can be added without a photo', (tester) async {
    final sent = <Map<String, dynamic>>[];
    final client = MockClient((request) async {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      sent.add(body);
      return http.Response(jsonEncode({'data': {...body, '_id': 'new'}}), 201);
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => MenuProvider()),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: AddItemScreen(),
        ),
      ),
    );

    await http.runWithClient(() async {
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Masala Dosa');
      await tester.enterText(fields.at(1), '60');
      final add = find.text('ADD ITEM');
      await tester.ensureVisible(add);
      await tester.tap(add);
      await tester.pumpAndSettle();
    }, () => client);

    expect(sent, hasLength(1));
    expect(sent.single['name'], 'Masala Dosa');
    expect(sent.single['price'], 60);
    expect(sent.single['imageUrl'], '');
  });
}
