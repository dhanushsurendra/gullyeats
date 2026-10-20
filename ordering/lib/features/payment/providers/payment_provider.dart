import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/features/payment/models/payment_model.dart';
import 'package:ordering/features/payment/models/payment_overview_model.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/services/payment_service.dart';

class PaymentProvider with ChangeNotifier {
  final PaymentService _service = PaymentService();

  PaymentOverviewModel? overview;
  PaymentStatusModel? paymentStatus;
  PaymentModel? currentPayment;
  List<PaymentModel> history = [];

  bool isLoading = false;
  bool isHistoryLoading = false;
  bool isCreatingPayment = false;
  bool isVerifyingPayment = false;

  String? error;

  bool get isPaymentLocked {
    return overview?.isLocked ?? currentPayment?.isPending ?? true;
  }

  Future<void> loadPaymentOverview(String? token, String cartId) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      overview = await _service.getOverview(token, cartId);
      currentPayment = overview?.currentPayment;
    } catch (e) {
      error = AppExceptionHandler.getMessage(e);
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<CreatePaymentResult?> createPayment(
    String? token,
    String cartId,
  ) async {
    isCreatingPayment = true;
    error = null;
    notifyListeners();

    try {
      final result = await _service.createPayment(token, cartId);

      currentPayment = result.payment;

      return result;
    } catch (e) {
      error = AppExceptionHandler.getMessage(e);
      return null;
    } finally {
      isCreatingPayment = false;
      notifyListeners();
    }
  }

  Future<bool> verifyPayment({
    required String? token,
    required String paymentId,
    required String razorpayPaymentId,
    required String razorpayOrderId,
    required String razorpaySignature,
  }) async {
    isVerifyingPayment = true;
    error = null;
    notifyListeners();

    try {
      final payment = await _service.verifyPayment(
        token: token,
        paymentId: paymentId,
        razorpayPaymentId: razorpayPaymentId,
        razorpayOrderId: razorpayOrderId,
        razorpaySignature: razorpaySignature,
      );

      currentPayment = payment;

      return payment.isVerified;
    } catch (e) {
      error = AppExceptionHandler.getMessage(e);
      return false;
    } finally {
      isVerifyingPayment = false;
      notifyListeners();
    }
  }

  Future<PaymentStatusModel?> refreshStatus(String token, String cartId) async {
    try {
      final status = await _service.checkPaymentStatus(token, cartId);

      if (overview != null) {
        overview = overview!.copyWith(
          isLocked: status.isLocked,
          totalPending: status.totalPending,
        );
      }

      return status;
    } catch (e) {
      print(e);
      error = AppExceptionHandler.getMessage(e);
      paymentStatus = null;
      notifyListeners();
      return null;
    }
  }

  Future<void> loadPaymentHistory(
    String? token,
    String cartId, {
    String? preset,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    isHistoryLoading = true;
    error = null;
    notifyListeners();

    try {
      history = await _service.getHistory(
        token,
        cartId,
        preset: preset,
        startDate: startDate,
        endDate: endDate,
      );
    } catch (e) {
      error = AppExceptionHandler.getMessage(e);
    } finally {
      isHistoryLoading = false;
      notifyListeners();
    }
  }

  // void reset() {
  //   overview = null;
  //   currentPayment = null;
  //   history = [];
  //   error = null;
  //   notifyListeners();
  // }

  void clear() {
    overview = null;
    paymentStatus = null;
    currentPayment = null;
    history = [];

    isLoading = false;
    isHistoryLoading = false;
    isCreatingPayment = false;
    isVerifyingPayment = false;

    error = null;

    notifyListeners();
  }
}
