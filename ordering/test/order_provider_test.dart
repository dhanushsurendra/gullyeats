import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';

Map<String, dynamic> item(String id, String name, num price) => {
  '_id': id,
  'name': name,
  'price': price,
  'isVeg': true,
  'isInStock': true,
  'cartId': 'cart1',
};

Future<OrderProvider> providerWithMenu() async {
  final provider = OrderProvider();
  final client = MockClient(
    (request) async => http.Response(
      jsonEncode({
        'data': [item('dosa', 'Dosa', 40), item('tea', 'Tea', 10)],
      }),
      200,
    ),
  );
  await http.runWithClient(() => provider.loadMenu('token', 'cart1'), () => client);
  return provider;
}

void main() {
  test('editing keeps ordered prices and items no longer on the menu', () async {
    final provider = await providerWithMenu();

    provider.startEditing(
      OrderModel.fromJson({
        '_id': 'o1',
        'status': 'PAID',
        'totalPrice': 77,
        'parcelCharge': 5,
        'orderItems': [
          {'menuItemId': 'dosa', 'name': 'Dosa', 'price': 30, 'quantity': 2},
          {'menuItemId': 'vada', 'name': 'Vada', 'price': 10, 'quantity': 1},
        ],
      }),
    );

    expect(provider.subtotal, 70);
    expect(provider.total, 77);
    expect(provider.orderItems.map((i) => i['menuItemId']), ['dosa', 'vada']);
    expect(
      provider.menu.firstWhere((i) => i.id == 'tea').price,
      10,
      reason: 'items not in the order keep the menu price',
    );
  });

  test('parcel charge typed before adding items applies once items exist', () async {
    final provider = await providerWithMenu();
    provider.clearOrder();

    provider.setParcelPrice(10);
    expect(provider.total, 0);

    provider.addItem(provider.menu.first);
    expect(provider.parcelPrice, 10);
    expect(provider.total, 40 + 10 + 2);

    provider.removeItem(provider.menu.first);
    expect(provider.total, 0);

    provider.addItem(provider.menu.first);
    expect(provider.parcelPrice, 10, reason: 'removing items keeps the typed value');
  });

  test('old orders without paidAmount count as fully paid when PAID', () {
    expect(OrderModel.fromJson({'status': 'PAID', 'totalPrice': 50}).paidAmount, 50);
    expect(OrderModel.fromJson({'status': 'PENDING', 'totalPrice': 50}).paidAmount, 0);
    expect(
      OrderModel.fromJson({'status': 'PENDING', 'totalPrice': 60, 'paidAmount': 50}).paidAmount,
      50,
    );
  });
}
