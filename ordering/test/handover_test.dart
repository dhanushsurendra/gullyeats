import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/screens/handover_screen.dart';

final now = DateTime(2026, 11, 8, 20);

OrderModel order(String status, num total, {num? paid, Map<String, dynamic>? adj, List<Map<String, dynamic>>? refunds, DateTime? at}) =>
    OrderModel.fromJson({
      '_id': '$status$total$paid${refunds?.length}',
      'status': status,
      'totalPrice': total,
      'paidAmount': ?paid,
      'paymentAdjustment': ?adj,
      'refunds': ?refunds,
      'createdAt': (at ?? now.subtract(const Duration(hours: 2))).toIso8601String(),
    });

void main() {
  test('handover counts money in hand, money owed and refunds for today', () {
    final t = Handover.of([
      order('PAID', 62, paid: 62),
      order('SERVED', 42, paid: 42),
      order('PENDING', 32),
      // Paid 42, then 20 more added: 42 in hand, 20 still owed.
      order('PENDING', 62, paid: 42),
      // Cancelled after paying and marked refunded: handed back.
      order('CANCELLED', 52, paid: 52, adj: {'action': 'RETURN', 'amount': 52},
          refunds: [{'amount': 52, 'reason': 'CANCELLED', 'refundedAt': now.toIso8601String()}]),
      // Cancelled after paying, not handed back yet.
      order('CANCELLED', 30, paid: 30, adj: {'action': 'RETURN', 'amount': 30},
          refunds: [{'amount': 30, 'reason': 'CANCELLED'}]),
      // From before the refund log: a RETURN with no record of handing back counts as owed.
      order('CANCELLED', 20, paid: 20, adj: {'action': 'RETURN', 'amount': 20}),
      // Cancelled before paying: nothing either way.
      order('CANCELLED', 12, paid: 0),
      // Yesterday's, still in the list after midnight.
      order('PAID', 100, paid: 100, at: now.subtract(const Duration(days: 1))),
    ], now);

    expect(t.collected, 146);
    expect(t.collectedOrders, 3);
    expect(t.toCollect, 52);
    expect(t.unpaidOrders, 2);
    expect(t.refunded, 52);
    expect(t.refundedOrders, 1);
    expect(t.toRefund, 50);
    expect(t.toRefundOrders, 2);
  });
}
