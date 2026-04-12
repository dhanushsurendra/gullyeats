import 'dart:convert';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:http/http.dart' as http;
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';

class MenuService {

  Future<void> saveMenuItems(String? token, List<MenuItemModel> items, String cartId) async {
    final response = await http.post(
      Uri.parse("${ApiConstants.carts}/create-menu/$cartId"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({
        "items": items.map((item) => item.toJson()).toList(),
      }),
    ).timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode != 201) {
      throw ApiException(
        data['message'] ?? "Failed to save menu items",
        response.statusCode,
      );
    }
  }
}