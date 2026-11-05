import 'package:flutter/widgets.dart';

/// Illustration height: [max] on regular phones, smaller on short screens so
/// the form below stays in view. Uses the window size, so it doesn't jump
/// when the keyboard opens.
double illustrationHeight(BuildContext context, double max) =>
    (MediaQuery.sizeOf(context).height * 0.225).clamp(120.0, max);
