import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cart_model.dart';
import '../services/cart_service.dart';

class CartProvider with ChangeNotifier {
  final CartService _cartService = CartService();

  List<CartModel> _carts = [];

  List<CartModel> get carts => _carts;
  String? _cartId;
  String? get cartId => _cartId;

  String? _cartGeneratedId;
  String? get cartGeneratedId => _cartGeneratedId;

  String? _cartName;
  String? get cartName => _cartName;

  Future<List<CartModel>> loadCarts(String? token) async {
    try {
      _carts = await _cartService.fetchUserCarts(token);
      return _carts;
    } finally {
      notifyListeners();
    }
  }

  Future<CartModel?> createCart(
    String token,
    Map<String, dynamic> cartDetails,
  ) async {
    try {
      final cart = await _cartService.createBasicCart(token, cartDetails);
      SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString("cart", json.encode(cart.toJson()));
      return cart;
    } finally {
      notifyListeners();
    }
  }

  CartModel? findById(String id) {
    return _carts.firstWhere((cart) => cart.id == id);
  }

  List<CartModel> searchCarts(String query) {
    if (query.isEmpty) return carts;

    final q = query.toLowerCase();

    return carts.where((cart) {
      final name = cart.cartName.toLowerCase();
      final city = cart.cartCity.toLowerCase();
      final address = cart.address.toLowerCase();

      return name.contains(q) || city.contains(q) || address.contains(q);
    }).toList();
  }

  Future<dynamic> updateCartLocation(
    String? token,
    Placemark placemark,
    String cartId,
    double? latitude,
    double? longitude,
  ) async {
    try {
      final cart = await _cartService.updateLocation(
        token,
        placemark,
        latitude,
        longitude,
        cartId,
      );
      return cart;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> uploadPhoto(String? token, String cartId, File imageFile) async {
    try {
      final result = await _cartService.uploadCartPhoto(
        token,
        cartId,
        imageFile,
      );
      return result;
    } finally {
      notifyListeners();
    }
  }

  Future<void> loadCartId() async {
    final prefs = await SharedPreferences.getInstance();

    final cartString = prefs.getString("cart");
    if (cartString == null) return;

    try {
      final cartJson = json.decode(cartString) as Map<String, dynamic>;
      _cartId = cartJson["_id"] as String?;
    } catch (e) {
      _cartId = null;
    }
    notifyListeners();
  }

  Future<void> loadCartDetails() async {
    final prefs = await SharedPreferences.getInstance();

    final cartString = prefs.getString("cart");
    if (cartString == null) return;

    try {
      final cartJson = json.decode(cartString) as Map<String, dynamic>;
      _cartGeneratedId = cartJson["cartId"] as String?;
      _cartName = cartJson["cartName"] as String?;
    } catch (e) {
      _cartGeneratedId = null;
    }
    notifyListeners();
  }
}
