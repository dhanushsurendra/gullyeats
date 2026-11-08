import 'dart:async';
import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    await authProvider.loadToken();

    if (!mounted) return;

    if (authProvider.token != null && authProvider.token!.isNotEmpty) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const SwitchCartScreen(isDraggable: false),
        ),
      );
    } else {
      Navigator.pushReplacementNamed(context, AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    final double screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: AppPadding.screen,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Spacer(flex: 2),
                      _buildHeader(constraints),
                      const Spacer(flex: 1),
                      _buildIllustration(screenHeight),
                      const Spacer(flex: 2),
                      _buildLoadingSection(constraints),
                      const Spacer(flex: 1),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BoxConstraints constraints) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: "Gully",
                    style: AppTextStyles.heading1.copyWith(
                      color: AppColors.primary,
                      fontSize: _logoSize(constraints),
                    ),
                  ),
                  TextSpan(
                    text: "Eats",
                    style: AppTextStyles.heading1.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: _logoSize(constraints),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        AppGaps.h4,
        Text(
          "THE STREET FOOD REVOLUTION",
          style: AppTextStyles.body.copyWith(
            // Scales with width, capped so tablets don't get poster-size text.
            fontSize: (constraints.maxWidth * 0.025).clamp(10.0, 14.0),
            letterSpacing: 1.01,
          ),
        ),
      ],
    );
  }

  double _logoSize(BoxConstraints constraints) =>
      (constraints.maxWidth * 0.08).clamp(24.0, 40.0);

  Widget _buildIllustration(double screenHeight) {
    return Flexible(
      flex: 8,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: screenHeight * 0.4),
        child: Image.asset("assets/images/splash.png", fit: BoxFit.contain),
      ),
    );
  }

  Widget _buildLoadingSection(BoxConstraints constraints) {
    return Column(
      children: [
        SizedBox(
          width: constraints.maxWidth * 0.4,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              minHeight: 6,
              backgroundColor: AppColors.grey300,
              valueColor: AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
        ),
        AppGaps.h12,
        Text(
          context.l10n.findingBestBites,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.grey400,
          ),
        ),
      ],
    );
  }
}
