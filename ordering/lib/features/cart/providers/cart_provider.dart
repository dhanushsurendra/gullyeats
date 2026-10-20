import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/models/sales_model.dart';
import 'package:ordering/features/cart/services/cart_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CartProvider with ChangeNotifier {
  final CartService _cartService = CartService();

  List<CartModel> _carts = [];

  List<CartModel> get carts => _carts;
  String? _cartId;
  String? get cartId => _cartId;

  SalesModel? _sales;
  SalesModel? get sales => _sales;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _cartGeneratedId;
  String? get cartGeneratedId => _cartGeneratedId;

  String? _cartName;
  String? get cartName => _cartName;

  CartModel? _selectedCart;
  CartModel? get selectedCart => _selectedCart;

  Future<List<CartModel>> loadCarts(String token, String userId) async {
    try {
      _isLoading = true;
      notifyListeners();
      _carts = await _cartService.fetchUserCarts(token, userId);
      return _carts;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
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

  Future<void> selectCart(CartModel cart) async {
    _selectedCart = cart;

    final prefs = await SharedPreferences.getInstance();

    await prefs.setString('selected_cart', jsonEncode(cart.toJson()));

    notifyListeners();
  }

  Future<void> loadSelectedCart() async {
    final prefs = await SharedPreferences.getInstance();

    final cartString = prefs.getString('selected_cart');

    if (cartString != null) {
      _selectedCart = CartModel.fromJson(jsonDecode(cartString));
    }

    notifyListeners();
  }

  Future<void> toggleCartStatus(
    String token,
    String cartId,
    bool isOpen,
  ) async {
    try {
      final updatedCart = await _cartService.toggleCartStatus(
        token,
        cartId,
        isOpen,
      );

      final index = _carts.indexWhere((cart) => cart.id == cartId);
      if (index != -1) {
        _carts[index] = updatedCart;
      }

      if (_selectedCart?.id == cartId) {
        _selectedCart = updatedCart;
      }
    } finally {
      notifyListeners();
    }
  }

  Future<void> loadSales(
    String? token,
    String startDate,
    String endDate,
  ) async {
    _isLoading = true;

    try {
      final cartId = _selectedCart?.id;
      _sales = await _cartService.fetchSales(
        token,
        cartId!,
        startDate,
        endDate,
      );
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<CartModel> updateCart(
    String? token,
    CartModel cart, {
    File? imageFile,
  }) async {
    try {
      final updatedCart = await _cartService.updateCartDetails(
        token,
        cart,
        imageFile: imageFile,
      );

      _replaceCartInList(updatedCart);
      await _persistCurrentCart(updatedCart);

      return updatedCart;
    } finally {
      notifyListeners();
    }
  }

  CartModel? findById(String id) {
    try {
      return _carts.firstWhere((cart) => cart.id == id);
    } catch (_) {
      return null;
    }
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

  void _replaceCartInList(CartModel updatedCart) {
    final index = _carts.indexWhere((cart) => cart.id == updatedCart.id);

    if (index != -1) {
      _carts[index] = updatedCart;
    }

    if (_selectedCart?.id == updatedCart.id) {
      _selectedCart = updatedCart;
    }
  }

  Future<void> _persistCurrentCart(CartModel cart) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("cart", json.encode(cart.toJson()));
    _cartId = cart.id;
  }

  Future<void> clear() async {
    // Clear in-memory state
    _carts = [];
    _cartId = null;
    _sales = null;
    _isLoading = false;
    _cartGeneratedId = null;
    _cartName = null;
    _selectedCart = null;

    // Clear persisted cart state
    final prefs = await SharedPreferences.getInstance();

    await prefs.remove('selected_cart');
    await prefs.remove('cart');

    notifyListeners();
  }
}
