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
      backgroundColor: AppColors.white,
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
                      fontSize: constraints.maxWidth * 0.08, // Dynamic font size
                    ),
                  ),
                  TextSpan(
                    text: "Eats",
                    style: AppTextStyles.heading1.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: constraints.maxWidth * 0.08,
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
            fontSize: constraints.maxWidth * 0.025,
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

  Widget _buildLoadingSection(BoxConstraints constraints) {
    return Column(
      children: [
        SizedBox(
          width: constraints.maxWidth * 0.4, 
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: const LinearProgressIndicator(
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