import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/voice/voice_parser.dart';

MenuItemModel dish(String id, String name, double price, [Map<String, String> names = const {}]) =>
    MenuItemModel(
      id: id,
      name: name,
      price: price,
      isVeg: true,
      isInStock: true,
      cartId: 'c1',
      imageUrl: '',
      names: names,
    );

// Names in each script as the server stores them (written by sound).
final menu = [
  dish('d1', 'Masala Dosa', 60, {'hi': 'मसाला डोसा', 'kn': 'ಮಸಾಲಾ ದೋಸೆ', 'ta': 'மசாலா தோசை'}),
  dish('d2', 'Dosa', 40, {'hi': 'डोसा', 'kn': 'ದೋಸೆ', 'ta': 'தோசை'}),
  dish('d3', 'Ghee Roast Dosa', 90, {'kn': 'ಘೀ ರೋಸ್ಟ್ ದೋಸೆ'}),
  dish('d4', 'Filter Coffee', 25, {'hi': 'फ़िल्टर कॉफ़ी', 'kn': 'ಫಿಲ್ಟರ್ ಕಾಫಿ', 'ta': 'ஃபில்டர் காபி'}),
  dish('d5', 'Idli Vada', 50, {'kn': 'ಇಡ್ಲಿ ವಡೆ'}),
  dish('d6', 'Ghee Roast Paper Dosa with Extra Chutney and Sambar', 120),
];

OrderModel order(String number, String status) => OrderModel.fromJson({
  '_id': 'o$number$status',
  'orderNumber': number,
  'status': status,
  'totalPrice': 122,
});

final active = [order('6', 'PENDING'), order('7', 'PAID'), order('5', 'SERVED')];

/// "2 Masala Dosa, 1 Filter Coffee" for easy comparison.
String lines(VoiceCommand c) => (c as NewOrderCommand)
    .lines
    .map((l) => '${l.quantity} ${l.item.name}')
    .join(', ');

VoiceCommand parse(String heard) => parseVoiceCommand(heard, menu, active);

