import 'package:ordering/features/orders/models/order_item_model.dart';

class PaymentAdjustment {
  final double oldTotal;
  final double newTotal;
  final double difference;
  final String action;
  final double amount;

  PaymentAdjustment({
    required this.oldTotal,
    required this.newTotal,
    required this.difference,
    required this.action,
    required this.amount,
  });

  factory PaymentAdjustment.fromJson(Map<String, dynamic> json) {
    return PaymentAdjustment(
      oldTotal: (json['oldTotal'] as num?)?.toDouble() ?? 0.0,
      newTotal: (json['newTotal'] as num?)?.toDouble() ?? 0.0,
      difference: (json['difference'] as num?)?.toDouble() ?? 0.0,
      action: json['action']?.toString() ?? 'NONE',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'oldTotal': oldTotal,
      'newTotal': newTotal,
      'difference': difference,
      'action': action,
      'amount': amount,
    };
  }
}

/// Money owed back on a paid order that was cancelled or made smaller, and
/// whether the cart handed it back (and whether the customer says it didn't).
class Refund {
  final double amount;
  final String reason; // CANCELLED | EDITED
  final DateTime? refundedAt;
  final DateTime? flaggedAt;
  final DateTime? flagResolvedAt;

  const Refund({required this.amount, required this.reason, this.refundedAt, this.flaggedAt, this.flagResolvedAt});

  static DateTime? _date(Object? v) => v == null ? null : DateTime.tryParse(v.toString());

  factory Refund.fromJson(Map<String, dynamic> json) => Refund(
    amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
    reason: json['reason']?.toString() ?? 'EDITED',
    refundedAt: _date(json['refundedAt']),
    flaggedAt: _date(json['flaggedAt']),
    flagResolvedAt: _date(json['flagResolvedAt']),
  );

  Map<String, dynamic> toJson() => {
    'amount': amount,
    'reason': reason,
    'refundedAt': refundedAt?.toIso8601String(),
    'flaggedAt': flaggedAt?.toIso8601String(),
    'flagResolvedAt': flagResolvedAt?.toIso8601String(),
  };
}

class OrderModel {
  final String id;
  final String orderNumber;
  final String cartId;
  final List<OrderItemModel> orderItems;

  final double subtotal;
  final double parcelCharge;
  final double platformFee;
  final double totalPrice;

  final String status;
  final bool isPaid;

  /// What the customer has paid so far; edits settle against this.
  final double paidAmount;

  final String orderType;

  final DateTime? orderDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? paidAt;
  final DateTime? servedAt;

  /// Set while the vendor is cooking this paid order (optional step).
  final DateTime? preparingAt;

  // Optional payment adjustment after updating an order
  final PaymentAdjustment? paymentAdjustment;

  /// Every refund owed on this order (cancelled, or items removed after payment).
  final List<Refund> refunds;

  OrderModel({
    required this.id,
    required this.orderNumber,
    required this.cartId,
    required this.orderItems,
    required this.subtotal,
    this.parcelCharge = 0.0,
    this.platformFee = 2.0,
    required this.totalPrice,
    required this.status,
    required this.isPaid,
    this.paidAmount = 0.0,
    required this.orderType,
    this.orderDate,
    this.createdAt,
    this.updatedAt,
    this.paidAt,
    this.servedAt,
    this.preparingAt,
    this.paymentAdjustment,
    this.refunds = const [],
  });

  /// Still to hand back. Orders from before the refund log only have a RETURN adjustment.
  double get refundOwed => refunds.isEmpty
      ? (paymentAdjustment?.action == 'RETURN' ? paymentAdjustment!.amount : 0)
      : refunds.where((r) => r.refundedAt == null).fold(0.0, (t, r) => t + r.amount);

  /// Handed back (marked in the app).
  double get refundedAmount => refunds.where((r) => r.refundedAt != null).fold(0.0, (t, r) => t + r.amount);

  /// The customer says a refund marked as handed back never reached them.
  bool get refundFlagged => refunds.any((r) => r.flaggedAt != null && r.flagResolvedAt == null);

  bool get isQrOrder => orderType == "QR";

  bool get isPreparing => status == "PAID" && preparingAt != null;

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json["_id"]?.toString() ?? "",
      orderNumber: json["orderNumber"]?.toString() ?? "",
      cartId: json["cartId"]?.toString() ?? "",

