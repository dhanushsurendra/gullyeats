import 'package:flutter/material.dart';

/// Gives [child] (a Column that may use Spacer) at least the full available
/// height, and scrolls instead of overflowing when the content is taller.
class FillOrScroll extends StatelessWidget {
  final Widget child;

  const FillOrScroll({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: IntrinsicHeight(child: child),
        ),
      ),
    );
  }
}
