import 'package:flutter_test/flutter_test.dart';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/core/utils/build_address.dart';

void main() {
  test('buildAddress drops repeated parts', () {
    final p = Placemark(
      name: 'C8-810',
      street: 'C8-810',
      subLocality: 'Gachibowli',
      locality: 'Hyderabad',
      subAdministrativeArea: 'hyderabad',
      administrativeArea: 'Telangana',
      postalCode: '500032',
      country: 'India',
    );
    expect(buildAddress(p), 'C8-810, Gachibowli, Hyderabad, Telangana, 500032, India');
    expect(buildAddress(Placemark()), '');
  });

  test('joinAddressParts skips missing parts instead of printing null', () {
    expect(joinAddressParts([null, null]), '');
    expect(joinAddressParts(['42, 100 Feet Road', null, ' ']), '42, 100 Feet Road');
    expect(joinAddressParts(['Bengaluru', 'Karnataka']), 'Bengaluru, Karnataka');
    expect(joinAddressParts(['Bengaluru', '560038'], separator: ' - '), 'Bengaluru - 560038');
  });
}
