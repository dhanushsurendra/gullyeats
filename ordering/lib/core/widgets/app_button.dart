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
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
        // Min height (not fixed): the button grows with large system text.
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: height,
            minWidth: width ?? 0,
            maxWidth: width ?? double.infinity,
          ),
          child: DottedBorder(
            options: RoundedRectDottedBorderOptions(
              dashPattern: [10, 5],
              strokeWidth: 2,
              color: borderColor ?? AppColors.grey300,
              radius: Radius.circular(borderRadius),
              // 14 vertical: 52px tall at normal text size.
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            child: Center(
              heightFactor: 1,
              child: Text(
                label,
                textAlign: TextAlign.center,
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
      width: width,
      child: ElevatedButton(
        onPressed: isDisabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          // Min height (not fixed): the button grows with large system text.
          minimumSize: Size(0, height),
          elevation: elevation,
          backgroundColor: backgroundColor ?? AppColors.primary,
          foregroundColor: textColor ?? Colors.white,
          padding: padding,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            side: borderColor != null
                ? BorderSide(
                    color: isDisabled && !isLoading
                        ? AppColors.grey300
                        : borderColor!,
                  )
                : BorderSide.none,
          ),
        ),
        // Disabled: the theme's grey text, not the custom color.
        child: _buildChild(textColor: isDisabled ? null : textColor),
      ),
    );
  }

  Widget _buildChild({bool isDotted = false, Color? textColor}) {
    if (isLoading) {
      return SizedBox(
        height: 20,
        width: 20,
        // On a white button a white spinner would be invisible.
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: backgroundColor == AppColors.white
              ? AppColors.primary
              : Colors.white,
        ),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: 8)],
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style:
                textStyle ??
                AppTextStyles.button.copyWith(
                  color: isDotted ? (textColor ?? AppColors.primary) : textColor,
                ),
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 8), trailing!],
      ],
    );
  }
}
