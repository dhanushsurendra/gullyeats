import 'package:flutter/material.dart';
import 'package:gullyeats/features/activation/services/activation_service.dart';

class CartActivatedProvider with ChangeNotifier {
  final CartActivatedService _cartActivatedService = CartActivatedService();

  Future<String> loadQR(String? token, String cartId) async {
    try {
      final qrImageUrl = await _cartActivatedService.generateQR(token, cartId);
      return qrImageUrl;
    } finally {
      notifyListeners();
    }
  }
}