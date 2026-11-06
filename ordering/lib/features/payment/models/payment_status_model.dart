class PaymentStatusModel {
  final bool isLocked;
  final String? message;
  final DateTime? billingDate;

  /// When the cart locks if the pending fee isn't paid.
  final DateTime? dueAt;

  /// Whether the pending fee can be paid yet (its day has ended).
  final bool canPay;

  final int totalOrders;
  final double totalPending;
  final String cartName;
  final String address;

  const PaymentStatusModel({
    required this.isLocked,
    this.message,
    required this.billingDate,
    this.dueAt,
    this.canPay = false,
    required this.totalOrders,
    required this.totalPending,
    required this.cartName,
    required this.address,
  });

  /// A fee is owed but the cart isn't locked yet: time to warn the vendor.
  bool get isFeeComingDue => !isLocked && totalPending > 0 && dueAt != null;

  factory PaymentStatusModel.fromJson(Map<String, dynamic> json) {
    DateTime? date(Object? value) =>
        value == null ? null : DateTime.tryParse(value.toString());

    return PaymentStatusModel(
      isLocked: json['isLocked'] == true,
      message: json['message']?.toString(),
      billingDate: date(json['billingDate']),
      dueAt: date(json['dueAt']),
      canPay: json['canPay'] == true,
      totalOrders: (json['totalOrders'] as num?)?.toInt() ?? 0,
      totalPending: (json['totalPending'] as num?)?.toDouble() ?? 0,
      cartName: json['cartName']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
    );
  }
}
