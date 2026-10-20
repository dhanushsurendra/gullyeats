class PaymentStatusModel {
  final bool isLocked;
  final String? message;
  final DateTime? billingDate;
  final int totalOrders;
  final double totalPending;
  final String cartName;
  final String address;

  const PaymentStatusModel({
    required this.isLocked,
    this.message,
    required this.billingDate,
    required this.totalOrders,
    required this.totalPending,
    required this.cartName,
    required this.address,
  });

  factory PaymentStatusModel.fromJson(
    Map<String, dynamic> json,
  ) {
    return PaymentStatusModel(
      isLocked: json['isLocked'] == true,

      message: json['message']?.toString(),

      billingDate: json['billingDate'] != null
          ? DateTime.tryParse(
              json['billingDate'].toString(),
            )
          : null,

      totalOrders:
          (json['totalOrders'] as num?)?.toInt() ?? 0,

      totalPending:
          (json['totalPending'] as num?)?.toDouble() ?? 0,

      cartName:
          json['cartName']?.toString() ?? '',

      address:
          json['address']?.toString() ?? '',
    );
  }
}