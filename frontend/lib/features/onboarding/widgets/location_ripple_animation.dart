import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';

class LocationRippleAnimation extends StatefulWidget {
  const LocationRippleAnimation({super.key});

  @override
  State<LocationRippleAnimation> createState() => _LocationRippleAnimationState();
}

class _LocationRippleAnimationState extends State<LocationRippleAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            _buildRipple(100, _controller.value, 0.3),
            _buildRipple(140, _controller.value, 0.2),
            _buildRipple(180, _controller.value, 0.1),
            const CircleAvatar(
              radius: 35,
              backgroundColor: AppColors.successAlt,
              child: Icon(Icons.check, color: AppColors.white, size: 40),
            ),
          ],
        );
      },
    );
  }

  Widget _buildRipple(double size, double value, double opacity) {
    return Container(
      width: size * (1 + value * 0.2), // Expands by 20%
      height: size * (1 + value * 0.2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.primary.withValues(alpha: opacity * (1 - value)),
          width: 2,
        ),
      ),
    );
  }
}