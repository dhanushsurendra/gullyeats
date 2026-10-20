/// A single platform-fee payment record for one cart.
class PaymentModel {
  final String id;
  final String cartId;
  final String cartName;
  final int totalOrders;
  final num amount;
  final String status;
  final String paymentReference;

  final String? razorpayOrderId;
  final String? razorpayPaymentId;
  final String? razorpaySignature;
  final String? verificationSource;

  final DateTime createdAt;
  final DateTime? verifiedAt;
  final DateTime? billingDate;

  const PaymentModel({
    required this.id,
    required this.cartId,
    required this.cartName,
    required this.totalOrders,
    required this.amount,
    required this.status,
    required this.paymentReference,
    required this.createdAt,
    this.razorpayOrderId,
    this.razorpayPaymentId,
    this.razorpaySignature,
    this.verificationSource,
    this.verifiedAt,
    this.billingDate,
  });

  bool get isPending => status == 'PENDING';
  bool get isVerified => status == 'VERIFIED';
  bool get isRejected => status == 'REJECTED';
  bool get isExpired => status == 'EXPIRED';

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    return PaymentModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      cartId: (json['cartId'] ?? '').toString(),
      cartName: (json['cartName'] ?? '').toString(),

      totalOrders:
          (json['totalOrders'] as num?)?.toInt() ?? 0,

      amount:
          (json['amount'] as num?) ?? 0,

      status:
          (json['status'] ?? 'PENDING').toString(),

      paymentReference:
          (json['paymentReference'] ?? '').toString(),

      razorpayOrderId:
          json['razorpayOrderId']?.toString(),

      razorpayPaymentId:
          json['razorpayPaymentId']?.toString(),

      razorpaySignature:
          json['razorpaySignature']?.toString(),

      verificationSource:
          json['verificationSource']?.toString(),

      createdAt: json['createdAt'] != null
          ? DateTime.parse(
              json['createdAt'].toString(),
            )
          : DateTime.now(),

      verifiedAt: json['verifiedAt'] != null
          ? DateTime.parse(
              json['verifiedAt'].toString(),
            )
          : null,

      billingDate: json['billingDate'] != null
          ? DateTime.parse(
              json['billingDate'].toString(),
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'cartId': cartId,
      'cartName': cartName,
      'totalOrders': totalOrders,
      'amount': amount,
      'status': status,
      'paymentReference': paymentReference,

      'razorpayOrderId': razorpayOrderId,
      'razorpayPaymentId': razorpayPaymentId,
      'razorpaySignature': razorpaySignature,
      'verificationSource': verificationSource,

      'createdAt': createdAt.toIso8601String(),
      'verifiedAt': verifiedAt?.toIso8601String(),
      'billingDate': billingDate?.toIso8601String(),
    };
  }

  PaymentModel copyWith({
    String? status,
    String? razorpayPaymentId,
    String? razorpaySignature,
    String? verificationSource,
    DateTime? verifiedAt,
    DateTime? billingDate,
  }) {
    return PaymentModel(
      id: id,
      cartId: cartId,
      cartName: cartName,
      totalOrders: totalOrders,
      amount: amount,
      status: status ?? this.status,
      paymentReference: paymentReference,

      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId:
          razorpayPaymentId ?? this.razorpayPaymentId,
      razorpaySignature:
          razorpaySignature ?? this.razorpaySignature,
      verificationSource:
          verificationSource ?? this.verificationSource,

      createdAt: createdAt,

      verifiedAt: verifiedAt ?? this.verifiedAt,
      billingDate: billingDate ?? this.billingDate,
    );
  }
}