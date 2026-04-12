import 'dart:convert';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:http/http.dart' as http;

class AuthService {
  Future<String> sendOtp(String phone) async {
    final response = await http.post(
      Uri.parse("${ApiConstants.vendors}/send-otp"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"phoneNumber": phone, "role": "vendor"}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['otp'].toString();
    } else {
      throw ApiException(
        data['message'] ?? "Failed to send OTP",
        response.statusCode,
      );
    }
  }

  Future<Map<String, dynamic>> verifyOtp(String phone, String otp) async {
    final response = await http.post(
      Uri.parse("${ApiConstants.vendors}/verify-otp"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"phoneNumber": phone, "otp": otp}),
    );

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      throw ApiException(data["message"] ?? "OTP Verification failed", response.statusCode);
    }
  }
}