void main() {
  group('new orders', () {
    test('English with digits, quantity defaults to one', () {
      final c = parse('2 masala dosa 1 filter coffee');
      expect(lines(c), '2 Masala Dosa, 1 Filter Coffee');
      expect(parse('masala dosa'), isA<NewOrderCommand>());
      expect(lines(parse('masala dosa')), '1 Masala Dosa');
    });

    test('number words in each language', () {
      expect(lines(parse('two masala dosa and three filter coffee')), '2 Masala Dosa, 3 Filter Coffee');
      expect(lines(parse('do masala dosa ek filter coffee')), '2 Masala Dosa, 1 Filter Coffee');
      expect(lines(parse('ondu masala dose eradu coffee')), '1 Masala Dosa, 2 Filter Coffee');
      expect(lines(parse('rendu dosa oru filter coffee')), '2 Dosa, 1 Filter Coffee');
    });

    test('in script, as the phone hears Kannada, Hindi and Tamil', () {
      expect(lines(parse('ಎರಡು ಮಸಾಲಾ ದೋಸೆ ಒಂದು ಫಿಲ್ಟರ್ ಕಾಫಿ')), '2 Masala Dosa, 1 Filter Coffee');
      expect(lines(parse('दो मसाला डोसा')), '2 Masala Dosa');
      expect(lines(parse('இரண்டு மசாலா தோசை')), '2 Masala Dosa');
    });

    test('the longer dish wins over a shorter one inside it', () {
      expect(lines(parse('1 ghee roast dosa 2 dosa')), '1 Ghee Roast Dosa, 2 Dosa');
      expect(lines(parse('masala dosa')), '1 Masala Dosa');
    });

    test('close mishearings still match; a number after the dish counts', () {
      expect(lines(parse('masal dosa 2')), '2 Masala Dosa');
      expect(lines(parse('filtar coffee')), '1 Filter Coffee');
      expect(lines(parse('2x idli vada')), '2 Idli Vada');
    });

    test('a word only one dish has is enough; a shared word is not', () {
      expect(lines(parse('2 coffee')), '2 Filter Coffee');
      expect(lines(parse('ondu vada')), '1 Idli Vada');
      // "roast" is in two dishes: not enough. "dosa" alone is the plain Dosa.
      expect(parse('roast'), isA<NotUnderstood>());
      expect(lines(parse('dosa')), '1 Dosa');
      // Joining words never pick a dish.
      expect(lines(parse('dosa and coffee')), '1 Dosa, 1 Filter Coffee');
    });

    test('a long dish name is one dish', () {
      expect(
        lines(parse('1 ghee roast paper dosa with extra chutney and sambar 2 masala dosa')),
        '1 Ghee Roast Paper Dosa with Extra Chutney and Sambar, 2 Masala Dosa',
      );
    });

    test('the same dish twice adds up', () {
      expect(lines(parse('1 dosa and 2 dosa')), '3 Dosa');
    });

    test('a leading "new order" / "order" is ignored, not read as an order number', () {
      expect(lines(parse('new order 2 masala dosa paid')), '2 Masala Dosa');
      expect(lines(parse('order 2 masala dosa')), '2 Masala Dosa');
    });

    test('parcel and paid flags, in any language', () {
      final c = parse('2 masala dosa parcel paid') as NewOrderCommand;
      expect((c.parcel, c.paid), (true, true));
      final kn = parse('ಒಂದು ದೋಸೆ ಪಾರ್ಸಲ್') as NewOrderCommand;
      expect((kn.parcel, kn.paid), (true, false));
      final hi = parse('do dosa paise') as NewOrderCommand;
      expect(hi.paid, isTrue);
    });

    test('words it could not match are reported, the rest still kept', () {
      final c = parse('2 masala dosa 1 pizza') as NewOrderCommand;
      expect(lines(c), '2 Masala Dosa');
      expect(c.unknown, ['pizza']);
    });
  });

  group('existing orders', () {
    test('"number 6 paid" marks the unpaid #6', () {
      final c = parse('number 6 paid');
      expect(c, isA<MarkPaidCommand>());
      expect((c as MarkPaidCommand).order.orderNumber, '6');
      expect(parse('six paid'), isA<MarkPaidCommand>());
      expect(parse('# 6 paid'), isA<MarkPaidCommand>());
    });

    test('"number 7 served" serves the paid #7', () {
      final c = parse('order seven ready');
      expect(c, isA<ServeCommand>());
      expect((c as ServeCommand).order.orderNumber, '7');
      expect(parse('ಏಳು ನಂಬರ್ ರೆಡಿ'), isA<ServeCommand>());
    });

    test('an order not waiting for that step is reported, never acted on', () {
      expect((parse('number 5 served') as OrderNotFound).number, 5, reason: 'already served');
      expect(parse('number 7 paid'), isA<OrderNotFound>(), reason: 'already paid');
      expect(parse('number 9 paid'), isA<OrderNotFound>(), reason: 'no such order');
    });
  });

  test('nothing usable', () {
    expect(parse(''), isA<NotUnderstood>());
    expect(parse('hello how are you'), isA<NotUnderstood>());
    expect(parse('paid'), isA<NotUnderstood>());
  });

  test('yes and no replies in each language', () {
    for (final w in ['yes', 'ok', 'haan', 'हाँ', 'houdu', 'ಹೌದು', 'aama', 'சரி']) {
      expect(parseYesNo(w), isTrue, reason: w);
    }
    for (final w in ['no', 'cancel', 'nahi', 'नहीं', 'beda', 'ಬೇಡ', 'venda', 'வேண்டாம்']) {
      expect(parseYesNo(w), isFalse, reason: w);
    }
    expect(parseYesNo('masala dosa'), isNull);
  });
}
