import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_padding.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/routes/app_routes.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    Timer(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.pushReplacementNamed(context, AppRoutes.signup); 
      }
    });
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
              // Size from the 500px content column, not the whole window, so
              // the logo doesn't balloon on wide screens.
              final width = math.min(constraints.maxWidth, 500.0);
              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Spacer(flex: 2),
                      _buildHeader(width),
                      const Spacer(flex: 1),
                      _buildIllustration(screenHeight),
                      const Spacer(flex: 2),
                      _buildLoadingSection(width),
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

  Widget _buildHeader(double width) {
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
                      fontSize: (width * 0.08).clamp(24.0, 40.0),
                    ),
                  ),
                  TextSpan(
                    text: "Eats",
                    style: AppTextStyles.heading1.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: (width * 0.08).clamp(24.0, 40.0),
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
            fontSize: (width * 0.025).clamp(10.0, 14.0),
            letterSpacing: 1.01,
          ),
        ),
      ],
    );
  }

  Widget _buildIllustration(double screenHeight) {
    return Flexible(
      flex: 8,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: screenHeight * 0.4, 
        ),
        child: Image.asset(
          "assets/images/splash.png", 
          fit: BoxFit.contain,
        ),
      ),
    );
  }

  Widget _buildLoadingSection(double width) {
    return Column(
      children: [
        SizedBox(
          width: width * 0.4, 
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
          "Finding the best bites...",
          style: AppTextStyles.body.copyWith(
            fontSize: 12,
            color: AppColors.grey400,
          ),
        ),
      ],
    );
  }
}