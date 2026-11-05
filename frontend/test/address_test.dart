import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/utils/build_address.dart';

void main() {
  test('joinAddressParts skips missing parts instead of printing null', () {
    expect(joinAddressParts([null, null]), '');
    expect(joinAddressParts(['42, 100 Feet Road', null, ' ']), '42, 100 Feet Road');
    expect(joinAddressParts(['Bengaluru', 'Karnataka']), 'Bengaluru, Karnataka');
    expect(joinAddressParts(['Bengaluru', '560038'], separator: ' - '), 'Bengaluru - 560038');
  });
}
