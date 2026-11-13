import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/routes/routes.dart';
import 'package:ordering/core/theme/app_theme.dart';
import 'package:ordering/core/theme/theme_provider.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:ordering/l10n/app_localizations.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/splash/presentation/splash_screen.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final language = LanguageProvider();
  await language.load();
  final theme = ThemeProvider();
  await theme.load();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: language),
        ChangeNotifierProvider.value(value: theme),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => MenuProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProfileProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
        ChangeNotifierProvider(create: (_) => PaymentProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    context.watch<ThemeProvider>();
    return MaterialApp(
      title: 'GullyEats Partner',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      locale: context.watch<LanguageProvider>().locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: AppTheme.current,
      routes: Routes.getRoutes(),
      home: const SplashScreen(),
    );
  }
}
