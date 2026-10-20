import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:ordering/features/auth/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _token;
  String? get token => _token;

  Map<String, dynamic>? _user;
  Map<String, dynamic>? get user => _user;

  Future<bool> login(String identifier, String pin) async {
    try {
      _isLoading = true;
      notifyListeners();

      final isLoggedIn = await _authService.login(identifier, pin);

      return isLoggedIn;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> changePin(
    String? token,
    String currentPin,
    String newPin,
    String userId,
  ) async {
    try {
      _isLoading = true;

      final isChanged = await _authService.changePin(
        token,
        currentPin,
        userId,
        newPin,
      );

      return isChanged;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
  }

  Future<void> loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userString = prefs.getString('user');

    if (userString != null) {
      _user = jsonDecode(userString);
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _isLoading = false;

    final prefs = await SharedPreferences.getInstance();

    await prefs.remove('token');
    await prefs.remove('user');

    notifyListeners();
  }
}
