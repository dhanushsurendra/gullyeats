import 'package:flutter/material.dart';
import 'package:ordering/app/home/home_screen.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/features/auth/presentation/login_screen.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/presentation/welcome_screen.dart';
import 'package:ordering/features/orders/screens/add_new_item.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/presentation/payment_lock_screen.dart';

class Routes {
  static Map<String, WidgetBuilder> getRoutes() {
    return {
      AppRoutes.switchCart: (context) =>
          const SwitchCartScreen(isDraggable: false),
      AppRoutes.login: (context) => const LoginScreen(),
      AppRoutes.home: (context) => const HomeScreen(),
      AppRoutes.welcome: (context) => const WelcomeScreen(),
      AppRoutes.addNewItem: (context) => const AddItemScreen(),
      AppRoutes.paymentLockScreen: (context) {
        final paymentStatus =
            ModalRoute.of(context)!.settings.arguments as PaymentStatusModel;

        return PaymentLockScreen(
          cartName: paymentStatus.cartName,
          cartAddress: paymentStatus.address,
          ordersCompleted: paymentStatus.totalOrders,
          platformFee: paymentStatus.totalPending,
          amountDue: paymentStatus.totalPending,
          totalPaid: 0,
        );
      },
    };
  }
}
