import 'package:flutter/material.dart';
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

  final String orderType;

  final DateTime? orderDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? paidAt;
  final DateTime? servedAt;

  // Optional payment adjustment after updating an order
  final PaymentAdjustment? paymentAdjustment;

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
    required this.orderType,
    this.orderDate,
    this.createdAt,
    this.updatedAt,
    this.paidAt,
    this.servedAt,
    this.paymentAdjustment,
  });

  bool get isQrOrder => orderType == "QR";

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    debugPrint(
      'ORDER ${json["_id"]}: '
      'isPaid=${json["isPaid"]}, '
      'type=${json["isPaid"]?.runtimeType}, '
      'status=${json["status"]}',
    );

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

      paymentAdjustment: json["paymentAdjustment"] != null
          ? PaymentAdjustment.fromJson(
              json["paymentAdjustment"] as Map<String, dynamic>,
            )
          : null,
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

      "orderType": orderType,

      "orderDate": orderDate?.toIso8601String(),

      "createdAt": createdAt?.toIso8601String(),

      "updatedAt": updatedAt?.toIso8601String(),

      "paidAt": paidAt?.toIso8601String(),

      "servedAt": servedAt?.toIso8601String(),

      if (paymentAdjustment != null)
        "paymentAdjustment": paymentAdjustment!.toJson(),
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
    String? orderType,
    DateTime? orderDate,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? paidAt,
    DateTime? servedAt,
    PaymentAdjustment? paymentAdjustment,
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
      orderType: orderType ?? this.orderType,
      orderDate: orderDate ?? this.orderDate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      paidAt: paidAt ?? this.paidAt,
      servedAt: servedAt ?? this.servedAt,
      paymentAdjustment: paymentAdjustment ?? this.paymentAdjustment,
    );
  }
}
