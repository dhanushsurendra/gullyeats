import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/models/sales_model.dart';

class CartService {
  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<List<CartModel>> fetchUserCarts(String? token, String userId) async {
    final response = await http
        .get(
          Uri.parse("${ApiConstants.carts}/get-all-carts/$userId"),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 200) {
      return (data["carts"] as List)
          .map((e) => CartModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } else {
      throw ApiException(
        data['message'] ?? "Failed to fetch user carts",
        response.statusCode,
      );
    }
  }

  Future<CartModel> toggleCartStatus(
    String? token,
    String cartId,
    bool isOpen,
  ) async {
    final response = await http.put(
      Uri.parse("${ApiConstants.carts}/toggle-cart-status/$cartId"),
      headers: _headers(token),
    );

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode != 200) {
      throw ApiException(
        data['message'] ?? "Failed to toggle cart status",
        response.statusCode,
      );
    }
    return CartModel.fromJson(data["data"]);
  }

  Future<SalesModel> fetchSales(
    String? token,
    String cartId,
    String startDate,
    String endDate,
  ) async {
    final response = await http.get(
      Uri.parse(
        '${ApiConstants.carts}/sales-insights/$cartId?startDate=$startDate&endDate=$endDate',
      ),
      headers: _headers(token),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200) {
      return SalesModel.fromJson(data['data']);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to fetch sales",
        response.statusCode,
      );
    }
  }

  Future<CartModel> updateCartDetails(
    String? token,
    CartModel cart, {
    File? imageFile,
  }) async {
    final updates = {
      "cartName": cart.cartName,
      "cartCity": cart.cartCity,
      "address": cart.address,
      "cartImageUrl": cart.cartImageUrl,
      "isActive": cart.isActive,
      "isOpen": cart.isOpen,
      "parcelCharge": cart.parcelCharge,
      "location": {
        "type": cart.location.type,
        "coordinates": [cart.location.latitude, cart.location.longitude],
      },
    };

    // Upload the new image first, if one was selected.
    if (imageFile != null) {
      final ext = imageFile.path.split('.').last.toLowerCase();

      final response = await http
          .post(
            Uri.parse(
              "${ApiConstants.carts}/generate-cart-image-url/${cart.id}",
            ),
            headers: _headers(token),
            body: json.encode({"fileType": "image/$ext"}),
          )
          .timeout(const Duration(seconds: 10));

      final data = _decode(response);

      if (response.statusCode != 200) {
        throw ApiException(
          data['message'] ?? "Failed to generate upload URL",
          response.statusCode,
        );
      }

      final uploadUrl = data['uploadUrl'];
      final fileUrl = data['fileUrl'];

      final fileBytes = await imageFile.readAsBytes();

      final uploadResponse = await http
          .put(
            Uri.parse(uploadUrl),
            headers: {"Content-Type": "image/$ext"},
            body: fileBytes,
          )
          .timeout(const Duration(seconds: 15));

      if (uploadResponse.statusCode != 200) {
        throw ApiException(
          "Failed to upload image to storage",
          uploadResponse.statusCode,
        );
      }

      // Use the newly uploaded image URL in the single cart update request.
      updates["cartImageUrl"] = fileUrl;
    }

    // Update everything in ONE backend request.
    final response = await http
        .put(
          Uri.parse("${ApiConstants.carts}/update-cart/${cart.id}"),
          headers: _headers(token),
          body: json.encode(updates),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decode(response);

    if (response.statusCode == 200) {
      return CartModel.fromJson(data['cart'] ?? data['data']);
    }

    throw ApiException(
      data['message'] ?? "Failed to update cart details",
      response.statusCode,
    );
  }

  dynamic _decode(http.Response response) =>
      response.body.isNotEmpty ? jsonDecode(response.body) : {};
}
