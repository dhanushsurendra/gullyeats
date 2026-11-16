import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/onboarding/services/cart_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Future<String?> _ask(
  http.Response Function(http.Request) reply, [
  List<Uri>? sent,
]) => http.runWithClient(
  () => CartService().mainRoadNear('t', 12.9756, 77.606),
  () => MockClient((request) async {
    sent?.add(request.url);
    return reply(request);
  }),
);

void main() {
  test('a nearby main road comes back by name, and nothing as null', () async {
    final sent = <Uri>[];
    expect(
      await _ask(
        (_) => http.Response(jsonEncode({'road': 'M G Road'}), 200),
        sent,
      ),
      'M G Road',
    );
    expect(sent.single.path, endsWith('/carts/main-road'));
    expect(sent.single.queryParameters, {'lat': '12.9756', 'lng': '77.606'});
    expect(await _ask((_) => http.Response(jsonEncode({'road': ''}), 200)), '');
    expect(
      await _ask((_) => http.Response(jsonEncode({'road': null}), 200)),
      isNull,
    );
  });

  test('any failure means no warning, never an error', () async {
    expect(
      await _ask((_) => http.Response('{"message":"Not found"}', 404)),
      isNull,
    );
    expect(await _ask((_) => http.Response('<html>', 200)), isNull);
    expect(await _ask((_) => throw http.ClientException('offline')), isNull);
  });
}
