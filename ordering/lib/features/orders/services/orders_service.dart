import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/features/orders/models/order_model.dart';

class OrderService {
  Map<String, String> _headers(String? token) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  Future<List<OrderModel>> fetchOrders(String? token, String cartId) async {
    final response = await http.get(
      Uri.parse('${ApiConstants.orders}/orders-today/$cartId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return (data["data"] as List).map((e) => OrderModel.fromJson(e)).toList();
    } else {
      throw ApiException(
        data["message"] ?? "Error fetching orders",
        response.statusCode,
      );
    }
  }

  String formatDate(DateTime date) {
    return "${date.year.toString().padLeft(4, '0')}-"
        "${date.month.toString().padLeft(2, '0')}-"
        "${date.day.toString().padLeft(2, '0')}";
  }

  Future<List<OrderModel>> fetchAllOrders(
    String? token,
    String cartId,
    String startDate,
    String endDate,
  ) async {
    final startDateString = formatDate(DateTime.parse(startDate));
    final endDateString = formatDate(DateTime.parse(endDate));

    final uri = Uri.parse('${ApiConstants.orders}/$cartId').replace(
      queryParameters: {'startDate': startDateString, 'endDate': endDateString},
    );

    final response = await http.get(uri, headers: _headers(token));

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      return (data["data"] as List).map((e) => OrderModel.fromJson(e)).toList();
    } else {
      throw ApiException(
        data["message"] ?? "Error fetching all orders",
        response.statusCode,
      );
    }
  }

  Future<OrderModel> createOrder(
    String? token,
    Map<String, dynamic> orderData,
  ) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.orders}/create-order'),
      headers: _headers(token),
      body: json.encode(orderData),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 201) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to create order",
        response.statusCode,
      );
    }
  }

  Future<OrderModel> markPaid(String? token, String orderId) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/mark-order-paid/$orderId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to mark as paid",
        response.statusCode,
      );
    }
  }

  Future<OrderModel> markUnpaid(String? token, String orderId) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/mark-order-unpaid/$orderId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to mark as unpaid",
        response.statusCode,
      );
    }
  }

  Future<({OrderModel order, PaymentAdjustment? paymentAdjustment})>
  updateOrder(
    String? token,
    String orderId,
    Map<String, dynamic> orderData,
  ) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/update-order/$orderId'),
      headers: _headers(token),
      body: json.encode(orderData),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      return (
        order: OrderModel.fromJson(data["data"]),
        paymentAdjustment: data["paymentAdjustment"] != null
            ? PaymentAdjustment.fromJson(data["paymentAdjustment"])
            : null,
      );
    }

    throw ApiException(
      data["message"] ?? "Failed to update order",
      response.statusCode,
    );
  }

  Future<OrderModel> serveOrder(String? token, String orderId) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/serve-order/$orderId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to serve order",
        response.statusCode,
      );
    }
  }

  Future<Map<String, dynamic>> getOrdersOverview(
    String? token,
    String cartId,
    String startDate,
    String endDate,
  ) async {
    final uri = Uri.parse(
      '${ApiConstants.orders}/overview/$cartId',
    ).replace(queryParameters: {'startDate': startDate, 'endDate': endDate});

    final response = await http.get(uri, headers: _headers(token));

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      return data;
    } else {
      throw ApiException(
        data["message"] ?? "Failed to fetch orders overview",
        response.statusCode,
      );
    }
  }

  Future<OrderModel> serveOrderUndo(String? token, String orderId) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/serve-order-undo/$orderId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to undo serve order",
        response.statusCode,
      );
    }
  }

  Future<OrderModel> deleteOrderUndo(String? token, String orderId) async {
    final response = await http.put(
      Uri.parse('${ApiConstants.orders}/delete-order-undo/$orderId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return OrderModel.fromJson(data["data"]);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to undo delete order",
        response.statusCode,
      );
    }
  }

  Future<({OrderModel order, PaymentAdjustment? paymentAdjustment})>
  deleteOrder(String? token, String orderId) async {
    final response = await http.delete(
      Uri.parse('${ApiConstants.orders}/delete-order/$orderId'),
      headers: _headers(token),
    );
    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return (
        order: OrderModel.fromJson(data["data"]),
        paymentAdjustment: data["paymentAdjustment"] != null
            ? PaymentAdjustment.fromJson(data["paymentAdjustment"])
            : null,
      );
    } else {
      throw ApiException(
        data["message"] ?? "Failed to delete order",
        response.statusCode,
      );
    }
  }
}
