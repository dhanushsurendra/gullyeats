import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';

class MenuService {
  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<List<MenuItemModel>> fetchMenu(String? token, String? cartId) async {
    final response = await http.get(
      Uri.parse('${ApiConstants.carts}/get-menu-items/$cartId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return (data['data'] as List)
          .map((item) => MenuItemModel.fromJson(item))
          .toList();
    } else {
      throw ApiException(
        data["message"] ?? "Failed to update order",
        response.statusCode,
      );
    }
  }

  Future<MenuItemModel> addMenuItem(
    String? token,
    MenuItemModel item,
    String cartId,
  ) async {
    final response = await http.post(
      Uri.parse('${ApiConstants.carts}/add-menu-item/$cartId'),
      headers: _headers(token),
      body: json.encode(item.toJson()),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 201) {
      return MenuItemModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to update order",
        response.statusCode,
      );
    }
  }

  Future<MenuItemModel> editMenuItem(
    String? token,
    String itemId,
    MenuItemModel item,
    String? oldImageUrl,
  ) async {
    final body = item.toJson();

    body['oldImageUrl'] = oldImageUrl;

    final response = await http.put(
      Uri.parse('${ApiConstants.carts}/update-menu-item/${item.cartId}'),
      headers: _headers(token),
      body: json.encode(body),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 201) {
      return MenuItemModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data["message"] ?? "Failed to update order",
        response.statusCode,
      );
    }
  }

  Future<bool> deleteMenuItem(
    String? token,
    String itemId,
    String cartId,
  ) async {
    final response = await http.delete(
      Uri.parse('${ApiConstants.carts}/delete-menu-item/$cartId/$itemId'),
      headers: _headers(token),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      return true;
    } else {
      throw ApiException(
        data["message"] ?? "Failed to update order",
        response.statusCode,
      );
    }
  }

  Future<({String fileUrl, String? oldImageUrl})> uploadMenuItemPhoto(
    String? token,
    String cartId,
    File imageFile, {
    String? menuItemId,
  }) async {
    final extension = imageFile.path.split('.').last.toLowerCase();
    final fileType = "image/$extension";

    // Generate URL
    final url = menuItemId == null
        ? "${ApiConstants.carts}/generate-menu-image-url/$cartId"
        : "${ApiConstants.carts}/generate-menu-image-url/$cartId/$menuItemId";

    final response = await http
        .post(
          Uri.parse(url),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode({"fileType": fileType}),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode != 200) {
      throw ApiException(
        data['message'] ?? "Failed to generate upload URL",
        response.statusCode,
      );
    }

    final uploadUrl = data['uploadUrl'];
    final fileUrl = data['fileUrl'];

    if (uploadUrl == null || fileUrl == null) {
      throw ApiException("Invalid upload URL response", response.statusCode);
    }

    // Upload directly to S3
    final fileBytes = await imageFile.readAsBytes();

    final uploadResponse = await http
        .put(
          Uri.parse(uploadUrl),
          headers: {"Content-Type": fileType},
          body: fileBytes,
        )
        .timeout(const Duration(seconds: 30));

    if (uploadResponse.statusCode != 200) {
      throw ApiException(
        "Failed to upload image to storage",
        uploadResponse.statusCode,
      );
    }

    return (
      fileUrl: fileUrl.toString(),
      oldImageUrl: data['oldImageUrl'] as String?,
    );
  }

  Future<bool> updateStock(
    String? token,
    String itemId,
    String cartId,
    bool isInStock,
  ) async {
    final response = await http.patch(
      Uri.parse('${ApiConstants.carts}/update-stock/$cartId/$itemId'),
      headers: _headers(token),
      body: jsonEncode({'isInStock': isInStock}),
    );

    final data = json.decode(response.body);

    if (response.statusCode == 200) {
      return true;
    } else {
      throw ApiException(
        data["message"] ?? "Failed to update order",
        response.statusCode,
      );
    }
  }
}
