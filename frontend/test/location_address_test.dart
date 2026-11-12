import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/features/onboarding/services/cart_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Future<Map<String, dynamic>> _sent(Placemark placemark) async {
  late Map<String, dynamic> body;
  await http.runWithClient(
    () => CartService().updateLocation('t', placemark, 17.44679, 78.36214, 'c1'),
    () => MockClient((request) async {
      body = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response(jsonEncode({'data': {}}), 200);
    }),
  );
  return body;
}

void main() {
  test('with no address from the phone, the coordinates are sent as the address', () async {
    final body = await _sent(Placemark());
    expect(body['address'], '17.44679, 78.36214');
    expect(body['lat'], 17.44679);
  });

  test('a found address is sent as is, without repeats', () async {
    final body = await _sent(Placemark(name: 'C8-810', street: 'C8-810', locality: 'Hyderabad'));
    expect(body['address'], 'C8-810, Hyderabad');
  });
}
