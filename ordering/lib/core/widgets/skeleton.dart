import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';

/// Pulsing grey placeholders shown while a screen loads for the first time.
/// [heights] are the blocks, top to bottom.
class Skeleton extends StatefulWidget {
  final List<double> heights;

  const Skeleton({super.key, required this.heights});

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
    lowerBound: 0.4,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _controller,
      child: Column(
        children: [
          for (final height in widget.heights)
            Container(
              height: height,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.grey200,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
        ],
      ),
    );
  }
}
