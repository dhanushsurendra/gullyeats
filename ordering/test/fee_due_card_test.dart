import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/widgets/fee_due_card.dart';

PaymentStatusModel status({bool canPay = true, double pending = 2}) =>
    PaymentStatusModel(
      isLocked: false,
      billingDate: DateTime(2026, 11, 16),
      dueAt: DateTime(2026, 11, 17, 2),
      canPay: canPay,
      totalOrders: 1,
      totalPending: pending,
      cartName: 'Cart',
      address: '',
    );

void main() {
  test('Payments history shows the bill card only while a bill can be paid', () {
    expect(FeeDueCard.shows(status()), isTrue);
    expect(FeeDueCard.shows(status(pending: 0)), isFalse, reason: 'nothing owed');
    expect(FeeDueCard.shows(status(canPay: false)), isFalse, reason: "today's fee, billed after midnight");
    expect(FeeDueCard.shows(null), isFalse, reason: 'status not loaded');
  });
}
