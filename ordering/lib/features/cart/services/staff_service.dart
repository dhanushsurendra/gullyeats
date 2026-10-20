import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/features/cart/models/staff_model.dart';

class StaffService {
  Future<StaffModel> addStaff(
    String? token,
    String cartId,
    String name,
    String phoneNumber,
  ) async {
    final response = await http
        .post(
          Uri.parse("${ApiConstants.carts}/add-staff/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: jsonEncode({"name": name, "phoneNumber": phoneNumber}),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 201) {
      print(StaffModel.fromJson(data['data']));
      return StaffModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to add staff",
        response.statusCode,
      );
    }
  }

  Future<List<StaffModel>> getAllStaff(String? token, String cartId) async {

    final response = await http
        .get(
          Uri.parse("${ApiConstants.carts}/get-all-staff/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : <String, dynamic>{};

    if (response.statusCode == 200) {
      return (data['staff'] as List<dynamic>)
          .map((e) => StaffModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    throw ApiException(
      data['message'] ?? "Failed to load staff",
      response.statusCode,
    );
  }

  Future<String> deleteStaff(String? token, String staffId) async {
    final response = await http
        .delete(
          Uri.parse("${ApiConstants.carts}/delete-staff/$staffId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return data['message'];
    } else {
      throw ApiException(
        data['message'] ?? "Failed to delete staff",
        response.statusCode,
      );
    }
  }

  Future<StaffModel> switchStaffCart(
    String? token,
    String staffId,
    String newCartId,
  ) async {
    final response = await http
        .put(
          Uri.parse("${ApiConstants.carts}/switch-staff-cart/$staffId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: jsonEncode({"cartId": newCartId}),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return StaffModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to switch staff's cart",
        response.statusCode,
      );
    }
  }
}
