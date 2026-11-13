import 'package:flutter/material.dart';

/// Colour tokens. Neutrals follow the light/dark choice ([dark], set by
/// ThemeProvider), so screens never pick a theme themselves. [white] is always
/// white: use it for text and icons on orange or coloured fills, and [surface]
/// / [background] for cards and pages.
class AppColors {
  AppColors._();

  static bool dark = false;
  static Color _pick(int light, int night) => Color(dark ? night : light);

  // Primary brand
  static const Color primary = Color(0xFFFE5200);

  // Always white: text and icons on coloured fills.
  static const Color white = Color(0xFFFFFFFF);

  // Pages, and cards/sheets on them.
  static Color get background => _pick(0xFFFFFFFF, 0xFF0C0C0E);
  static Color get surface => _pick(0xFFFFFFFF, 0xFF17171A);

  // Main text ("black" in the light theme).
  static Color get black => _pick(0xFF000000, 0xFFF4F4F5);

  // Greys
  static Color get grey600 => _pick(0xFF4B5563, 0xFFC4C4CC);
  static Color get grey500 => _pick(0xFF6B7280, 0xFFA1A1AA);
  static Color get grey400 => _pick(0xFF757575, 0xFF8A8A94);
  static Color get grey300 => _pick(0xFFE5E5E5, 0xFF45454C);
  static Color get grey200 => _pick(0xFFEEEEEE, 0xFF2E2E33);
  static Color get grey100 => _pick(0xFFF5F5F5, 0xFF222226);

  // Light backgrounds
  static Color get lightOrange => _pick(0xFFFFF0E5, 0xFF3A1D0F);

  // Night: deep purple for celebration moments, always with orange actions
  // and white text. The same in both themes; use it for those moments, and
  // for neutral snackbars in the dark theme ([snackBar]).
  static const Color nightDeep = Color(0xFF0B1230);
  static const Color night = Color(0xFF1A0F45);
  static const Color nightSoft = Color(0xFF2A0F45);
  static const Color lilac = Color(0xFFA78BFA);

  /// Neutral (info) snackbars: dark grey on light pages, night purple on dark
  /// ones, where a grey would read as a light blob behind white text.
  static Color get snackBar => dark ? night : const Color(0xFF4B5563);

  // Status colors
  static const Color success = Color(0xFF16A34A);
  static const Color successAlt = Color(0xFF039855);
  static const Color error = Color(0xFFDC2626);
  static const Color warning = Color(0xFFE69A00);
}
