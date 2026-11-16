import 'package:clock/clock.dart';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Sample data for rendering screens, with long values on purpose: real cart,
/// item and staff names vary a lot.
const longCartName = "Ramesh's Famous Masala Dosa & Filter Coffee Point";

final cartJson = {
  '_id': 'c1',
  'cartName': longCartName,
  'cartCity': 'Bangalore',
  'cartId': 'GE-BLR-000123',
  'address': '42, 100 Feet Road, HAL 2nd Stage, Indiranagar',
  'cartImageUrl': '',
  'qrImageUrl': '',
  'isActive': true,
  'isOpen': true,
  'parcelCharge': 10,
  'userId': 'u1',
  'location': {'type': 'Point', 'coordinates': [12.97, 77.64]},
};

final _secondCart = {
  ...cartJson,
  '_id': 'c2',
  'cartName': 'Juice Corner',
  'cartId': 'GE-BLR-000124',
  'isOpen': false,
};

// What the backend's transliteration returned for each sample name.
const _names = {
  'Masala Dosa': {'hi': 'मसाला डोसा', 'kn': 'ಮಸಾಲಾ ದೋಸಾ', 'ta': 'மசாலா தோசை'},
  'Ghee Roast Paper Dosa with Extra Chutney and Sambar': {'hi': 'घी रोस्ट पेपर डोसा विथ एक्स्ट्रा चटनी एंड सांबर', 'kn': 'ಗಹೀ ರೋಸ್ಟ್ ಪೇಪರ್ ದೋಸಾ ವಿಥ್ ಎಕ್ಸ್ಟ್ರಾ ಚಟ್ನಿ ಅಂಡ್ ಸಾಂಬಾರ್', 'ta': 'கஹீ ரோசஸ்ட பேப்பர் தோச வித் எக்ஸ்ட்ரா சட்னி அண்ட் சாம்பார்'},
  'Chicken 65': {'hi': 'चिकन 65', 'kn': 'ಚಿಕನ್ 65', 'ta': 'சிக்கன் 65'},
  'Filter Coffee': {'hi': 'फ़िल्टर कॉफ़ी', 'kn': 'ಫಿಲ್ಟರ್ ಕಾಫಿ', 'ta': 'பில்டர் காபி'},
};

Map<String, dynamic> _item(String id, String name, num price, {bool veg = true, bool stock = true}) => {
  '_id': id,
  'name': name,
  'names': _names[name],
  'price': price,
  'isVeg': veg,
  'isInStock': stock,
  'imageUrl': '',
  'cartId': 'c1',
};

final menuJson = [
  _item('m1', 'Masala Dosa', 60),
  _item('m2', 'Ghee Roast Paper Dosa with Extra Chutney and Sambar', 1250),
  _item('m3', 'Chicken 65', 180, veg: false),
  _item('m4', 'Filter Coffee', 20, stock: false),
];

Map<String, dynamic> _line(String id, String name, num price, int qty) =>
    {'menuItemId': id, 'name': name, 'names': _names[name], 'price': price, 'quantity': qty};

// Fixed, so screens that print times render the same image every run.
final _now = DateTime.utc(2026, 11, 6, 8, 15);

Map<String, dynamic> _order(
  String id,
  int number,
  String status,
  List<Map<String, dynamic>> lines, {
  String type = 'MANUAL',
  num parcel = 0,
}) {
  final subtotal = lines.fold<num>(0, (sum, l) => sum + l['price'] * l['quantity']);
  return {
    '_id': id,
    'orderNumber': number,
    'cartId': 'c1',
    'orderItems': lines,
    'subtotal': subtotal,
    'parcelCharge': parcel,
    'platformFee': 2,
    'totalPrice': subtotal + parcel + 2,
    'status': status,
    'orderType': type,
    'phoneNumber': type == 'QR' ? '9876543210' : null,
    'orderDate': _now.toIso8601String(),
    'createdAt': _now.toIso8601String(),
    if (status != 'PENDING') 'paidAt': _now.toIso8601String(),
    if (status == 'SERVED') 'servedAt': _now.toIso8601String(),
  };
}

