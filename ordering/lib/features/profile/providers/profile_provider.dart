import 'package:flutter/material.dart';
import 'package:ordering/features/profile/services/profile_service.dart';

class ProfileProvider with ChangeNotifier {
  final ProfileService _service = ProfileService();

  String? _cartId;
  String? get cartId => _cartId;

  String? _cartName;
  String? get cartName => _cartName;

  String? _qrImageUrl;
  String? get qrImageUrl => _qrImageUrl;

  String? _error;
  String? get error => _error;

  Future<void> loadQrDetails(String? token, String cartId) async {
    try {
      final data = await _service.getQrDetails(token, cartId);
      final qr = data['data'];
      _cartId = qr['cartId'];
      _cartName = qr['cartName'];
      _qrImageUrl = qr['qrImageUrl'];
    } finally {
      notifyListeners();
    }
  }

  void clear() {
    _cartId = null;
    _cartName = null;
    _qrImageUrl = null;
    _error = null;

    notifyListeners();
  }
}
