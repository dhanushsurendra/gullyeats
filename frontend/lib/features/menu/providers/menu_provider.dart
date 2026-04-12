import 'package:flutter/material.dart';
import 'package:gullyeats/features/menu/services/menu_service.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';

class MenuProvider with ChangeNotifier {
  final MenuService _menuService = MenuService();

  Future<bool> saveMenu(String? token, List<MenuItemModel> items, String cartId) async {
    try {
      await _menuService.saveMenuItems(token, items, cartId);
      return true;
    } finally {
      notifyListeners();
    }
  }
}