import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/staff_management/models/staff.dart';

void main() {
  test('StaffModel reads the id from _id, as the API sends it', () {
    // Shape of POST /carts/add-staff and GET /carts/get-all-staff items.
    final staff = StaffModel.fromJson({
      '_id': '665f1c2ab1',
      'userId': 'STF-AB12CD',
      'name': 'Ravi',
      'phoneNumber': '9876543210',
      'role': 'staff',
      'cartId': 'c1',
    });
    expect(staff.id, '665f1c2ab1');
  });
}
