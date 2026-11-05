import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';

/// The onboarding step a cart needs next, worked out from what the server
/// already has, so a cart left halfway can be resumed where it stopped.
/// Operating setup and staff are optional and leave nothing to check, so a
/// cart with a menu but no QR code resumes at operating setup.
String nextOnboardingRoute(CartModel cart, {required bool hasMenu}) {
  if (cart.cartImageUrl.isEmpty) return AppRoutes.cartPhoto;
  if (!cart.hasLocation) return AppRoutes.enableLocation;
  if (!hasMenu) return AppRoutes.addMenu;
  if (cart.qrImageUrl.isEmpty) return AppRoutes.operatingSetup;
  return AppRoutes.qrPoster;
}

/// Onboarding is finished once the QR poster has been generated.
bool isOnboardingComplete(CartModel cart) => cart.qrImageUrl.isNotEmpty;
