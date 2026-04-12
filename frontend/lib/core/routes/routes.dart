import 'package:flutter/material.dart';
import 'package:gullyeats/features/auth/screens/signup_screen.dart';
import 'package:gullyeats/features/auth/screens/verify_otp_screen.dart';
import 'package:gullyeats/features/menu/screens/add_menu_screen.dart';
import 'package:gullyeats/features/menu/screens/menu_review_screen.dart';
import 'package:gullyeats/features/onboarding/screens/cart_details_screen.dart';
import 'package:gullyeats/features/onboarding/screens/cart_photo_screen.dart';
import 'package:gullyeats/features/onboarding/screens/carts_screen.dart';
import 'package:gullyeats/features/onboarding/screens/confirm_location_screen.dart';
import 'package:gullyeats/features/onboarding/screens/enable_location_screen.dart';
import 'package:gullyeats/features/splash/presentation/splash_screen.dart';
import 'package:gullyeats/features/staff_management/screens/operating_setup_screen.dart';
import 'package:gullyeats/features/staff_management/screens/staff_management_screen.dart';
import 'app_routes.dart';
import '../../features/activation/screens/cart_activated_screen.dart';
import '../../features/activation/screens/qr_poster_screen.dart';

class Routes {
  static Map<String, WidgetBuilder> getRoutes() {
    return {
      // splash
      AppRoutes.splash: (context) => const SplashScreen(),

      // auth
      AppRoutes.signup: (context) => const SignupScreen(),
      AppRoutes.verifyOtp: (context) => const VerifyOtpScreen(),

      // onboarding
      AppRoutes.carts: (context) => const CartsScreen(),
      AppRoutes.cartDetails: (context) => const CartDetailsScreen(),
      AppRoutes.cartPhoto: (context) => const CartPhotoScreen(),
      AppRoutes.addMenu: (context) => const AddMenuScreen(),
      AppRoutes.menuReview: (context) => const MenuReviewScreen.empty(),
      AppRoutes.operatingSetup: (context) => const OperatingSetupScreen(),
      AppRoutes.enableLocation: (context) => const EnableLocationScreen(),
      AppRoutes.confirmLocation: (context) => const ConfirmLocationScreen(),

      // staff management
      AppRoutes.staffManagement: (context) => const StaffManagementScreen(),
      AppRoutes.cartActivated: (context) => const CartActivatedScreen(),
      AppRoutes.qrPoster: (context) => const QrPosterScreen(),
    };
  }
}