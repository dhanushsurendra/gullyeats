import 'dart:convert';

import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/features/staff_management/models/staff.dart';
import 'package:http/http.dart' as http;

class StaffService {

  Future<StaffModel> addStaff(
    String? token,
    String cartId,
    String name,
    String phoneNumber,
  ) async {
    final response = await http.post(
      Uri.parse("${ApiConstants.carts}/add-staff/$cartId"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({"name": name, "phoneNumber": phoneNumber}),
    ).timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 201) {
      return StaffModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to add staff",
        response.statusCode,
      );
    }
  }

  Future<List<StaffModel>> getAllStaff(String? token, String cartId) async {
    final response = await http.get(
      Uri.parse("${ApiConstants.carts}/get-all-staff/$cartId"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    ).timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 200) {
      return (data['staff'] as List<dynamic>)
          .map((e) => StaffModel.fromJson(e))
          .toList();
    } else {
      throw ApiException(
        data['message'] ?? "Failed to load staff",
        response.statusCode,
      );
    }
  }

  Future<String> deleteStaff(String? token, String staffId) async {
    final response = await http.delete(
      Uri.parse("${ApiConstants.carts}/delete-staff/$staffId"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    ).timeout(const Duration(seconds: 10));

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
}