final ordersJson = [
  _order('o1', 101, 'PENDING', [
    _line('m1', 'Masala Dosa', 60, 2),
    _line('m2', 'Ghee Roast Paper Dosa with Extra Chutney and Sambar', 1250, 1),
    _line('m3', 'Chicken 65', 180, 3),
  ], type: 'QR', parcel: 10),
  _order('o2', 102, 'PAID', [_line('m1', 'Masala Dosa', 60, 1)]),
  // Being cooked: the order card shows "Preparing".
  {
    ..._order('o5', 105, 'PAID', [_line('m3', 'Chicken 65', 180, 1)], type: 'QR'),
    'preparingAt': _now.toIso8601String(),
  },
  _order('o3', 103, 'SERVED', [_line('m3', 'Chicken 65', 180, 2)], type: 'QR'),
  _order('o4', 104, 'CANCELLED', [_line('m1', 'Masala Dosa', 60, 1)]),
];

final salesJson = {
  'revenue': 15840, 'subtotalRevenue': 15200, 'parcelRevenue': 400,
  'platformFeeRevenue': 240, 'netRevenue': 15600,
  'totalOrders': 120, 'pendingOrders': 4, 'paidOrders': 10, 'servedOrders': 100,
  'cancelledOrders': 6, 'completionRate': 83.3, 'cancellationRate': 5,
  'paymentRate': 91.7, 'avgOrderValue': 132, 'highestOrder': 1450,
  'lowestOrder': 22, 'revenuePerOrder': 132, 'totalItemsSold': 310,
  'avgItemsPerOrder': 2.6, 'highestItemsInOrder': 12, 'uniqueItemsSold': 14,
  'avgPrepTime': '4 min 12 sec', 'fastestOrder': '1 min 5 sec',
  'slowestOrder': '18 min 40 sec', 'avgPaymentTime': '2 min 3 sec',
  'avgServeAfterPaymentTime': '3 min 30 sec', 'peakHour': 13, 'slowestHour': 16,
  'busyHours': [
    for (var h = 8; h < 22; h++) {'hour': h, 'count': (h * 7) % 23},
  ],
  'averageTimeBetweenOrders': '6 min 20 sec', 'qrOrders': 80, 'manualOrders': 40,
  'qrRevenue': 10500, 'manualRevenue': 5340, 'parcelOrders': 40,
  'avgParcelCharge': 10, 'topRevenueItem': 'Ghee Roast Paper Dosa with Extra Chutney and Sambar',
  'topVolumeItem': 'Masala Dosa',
  'topItems': [
    {'name': 'Ghee Roast Paper Dosa with Extra Chutney and Sambar', 'revenue': 6250, 'qty': 5},
    {'name': 'Masala Dosa', 'revenue': 4800, 'qty': 80},
    {'name': 'Chicken 65', 'revenue': 3600, 'qty': 20},
  ],
  'bottomItems': [
    {'name': 'Filter Coffee', 'revenue': 120, 'qty': 6},
  ],
  'hours': [
    for (var h = 8; h < 22; h++) {'hour': h, 'count': (h * 7) % 23},
  ],
  'days': [
    {'day': '2026-11-06', 'revenue': 15840, 'orders': 110},
  ],
  'previous': {'revenue': 14100, 'orders': 118, 'avgOrderValue': 119.5},
  'unpaidValue': 520, 'cancelledValue': 780,
  'customers': 64, 'returningCustomers': 21,
  'avgRating': 4.4, 'ratingCount': 18,
  'avgWaitAfterPayment': '3 min 30 sec',
  'recentFeedback': [
    {'text': 'Best masala dosa on this road, but the chutney ran out by 1 PM. Please make more on weekends!', 'rating': 4, 'at': '2026-11-06T08:30:00Z'},
    {'text': 'Too slow at lunch', 'rating': 2, 'at': '2026-11-05T07:10:00Z'},
  ],
  'unsoldItems': ['Rava Kesari Bath with Ghee and Cashews', 'Onion Uttapam', 'Lemon Rice', 'Curd Rice', 'Vada', 'Pongal', 'Bisi Bele Bath', 'Rose Milk', 'Badam Milk', 'Buttermilk'],
};

final _payment = {
  '_id': 'p1',
  'cartId': 'c1',
  'cartName': longCartName,
  'totalOrders': 64,
  'amount': 128,
  'status': 'VERIFIED',
  'paymentReference': 'pay_RZP0012345678',
  'createdAt': _now.toIso8601String(),
  'verifiedAt': _now.toIso8601String(),
  'billingDate': _now.toIso8601String(),
};

