import 'dart:io';

import 'package:flutter/material.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/services/menu_service.dart';

class MenuProvider extends ChangeNotifier {
  final MenuService _menuService = MenuService();

  List<MenuItemModel> _menuItems = [];
  List<MenuItemModel> get menuItems => _menuItems;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<void> fetchMenuItems(String? token, String cartId) async {
    try {
      _isLoading = true;
      final items = await _menuService.fetchMenu(token, cartId);

      _menuItems = items;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String> uploadPhoto(
    String? token,
    String cartId,
    File imageFile,
  ) async {
    try {
      final result = await _menuService.uploadMenuItemPhoto(
        token,
        cartId,
        imageFile,
      );
      return result.fileUrl;
    } finally {
      notifyListeners();
    }
  }

  Future<({String fileUrl, String? oldImageUrl})> uploadEditMenuItemPhoto(
    String? token,
    String cartId,
    File imageFile,
    String menuItemId,
  ) async {
    try {
      final result = await _menuService.uploadMenuItemPhoto(
        token,
        cartId,
        imageFile,
        menuItemId: menuItemId,
      );

      return (fileUrl: result.fileUrl, oldImageUrl: result.oldImageUrl);
    } finally {
      notifyListeners();
    }
  }

  Future<MenuItemModel?> addMenuItem(
    String? token,
    MenuItemModel item,
    String cartId,
  ) async {
    try {
      _isLoading = true;
      final createdItem = await _menuService.addMenuItem(token, item, cartId);

      _menuItems.insert(0, createdItem);
      notifyListeners();

      return createdItem;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<MenuItemModel?> editMenuItem(
    String? token,
    String itemId,
    MenuItemModel updatedData,
    String? oldImageUrl,
  ) async {
    try {
      final updatedItem = await _menuService.editMenuItem(
        token,
        itemId,
        updatedData,
        oldImageUrl,
      );

      final index = _menuItems.indexWhere((item) => item.id == itemId);
      _menuItems[index] = updatedItem;

      return updatedItem;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteMenuItem(
    String? token,
    String itemId,
    String cartId,
  ) async {
    try {
      final isDeleted = await _menuService.deleteMenuItem(
        token,
        itemId,
        cartId,
      );

      if (isDeleted) {
        _menuItems.removeWhere((item) => item.id == itemId);
      }

      return isDeleted;
    } finally {
      notifyListeners();
    }
  }

  List<MenuItemModel> searchMenuItem(String query) {
    final lowerQuery = query.trim().toLowerCase();

    return _menuItems.where((item) {
      return item.name.toLowerCase().contains(lowerQuery);
    }).toList();
  }

  Future<void> toggleStock(String id, String cartId, bool value) async {
    final index = _menuItems.indexWhere((e) => e.id == id);
    if (index == -1) return;

    final old = _menuItems[index];

    _menuItems[index] = old.copyWith(isInStock: value);
    notifyListeners();

    try {
      await _menuService.updateStock(null, id, cartId, value);
    } catch (_) {
      _menuItems[index] = old;
      notifyListeners();
    }
  }

  void clear() {
    _menuItems = [];
    _isLoading = false;

    notifyListeners();
  }
}
