import 'package:flutter/material.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:provider/provider.dart';

/// Lets code without a BuildContext (the error handler) reach the app.
final navigatorKey = GlobalKey<NavigatorState>();

bool _signingOut = false;

/// Clears every provider and the saved session, then shows the login screen.
Future<void> signOut(BuildContext context) async {
  if (_signingOut) return;
  _signingOut = true;

  try {
    context.read<OrderProvider>().clear();
    context.read<MenuProvider>().clear();
    context.read<ProfileProvider>().clear();
    context.read<StaffProvider>().clear();
    context.read<PaymentProvider>().clear();
    final cart = context.read<CartProvider>();
    final auth = context.read<AuthProvider>();

    await cart.clear();
    await auth.logout();

    navigatorKey.currentState?.pushNamedAndRemoveUntil(
      AppRoutes.login,
      (route) => false,
    );
  } finally {
    _signingOut = false;
  }
}

/// Called for every 401. With a saved session, the token has expired or
/// was revoked, so log out and return true. Without one it's a failed login
/// (wrong ID or PIN): left alone, returns false.
bool handleUnauthorized() {
  final context = navigatorKey.currentContext;
  if (context == null) return false;

  final token = context.read<AuthProvider>().token;
  if (token == null || token.isEmpty) return false;

  signOut(context);
  return true;
}
