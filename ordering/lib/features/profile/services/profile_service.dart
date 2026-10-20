import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';

class ProfileService {
  static const _timeout = Duration(seconds: 15);

  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token?.isNotEmpty ?? false) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> getQrDetails(
    String? token,
    String cartId,
  ) async {
    final response = await http
        .get(
          Uri.parse('${ApiConstants.carts}/get-qr-details/$cartId'),
          headers: _headers(token),
        )
        .timeout(_timeout);

    final data = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : <String, dynamic>{};

    if (response.statusCode == 200) {
      return data;
    }

    throw ApiException(
      data['message'] ?? 'Failed to fetch QR details',
      response.statusCode,
    );
  }
}
