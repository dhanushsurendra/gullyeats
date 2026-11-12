import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';

/// Sweeps a light band across [child]'s painted pixels, left to right, so
/// grey [Bone]s inside it read as content on its way. Use it, never a
/// spinner, wherever a screen, list or image is loading.
class Shimmer extends StatefulWidget {
  final Widget child;

  /// Fixed colours for a surface that ignores the theme (the printed QR
  /// poster); by default they follow it.
  final Color? base;
  final Color? highlight;

  const Shimmer({super.key, required this.child, this.base, this.highlight});

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.base ?? AppColors.grey200;
    final highlight = widget.highlight ?? (AppColors.dark ? AppColors.grey300 : AppColors.white);
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        // srcATop: the gradient paints only where the child (the bones) is.
        blendMode: BlendMode.srcATop,
        shaderCallback: (rect) => LinearGradient(
          colors: [base, highlight, base],
          stops: const [0.35, 0.5, 0.65],
          begin: const Alignment(-1, -0.3),
          end: const Alignment(1, 0.3),
          transform: _Slide(_controller.value),
        ).createShader(rect),
        child: child,
      ),
    );
  }
}

/// Moves the gradient from fully left of the box to fully right of it.
class _Slide extends GradientTransform {
  final double t;
  const _Slide(this.t);

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * (t * 2 - 1), 0, 0);
}

/// A grey block standing in for content: a line of text, a card, an image.
/// Put it inside a [Shimmer]. Without [width] it fills the row.
class Bone extends StatelessWidget {
  final double? height;
  final double? width;
  final double radius;

  const Bone({super.key, this.height, this.width, this.radius = 12});

  /// A circle, for an avatar or an icon.
  const Bone.circle({super.key, required double size})
      : height = size,
        width = size,
        radius = 999;

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    width: width,
    decoration: BoxDecoration(
      color: AppColors.grey200,
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}

/// Shimmering card-shaped blocks for a screen or list loading for the first
/// time. [heights] are the blocks, top to bottom.
class Skeleton extends StatelessWidget {
  final List<double> heights;

  const Skeleton({super.key, required this.heights});

  /// [count] list rows of [height] each.
  Skeleton.rows({super.key, int count = 5, double height = 72})
      : heights = List.filled(count, height);

  // Not scrollable: it just clips when there's less room than the blocks
  // need, and sizes to them when there's more.
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    physics: const NeverScrollableScrollPhysics(),
    child: Shimmer(
      child: Column(
        children: [
          for (final height in heights)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Bone(height: height, radius: 16),
            ),
        ],
      ),
    ),
  );
}

/// Laid over content that is reloading (e.g. in a Positioned.fill): dims it
/// and sweeps the shimmer across, so the old numbers stay readable underneath.
class ShimmerVeil extends StatelessWidget {
  final double radius;

  const ShimmerVeil({super.key, this.radius = 12});

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Shimmer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.background.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    ),
  );
}
