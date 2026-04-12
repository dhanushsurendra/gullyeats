import 'package:dotted_border/dotted_border.dart'; // Add this import
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  final bool isLoading;
  final bool disabled;
  final bool isDotted; // Added this

  final double height;
  final double? width;

  final EdgeInsetsGeometry padding;

  final Color? backgroundColor;
  final Color? textColor;
  final Color? borderColor;

  final double borderRadius;
  final double elevation;

  final Widget? leading;
  final Widget? trailing;

  final TextStyle? textStyle;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.disabled = false,
    this.isDotted = false, // Default to false
    this.height = 52,
    this.width = double.infinity,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
    this.backgroundColor,
    this.textColor,
    this.borderColor,
    this.borderRadius = 26,
    this.elevation = 0,
    this.leading,
    this.trailing,
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    final bool isDisabled = disabled || isLoading;

    if (isDotted) {
      return InkWell(
        onTap: isDisabled ? null : onPressed,
        child: SizedBox(
          height: height,
          width: width,
          child: DottedBorder(
            options: RoundedRectDottedBorderOptions(
              dashPattern: [10, 5],
              strokeWidth: 2,
              color: borderColor ?? AppColors.grey300,
              radius: Radius.circular(borderRadius),
              padding: EdgeInsets.all(16),
            ),
            child: Center(
              child: Text(
                label,
                style: AppTextStyles.heading3.copyWith(
                  color: textColor ?? AppColors.primary,
                ),
              ),
            ),
          ),
        ),
      );
    }

    // Standard Button logic
    return SizedBox(
      height: height,
      width: width,
      child: ElevatedButton(
        onPressed: isDisabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          elevation: elevation,
          backgroundColor: backgroundColor ?? AppColors.primary,
          foregroundColor: textColor ?? Colors.white,
          padding: padding,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            side: borderColor != null
                ? BorderSide(color: borderColor!)
                : BorderSide.none,
          ),
        ),
        child: _buildChild(),
      ),
    );
  }

  Widget _buildChild({bool isDotted = false}) {
    if (isLoading) {
      return const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: 8)],
        Text(
          label,
          style:
              textStyle ??
              AppTextStyles.button.copyWith(
                color: isDotted ? (textColor ?? AppColors.primary) : textColor,
              ),
        ),
        if (trailing != null) ...[const SizedBox(width: 8), trailing!],
      ],
    );
  }
}
