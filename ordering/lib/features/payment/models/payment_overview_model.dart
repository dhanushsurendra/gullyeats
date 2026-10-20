import 'payment_model.dart';

class PaymentOverviewModel {
  final String cartId;
  final String cartName;
  final int totalOrders;
  final num totalPlatformFee;
  final num totalPaid;
  final num totalPending;
  final bool isLocked;
  final PaymentModel? currentPayment;

  const PaymentOverviewModel({
    required this.cartId,
    required this.cartName,
    required this.totalOrders,
    required this.totalPlatformFee,
    required this.totalPaid,
    required this.totalPending,
    required this.isLocked,
    this.currentPayment,
  });

  factory PaymentOverviewModel.fromJson(
    Map<String, dynamic> json,
  ) {
    final cart = json['cart'] as Map<String, dynamic>?;

    return PaymentOverviewModel(
      cartId: (
        cart?['id'] ??
        cart?['_id'] ??
        json['cartId'] ??
        ''
      ).toString(),

      cartName: (
        cart?['name'] ??
        cart?['cartName'] ??
        json['cartName'] ??
        ''
      ).toString(),

      totalOrders:
          (json['totalOrders'] as num?)?.toInt() ?? 0,

      totalPlatformFee:
          (json['totalPlatformFee'] as num?) ?? 0,

      totalPaid:
          (json['totalPaid'] as num?) ?? 0,

      totalPending:
          (json['totalPending'] as num?) ?? 0,

      isLocked:
          json['isLocked'] as bool? ?? false,

      currentPayment:
          json['currentPayment'] != null
              ? PaymentModel.fromJson(
                  json['currentPayment']
                      as Map<String, dynamic>,
                )
              : null,
    );
  }

  PaymentOverviewModel copyWith({
    bool? isLocked,
    num? totalPaid,
    num? totalPending,
    PaymentModel? currentPayment,
  }) {
    return PaymentOverviewModel(
      cartId: cartId,
      cartName: cartName,
      totalOrders: totalOrders,
      totalPlatformFee: totalPlatformFee,
      totalPaid: totalPaid ?? this.totalPaid,
      totalPending: totalPending ?? this.totalPending,
      isLocked: isLocked ?? this.isLocked,
      currentPayment:
          currentPayment ?? this.currentPayment,
    );
  }
}