      orderItems:
          (json["orderItems"] as List?)
              ?.map(
                (item) => OrderItemModel.fromJson(item as Map<String, dynamic>),
              )
              .toList() ??
          [],

      subtotal: (json["subtotal"] as num?)?.toDouble() ?? 0.0,
      parcelCharge: (json["parcelCharge"] as num?)?.toDouble() ?? 0.0,
      platformFee: (json["platformFee"] as num?)?.toDouble() ?? 2.0,
      totalPrice: (json["totalPrice"] as num?)?.toDouble() ?? 0.0,

      status: json["status"]?.toString() ?? "PENDING",

      isPaid: json["status"] != "PENDING" && json["status"] != "CANCELLED",

      // Orders saved before the server stored paidAmount count as fully
      // paid when PAID (the server does the same).
      paidAmount:
          (json["paidAmount"] as num?)?.toDouble() ??
          (json["status"] == "PAID"
              ? (json["totalPrice"] as num?)?.toDouble() ?? 0.0
              : 0.0),

      orderType: json["orderType"]?.toString() ?? "MANUAL",

      orderDate: json["orderDate"] != null
          ? DateTime.tryParse(json["orderDate"].toString())
          : null,

      createdAt: json["createdAt"] != null
          ? DateTime.tryParse(json["createdAt"].toString())
          : null,

      updatedAt: json["updatedAt"] != null
          ? DateTime.tryParse(json["updatedAt"].toString())
          : null,

      paidAt: json["paidAt"] != null
          ? DateTime.tryParse(json["paidAt"].toString())
          : null,

      servedAt: json["servedAt"] != null
          ? DateTime.tryParse(json["servedAt"].toString())
          : null,

      preparingAt: json["preparingAt"] != null
          ? DateTime.tryParse(json["preparingAt"].toString())
          : null,

      paymentAdjustment: json["paymentAdjustment"] != null
          ? PaymentAdjustment.fromJson(
              json["paymentAdjustment"] as Map<String, dynamic>,
            )
          : null,

      refunds: (json["refunds"] as List?)
              ?.map((r) => Refund.fromJson(r as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "_id": id,

      "orderNumber": int.tryParse(orderNumber) ?? orderNumber,

      "cartId": cartId,

      "orderItems": orderItems.map((item) => item.toJson()).toList(),

      "subtotal": subtotal,

      "parcelCharge": parcelCharge,

      "platformFee": platformFee,

      "totalPrice": totalPrice,

      "status": status,

      "isPaid": isPaid,

      "paidAmount": paidAmount,

      "orderType": orderType,

      "orderDate": orderDate?.toIso8601String(),

      "createdAt": createdAt?.toIso8601String(),

      "updatedAt": updatedAt?.toIso8601String(),

      "paidAt": paidAt?.toIso8601String(),

      "servedAt": servedAt?.toIso8601String(),

      "preparingAt": preparingAt?.toIso8601String(),

      if (paymentAdjustment != null)
        "paymentAdjustment": paymentAdjustment!.toJson(),

      "refunds": refunds.map((r) => r.toJson()).toList(),
    };
  }

  OrderModel copyWith({
    String? id,
    String? orderNumber,
    String? cartId,
    List<OrderItemModel>? orderItems,
    double? subtotal,
    double? parcelCharge,
    double? platformFee,
    double? totalPrice,
    String? status,
    bool? isPaid,
    double? paidAmount,
    String? orderType,
    DateTime? orderDate,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? paidAt,
    DateTime? servedAt,
    DateTime? preparingAt,
    PaymentAdjustment? paymentAdjustment,
    List<Refund>? refunds,
  }) {
    return OrderModel(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      cartId: cartId ?? this.cartId,
      orderItems: orderItems ?? this.orderItems,
      subtotal: subtotal ?? this.subtotal,
      parcelCharge: parcelCharge ?? this.parcelCharge,
      platformFee: platformFee ?? this.platformFee,
      totalPrice: totalPrice ?? this.totalPrice,
      status: status ?? this.status,
      isPaid: isPaid ?? this.isPaid,
      paidAmount: paidAmount ?? this.paidAmount,
      orderType: orderType ?? this.orderType,
      orderDate: orderDate ?? this.orderDate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      paidAt: paidAt ?? this.paidAt,
      servedAt: servedAt ?? this.servedAt,
      preparingAt: preparingAt ?? this.preparingAt,
      paymentAdjustment: paymentAdjustment ?? this.paymentAdjustment,
      refunds: refunds ?? this.refunds,
    );
  }
}
