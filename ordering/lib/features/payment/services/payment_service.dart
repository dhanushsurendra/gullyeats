import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/features/payment/models/payment_model.dart';
import 'package:ordering/features/payment/models/payment_overview_model.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/models/razorpay_checkout_model.dart';

class CreatePaymentResult {
  final PaymentModel payment;
  final RazorpayCheckoutModel checkout;
  final bool isLocked;
  final bool existingPayment;

  const CreatePaymentResult({
    required this.payment,
    required this.checkout,
    required this.isLocked,
    required this.existingPayment,
  });
}

class PaymentService {
  Future<PaymentOverviewModel> getOverview(String? token, String cartId) async {
    final response = await http
        .get(
          Uri.parse('${ApiConstants.payments}/payments-overview/$cartId'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decode(response);

    if (response.statusCode == 200) {
      return PaymentOverviewModel.fromJson(data as Map<String, dynamic>);
    }

    throw ApiException(
      data['message'] ?? 'Failed to load payment overview',
      response.statusCode,
    );
  }

  /// Creates/retrieves the backend payment and Razorpay order.
  ///
  /// The amount is NEVER supplied by Flutter.
  /// The backend calculates it from the cart's billing period.
  Future<CreatePaymentResult> createPayment(
    String? token,
    String cartId,
  ) async {
    final response = await http
        .post(
          Uri.parse('${ApiConstants.payments}/create-razorpay-order/$cartId'),
          headers: _headers(token),
          body: jsonEncode({'cartId': cartId}),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final payment = PaymentModel.fromJson(
        data['payment'] as Map<String, dynamic>,
      );

      final checkout = RazorpayCheckoutModel.fromJson(
        data['checkout'] as Map<String, dynamic>,
      );

      return CreatePaymentResult(
        payment: payment,
        checkout: checkout,
        isLocked: data['isLocked'] as bool? ?? true,
        existingPayment: data['existingPayment'] as bool? ?? false,
      );
    }

    throw ApiException(
      data['message'] ?? 'Failed to start payment',
      response.statusCode,
    );
  }

  /// Sends Razorpay's checkout callback to the backend.
  ///
  /// The backend verifies the signature using the Razorpay secret.
  Future<PaymentModel> verifyPayment({
    required String? token,
    required String paymentId,
    required String razorpayPaymentId,
    required String razorpayOrderId,
    required String razorpaySignature,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiConstants.payments}/verify/$paymentId'),
          headers: _headers(token),
          body: jsonEncode({
            'razorpay_payment_id': razorpayPaymentId,
            'razorpay_order_id': razorpayOrderId,
            'razorpay_signature': razorpaySignature,
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);

    if (response.statusCode == 200) {
      return PaymentModel.fromJson(data['payment'] as Map<String, dynamic>);
    }

    throw ApiException(
      data['message'] ?? 'Payment verification failed',
      response.statusCode,
    );
  }

  Future<PaymentStatusModel> checkPaymentStatus(
    String token,
    String cartId,
  ) async {
    final response = await http.get(
      Uri.parse('${ApiConstants.payments}/payment-status/$cartId'),
      headers: _headers(token),
    )
    .timeout(const Duration(seconds: 10));

    final data = _decode(response);

    print(data);

    if (response.statusCode == 200) {
      return PaymentStatusModel.fromJson(data as Map<String, dynamic>);
    }

    throw ApiException(
      data['message'] ?? 'Failed to check payment status',
      response.statusCode,
    );
  }

  Future<List<PaymentModel>> getHistory(
    String? token,
    String cartId, {
    String? preset,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final params = <String, String>{};

    DateTime? resolvedStartDate;
    DateTime? resolvedEndDate;

    if (startDate != null && endDate != null) {
      resolvedStartDate = startDate;
      resolvedEndDate = endDate;
    } else if (preset != null) {
      final now = DateTime.now();

      // Use only the calendar date.
      final today = DateTime(now.year, now.month, now.day);

      switch (preset) {
        case 'today':
          resolvedStartDate = today;
          resolvedEndDate = today;
          break;

        case 'yesterday':
          final yesterday = today.subtract(const Duration(days: 1));

          resolvedStartDate = yesterday;
          resolvedEndDate = yesterday;
          break;

        case 'week':
          // Monday → today
          final startOfWeek = today.subtract(
            Duration(days: today.weekday - DateTime.monday),
          );

          resolvedStartDate = startOfWeek;
          resolvedEndDate = today;
          break;

        case 'last30days':
          resolvedStartDate = today.subtract(const Duration(days: 29));
          resolvedEndDate = today;
          break;
      }
    }

    if (resolvedStartDate != null && resolvedEndDate != null) {
      params['startDate'] = _formatDate(resolvedStartDate);
      params['endDate'] = _formatDate(resolvedEndDate);
    }

    final uri = Uri.parse(
      '${ApiConstants.payments}/payment-history/$cartId',
    ).replace(queryParameters: params.isEmpty ? null : params);

    final response = await http
        .get(uri, headers: _headers(token))
        .timeout(const Duration(seconds: 10));

    final data = _decode(response);

    if (response.statusCode == 200) {
      final list = (data['payments'] ?? data['history'] ?? []) as List;

      return list
          .map((e) => PaymentModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    throw ApiException(
      data['message'] ?? 'Failed to load payment history',
      response.statusCode,
    );
  }

  String _formatDate(DateTime date) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }

    return jsonDecode(response.body);
  }
}
