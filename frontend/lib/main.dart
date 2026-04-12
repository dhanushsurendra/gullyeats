import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/routes/routes.dart';
import 'package:gullyeats/core/theme/app_theme.dart';
import 'package:gullyeats/features/activation/providers/activation_provider.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/menu/providers/menu_provider.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:gullyeats/features/splash/presentation/splash_screen.dart';
import 'package:gullyeats/features/staff_management/providers/staff_provider.dart';
import 'package:provider/provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CartActivatedProvider()),
        ChangeNotifierProvider(create: (_) => MenuProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GullyEats Vendor Onboarding',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: SplashScreen(),
      initialRoute: AppRoutes.splash,
      routes: Routes.getRoutes(),
    );
  }
}