final staffJson = [
  {
    '_id': 's1',
    'userId': 'STF-AB12CD',
    'name': 'Venkataramanan Subramaniam Iyer',
    'phoneNumber': '9876543210',
    'role': 'staff',
    'cartId': 'c1',
  },
  {
    '_id': 's2',
    'userId': 'STF-EF34GH',
    'name': 'Ravi',
    'phoneNumber': '9123456780',
    'role': 'staff',
    'cartId': 'c1',
  },
];

/// The weather strip's sample: a cloudy noon with heavy rain due in 2 hours
/// (the strip's longest line). [evening] moves sunset an hour back, for Chill.
Map<String, dynamic> weatherJson({bool evening = false}) {
  final now = clock.now();
  final day = DateTime(now.year, now.month, now.day);
  String iso(DateTime t) => t.toUtc().toIso8601String();
  final hour = DateTime(now.year, now.month, now.day, now.hour);
  return {
    'tempC': 26,
    'feelsC': 27,
    'humidity': 62,
    'windKph': 11,
    'condition': 'cloudy',
    'rainMm': 0.4,
    'sunrise': iso(day.add(const Duration(hours: 6, minutes: 16))),
    'sunset': iso(evening ? now.subtract(const Duration(hours: 1)) : day.add(const Duration(hours: 17, minutes: 52))),
    'hourly': [
      for (var i = 0; i < 8; i++)
        {
          'at': iso(hour.add(Duration(hours: i))),
          'tempC': 26 - i,
          'rainMm': const [0.4, 2.1, 12.5, 3.0, 0.0, 0.0, 0.0, 0.0][i],
          'condition': const ['cloudy', 'rain', 'heavy_rain', 'rain', 'cloudy', 'cloudy', 'clear', 'clear'][i],
        },
    ],
    'heavyRainAt': iso(hour.add(const Duration(hours: 2))),
    'updatedAt': iso(now.subtract(const Duration(minutes: 12))),
  };
}

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

/// Answers the vendor app's GET requests with the sample data above.
/// Anything else fails, like an unreachable server.
final fakeBackend = MockClient((request) async {
  final path = request.url.path;
  bool has(String part) => path.contains(part);

  if (request.method != 'GET') return _json({'message': 'Not available in tests'}, 400);
  if (has('/carts/get-all-carts/')) return _json({'carts': [cartJson, _secondCart]});
  if (has('/carts/sales-insights/')) return _json({'data': salesJson});
  if (has('/carts/get-menu-items/')) return _json({'data': menuJson, 'platformFee': 2});
  if (has('/carts/food-names')) {
    return _json({
      'data': [
        for (final e in _names.entries) {'name': e.key, ...e.value},
      ],
    });
  }
  if (has('/carts/weather/')) return _json({'data': weatherJson()});
  if (has('/carts/area-alerts/')) {
    return _json({
      'data': [
        {'_id': 'a1', 'reason': 'EVICTION', 'distanceM': 600, 'createdAt': clock.now().subtract(const Duration(minutes: 12)).toIso8601String(), 'confirmations': 3, 'confirmedByMe': false, 'mine': false},
        {'_id': 'a3', 'reason': 'EVICTION', 'distanceM': 400, 'createdAt': clock.now().subtract(const Duration(minutes: 30)).toIso8601String(), 'confirmations': 1, 'confirmedByMe': false, 'mine': false},
        {'_id': 'a2', 'reason': 'RAIN', 'distanceM': 300, 'createdAt': clock.now().subtract(const Duration(minutes: 20)).toIso8601String(), 'confirmations': 0, 'confirmedByMe': false, 'mine': false},
      ],
    });
  }
  if (has('/carts/get-all-staff/')) return _json({'staff': staffJson});
  if (has('/carts/get-qr-details/')) {
    return _json({'data': {'cartId': 'GE-BLR-000123', 'cartName': longCartName, 'qrImageUrl': ''}});
  }
  if (has('/orders/orders-today/') || has('/orders/c1')) return _json({'data': ordersJson});
  if (has('/payments/payment-history/')) return _json({'payments': [_payment, {..._payment, '_id': 'p2', 'status': 'PENDING'}]});
  if (has('/payments/payment-status/')) {
    // Slow, so the welcome screen is shown checking rather than already gone.
    await Future<void>.delayed(const Duration(seconds: 5));
    return _json({'isLocked': false, 'totalOrders': 0, 'totalPending': 0, 'cartName': longCartName, 'address': ''});
  }
  return _json({'message': 'Not found'}, 404);
});
