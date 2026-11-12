import 'package:flutter/material.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';

/// Lets code without a BuildContext (the error handler) reach the app.
final navigatorKey = GlobalKey<NavigatorState>();

/// A 401 while logged in means the login expired or was revoked: log out and
/// show sign-up. Returns false when nobody is logged in (e.g. a wrong PIN).
bool handleUnauthorized() {
  final context = navigatorKey.currentContext;
  if (context == null) return false;
  final auth = context.read<AuthProvider>();
  if (auth.token == null) return false;
  auth.logout();
  navigatorKey.currentState?.pushNamedAndRemoveUntil(AppRoutes.signup, (_) => false);
  return true;
}
