import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';

/// The "GullyEats" wordmark. In the dark theme the black "Eats" turns white
/// and the orange "Gully" stays orange: the filter keys off the red channel,
/// which is 0 for black and ~254 for the brand orange.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key});

  static const _darkFilter = ColorFilter.matrix([
    -0.0039, 0, 0, 0, 255, //
    -0.681, 0, 0, 0, 255, //
    -1.004, 0, 0, 0, 255, //
    0, 0, 0, 1, 0, //
  ]);

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset('assets/images/logo_text.png', height: 24);
    return AppColors.dark ? ColorFiltered(colorFilter: _darkFilter, child: logo) : logo;
  }
}
