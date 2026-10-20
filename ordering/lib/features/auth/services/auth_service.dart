import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<bool> login(String identifier, String pin) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.vendors}/login'),
      headers: _headers(null),
      body: json.encode({"vendorIdentifier": identifier, "pin": pin}),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      final prefs = await SharedPreferences.getInstance();

      await prefs.setString('token', data['token']);

      await prefs.setString('user', jsonEncode(data['user']));

      return true;
    } else {
      throw ApiException(
        data['message'] ?? "Login failed",
        response.statusCode,
      );
    }
  }

  Future<bool> changePin(
    String? token,
    String currentPin,
    String userId,
    String newPin,
  ) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.vendors}/change-pin'),
      headers: _headers(token),
      body: json.encode({
        "currentPin": currentPin,
        "newPin": newPin,
        "id": userId,
      }),
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      final data = json.decode(response.body);

      throw ApiException(
        data['message'] ?? "Failed to change PIN",
        response.statusCode,
      );
    }
  }
}
