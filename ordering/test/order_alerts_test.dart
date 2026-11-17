import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/core/utils/order_alerts.dart';

void main() {
  test('order sounds follow the phone: normal rings, vibrate buzzes, silent is quiet', () {
    expect(OrderAlerts.forRingerMode(2), (sound: true, vibrate: true));
    expect(OrderAlerts.forRingerMode(1), (sound: false, vibrate: true));
    expect(OrderAlerts.forRingerMode(0), (sound: false, vibrate: false));
  });
}
