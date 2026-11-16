import 'dart:convert';
import 'dart:io';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/core/utils/build_address.dart';
import 'package:http/http.dart' as http;
import '../models/cart_model.dart';

class CartService {
  Future<List<CartModel>> fetchUserCarts(String? token, String userId) async {
    
    final response = await http
        .get(
          Uri.parse("${ApiConstants.carts}/get-all-carts/$userId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
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

  Future<CartModel> createBasicCart(
    String token,
    Map<String, dynamic> cartDetails,
  ) async {
    final response = await http
        .post(
          Uri.parse("${ApiConstants.carts}/create-basic-cart"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode(cartDetails),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 201) {
      return CartModel.fromJson(data["cart"]);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to create cart",
        response.statusCode,
      );
    }
  }

  Future<int> fetchMenuItemCount(String cartId) async {
    final response = await http
        .get(Uri.parse("${ApiConstants.carts}/get-menu-items/$cartId"))
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return (data['count'] as num?)?.toInt() ?? 0;
    } else {
      throw ApiException(
        data['message'] ?? "Failed to load menu",
        response.statusCode,
      );
    }
  }

  Future<CartModel> updateCartDetails(
    String token,
    String cartId,
    Map<String, dynamic> cartDetails,
  ) async {
    final response = await http
        .put(
          Uri.parse("${ApiConstants.carts}/update-cart/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode(cartDetails),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return CartModel.fromJson(data["cart"]);
    } else {
      throw ApiException(
        data['message'] ?? "Failed to update cart",
        response.statusCode,
      );
    }
  }

  Future<dynamic> updateLocation(
    String? token,
    Placemark placemark,
    double? lat,
    double? lng,
    String cartId,
  ) async {
    final response = await http
        .post(
          Uri.parse("${ApiConstants.carts}/update-location/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode({
            "lat": lat,
            "lng": lng,
            // No address when the phone's geocoder found none or timed out:
            // the server needs one, so the coordinates stand in for it.
            "address": buildAddress(placemark).trim().isNotEmpty
                ? buildAddress(placemark)
                : "${lat?.toStringAsFixed(5)}, ${lng?.toStringAsFixed(5)}",
          }),
        )
        .timeout(const Duration(seconds: 10));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      return data['data'];
    } else {
      throw ApiException(
        data['message'] ?? "Failed to update location",
        response.statusCode,
      );
    }
  }

  Future<bool> uploadCartPhoto(
    String? token,
    String cartId,
    File imageFile,
  ) async {
    final extension = imageFile.path.split('.').last.toLowerCase();
    // "image/jpg" isn't a real MIME type.
    final contentType = "image/${extension == 'jpg' ? 'jpeg' : extension}";

    final response = await http
        .post(
          Uri.parse("${ApiConstants.carts}/generate-cart-image-url/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode({
            "fileType": contentType,
          }),
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

    final fileBytes = await imageFile.readAsBytes();

    final uploadResponse = await http
        .put(
          Uri.parse(uploadUrl),
          headers: {
            "Content-Type": contentType,
          },
          body: fileBytes,
        )
        // A photo over mobile data can take a while.
        .timeout(const Duration(seconds: 60));

    if (uploadResponse.statusCode != 200) {
      throw ApiException(
        "Failed to upload image to storage",
        uploadResponse.statusCode,
      );
    }

    final confirmResponse = await http
        .put(
          Uri.parse("${ApiConstants.carts}/update-cart-image/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode({"imageUrl": fileUrl}),
        )
        .timeout(const Duration(seconds: 10));

    final confirmData = confirmResponse.body.isNotEmpty
        ? jsonDecode(confirmResponse.body)
        : {};

    if (confirmResponse.statusCode != 200) {
      throw ApiException(
        confirmData['message'] ?? "Failed to save image URL",
        confirmResponse.statusCode,
      );
    }

    return true;
  }

  /// The main road this spot is right next to ('' when it has no name), or
  /// null when there is none. Only a hint for the "near a main road" warning,
  /// so any failure (slow network, old server) also gives null.
  Future<String?> mainRoadNear(String? token, double lat, double lng) async {
    try {
      final response = await http
          .get(
            Uri.parse("${ApiConstants.carts}/main-road?lat=$lat&lng=$lng"),
            headers: {"Authorization": "Bearer $token"},
          )
          .timeout(const Duration(seconds: 5));
      if (response.statusCode != 200) return null;
      return json.decode(response.body)['road'] as String?;
    } catch (_) {
      return null;
    }
  }
}
