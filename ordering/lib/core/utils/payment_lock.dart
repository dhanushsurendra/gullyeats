import 'package:flutter/widgets.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:provider/provider.dart';

/// Re-checks the selected cart's platform-fee lock. When the cart is locked,
/// replaces every screen with the lock screen. Returns the status, or null
/// when it couldn't be checked.
Future<PaymentStatusModel?> checkPaymentLock(BuildContext context) async {
  final token = context.read<AuthProvider>().token;
  final cartId = context.read<CartProvider>().selectedCart?.id;
  final payments = context.read<PaymentProvider>();
  if (token == null || cartId == null) return null;

  final status = await payments.refreshStatus(token, cartId);
  if (status != null && status.isLocked) {
    navigatorKey.currentState?.pushNamedAndRemoveUntil(
      AppRoutes.paymentLockScreen,
      (_) => false,
      arguments: status,
    );
  }
  return status;
}
