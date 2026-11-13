import 'dart:convert';
import 'package:gullyeats/core/constants/api_constants.dart';
import 'package:gullyeats/core/error/api_exception.dart';
import 'package:http/http.dart' as http;

class CartActivatedService {

  Future<String> generateQR(String? token, String cartId) async {
    final response = await http.post(
      Uri.parse("${ApiConstants.carts}/generate-cart-qr/$cartId"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    // The server renders the QR and uploads it to storage before replying.
    ).timeout(const Duration(seconds: 30));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 200) {
      return data['qrImageUrl'];
    } else {
      throw ApiException(
        data['message'] ?? "Failed to generate QR code",
        response.statusCode,
      );
    }
  }
}
