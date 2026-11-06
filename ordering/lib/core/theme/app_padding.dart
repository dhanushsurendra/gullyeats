import 'package:flutter/material.dart';

class AppPadding {
  AppPadding._();

  /// Screen padding
  static const EdgeInsets screen =
      EdgeInsets.symmetric(horizontal: 24, vertical: 24);

  /// Horizontal screen padding
  static const EdgeInsets horizontalScreen =
      EdgeInsets.symmetric(horizontal: 16);

  /// Vertical spacing
  static const EdgeInsets verticalScreen =
      EdgeInsets.symmetric(vertical: 16);

  /// Card padding
  static const EdgeInsets card =
      EdgeInsets.symmetric(horizontal: 16, vertical: 12);

  /// Small card
  static const EdgeInsets smallCard =
      EdgeInsets.symmetric(horizontal: 12, vertical: 8);

  /// Button padding
  static const EdgeInsets button =
      EdgeInsets.symmetric(horizontal: 24, vertical: 14);

  /// Input field padding
  static const EdgeInsets input =
      EdgeInsets.symmetric(horizontal: 16, vertical: 14);

  /// List item padding
  static const EdgeInsets listItem =
      EdgeInsets.symmetric(horizontal: 16, vertical: 12);

  /// Chip padding
  static const EdgeInsets chip =
      EdgeInsets.symmetric(horizontal: 12, vertical: 6);
}