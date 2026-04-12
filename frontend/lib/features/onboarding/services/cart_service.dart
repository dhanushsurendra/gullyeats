import 'dart:convert';
import 'dart:io';
import 'package:geocoding/geocoding.dart';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/core/utils/build_address.dart';
import 'package:http/http.dart' as http;
import '../models/cart_model.dart';

class CartService {
  Future<List<CartModel>> fetchUserCarts(String? token) async {
    final response = await http
        .get(
          Uri.parse("${ApiConstants.carts}/get-all-carts/"),
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
            "address": buildAddress(placemark),
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
    final response = await http
        .post(
          Uri.parse("${ApiConstants.carts}/generate-url/$cartId"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $token",
          },
          body: json.encode({
            "fileType": "image/${imageFile.path.split('.').last}", 
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
            "Content-Type":
                "image/${imageFile.path.split('.').last.toLowerCase()}",
          },
          body: fileBytes,
        )
        .timeout(const Duration(seconds: 10));

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
}
