import 'package:flutter/material.dart';
import 'package:gullyeats/features/menu/services/menu_service.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';

class MenuProvider with ChangeNotifier {
  final MenuService _menuService = MenuService();

  /// Common item names suggested while typing a menu; fetched once.
  List<String> _foodNames = [];

  @visibleForTesting
  set debugFoodNames(List<String> names) => _foodNames = names;

  Future<void> loadFoodNames(String? token) async {
    if (_foodNames.isNotEmpty) return;
    try {
      _foodNames = await _menuService.fetchFoodNames(token);
    } catch (_) {
      // Suggestions are a convenience: without them staff just type.
    }
  }

  /// Up to [limit] names with a word starting with [query], then ones
  /// containing it. The list is already sorted by how common each item is.
  List<String> suggestFoodNames(String query, {int limit = 8}) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    final first = <String>[], rest = <String>[];
    for (final name in _foodNames) {
      final lower = name.toLowerCase();
      if (lower.startsWith(q) || lower.split(' ').any((w) => w.startsWith(q))) {
        first.add(name);
        if (first.length == limit) break;
      } else if (rest.length < limit && lower.contains(q)) {
        rest.add(name);
      }
    }
    return [...first, ...rest].take(limit).toList();
  }

  Future<bool> saveMenu(String? token, List<MenuItemModel> items, String cartId) async {
    try {
      await _menuService.saveMenuItems(token, items, cartId);
      return true;
    } finally {
      notifyListeners();
    }
  }
}