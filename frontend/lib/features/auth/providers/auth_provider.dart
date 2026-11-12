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
      await prefs.setString('phoneNumber', phone);

      String userJson = jsonEncode(userMap);
      await prefs.setString('user_data', userJson);

      _token = token;
      return {'userId': res['user']['_id'], 'pin': res['pin']};
    } finally {
      notifyListeners();
    }
  }

  /// Returns the outlet list's arguments: the vendor's `userId` (database ID)
  /// and `phoneNumber`.
  Future<Map<String, dynamic>> loginWithPin(
    String identifier,
    String pin,
  ) async {
    final res = await _api.loginWithPin(identifier, pin);
    final user = res['user'] as Map<String, dynamic>;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', res['token']);
    await prefs.setString('userId', user['id']);
    await prefs.setString('phoneNumber', user['phoneNumber'] ?? identifier);

    _token = res['token'];
    notifyListeners();
    return {'userId': user['id'], 'phoneNumber': user['phoneNumber']};
  }

  Future<Map<String, dynamic>> resetPin() => _api.resetPin(_token);

  /// The outlet list's arguments for a vendor still logged in on this phone,
  /// or null. Loads the token too.
  Future<Map<String, dynamic>?> savedSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userId = prefs.getString('userId');
    if (_token == null || userId == null) return null;
    return {'userId': userId, 'phoneNumber': prefs.getString('phoneNumber')};
  }

  /// Leaving Your Carts is how staff move on to the next vendor.
  Future<void> logout() async {
    _token = null; // at once, so a second 401 while this runs doesn't sign out twice
    final prefs = await SharedPreferences.getInstance();
    for (final key in ['token', 'userId', 'phoneNumber', 'user_data']) {
      await prefs.remove(key);
    }
    _token = null;
    notifyListeners();
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
  }
}
