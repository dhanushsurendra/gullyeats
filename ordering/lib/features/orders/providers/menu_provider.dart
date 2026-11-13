import 'dart:io';

import 'package:flutter/material.dart';
import 'package:ordering/features/orders/models/food_name_model.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/services/menu_service.dart';

class MenuProvider extends ChangeNotifier {
  final MenuService _menuService = MenuService();

  List<MenuItemModel> _menuItems = [];
  List<MenuItemModel> get menuItems => _menuItems;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  /// Common item names suggested while adding an item; fetched once.
  List<FoodNameModel> _foodNames = [];

  @visibleForTesting
  void debugSetFoodNames(List<FoodNameModel> names) => _foodNames = names;

  Future<void> loadFoodNames(String? token) async {
    if (_foodNames.isNotEmpty) return;
    try {
      _foodNames = await _menuService.fetchFoodNames(token);
    } catch (_) {
      // Suggestions are a convenience: without them the vendor just types.
    }
  }

  /// Up to [limit] names starting with [query] (any word, English or the
  /// app's language), then ones containing it. The list is already sorted by
  /// how common each item is.
  List<FoodNameModel> suggestFoodNames(String query, {int limit = 8}) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    bool starts(String s) =>
        s.toLowerCase().split(' ').any((w) => w.startsWith(q)) ||
        s.toLowerCase().startsWith(q);
    final first = <FoodNameModel>[], rest = <FoodNameModel>[];
    for (final n in _foodNames) {
      if (starts(n.name) || starts(n.displayName)) {
        first.add(n);
        if (first.length == limit) break;
      } else if (rest.length < limit &&
          (n.name.toLowerCase().contains(q) || n.displayName.contains(q))) {
        rest.add(n);
      }
    }
    return [...first, ...rest].take(limit).toList();
  }

  Future<void> fetchMenuItems(String? token, String cartId) async {
    try {
      _isLoading = true;
      _menuItems = (await _menuService.fetchMenu(token, cartId)).items;
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
    return _menuItems.where((item) => item.matches(query)).toList();
  }

  /// Updates the item optimistically; on failure it reverts and rethrows so
  /// the screen can say so.
  Future<void> toggleStock(
    String? token,
    String id,
    String cartId,
    bool value,
  ) async {
    final index = _menuItems.indexWhere((e) => e.id == id);
    if (index == -1) return;

    final old = _menuItems[index];

    _menuItems[index] = old.copyWith(isInStock: value);
    notifyListeners();

    try {
      await _menuService.updateStock(token, id, cartId, value);
    } catch (_) {
      _menuItems[index] = old;
      notifyListeners();
      rethrow;
    }
  }

  void clear() {
    _menuItems = [];
    _isLoading = false;

    notifyListeners();
  }
}
