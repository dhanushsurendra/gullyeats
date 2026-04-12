import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:gullyeats/features/auth/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _api = AuthService();

  String? _token;
  String? get token => _token;

  Future<String> sendOtp(String phone) async {
    try {
      final otp = await _api.sendOtp(phone);
      return otp;
    } finally {
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> verifyOtp(String phone, String otp) async {
    try {
      final res = await _api.verifyOtp(phone, otp);
      final String token = res['token'];
      final Map<String, dynamic> userMap = res['user'];
      
      SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', token);
      await prefs.setString('userId', userMap["_id"]);

      String userJson = jsonEncode(userMap);
      await prefs.setString('user_data', userJson);

      _token = token;
      return {'userId': res['user']['userId'], 'pin': res['pin']};
    } finally {
      notifyListeners();
    }
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
  }
}
