import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

/// A tinted notice at the top of Home (area alerts, the fee warning): an
/// icon, the text, optional action buttons under it, and an optional close
/// button. The icon and the close button sit on the text's first line,
/// however many lines follow: both are centred in a band as tall as the
/// close button, and the first line is centred in that band too (measured at
/// the phone's text size).
class NoticeBanner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;

  /// Buttons under the text ("I SEE IT TOO", "PAY NOW"); they bring their
  /// own padding.
  final List<Widget> actions;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;
  final String? dismissTooltip;
  final EdgeInsetsGeometry margin;

  const NoticeBanner({
    super.key,
    required this.icon,
    required this.color,
    required this.text,
    this.actions = const [],
    this.onTap,
    this.onDismiss,
    this.dismissTooltip,
    this.margin = const EdgeInsets.fromLTRB(16, 12, 16, 0),
  });

  static const double band = 40;

  @override
  Widget build(BuildContext context) {
    final textStyle = AppTextStyles.caption.copyWith(
      color: AppColors.grey600,
      fontWeight: FontWeight.w600,
    );
    final line = (TextPainter(
      text: TextSpan(text: 'A', style: textStyle),
      textScaler: MediaQuery.textScalerOf(context),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout()).height;
    final textTop = line < band ? (band - line) / 2 : 0.0;

    return Container(
      width: double.infinity,
      margin: margin,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 6, onDismiss == null ? 16 : 4, 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: band,
                  child: Center(child: Icon(icon, color: color, size: 20)),
                ),
                AppGaps.w12,
                Expanded(
                  child: Padding(
                    // Same space below the text as above it; actions under
                    // it bring their own.
                    padding: EdgeInsets.only(
                      top: textTop,
                      bottom: actions.isEmpty ? textTop : 0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(text, style: textStyle),
                        if (actions.isNotEmpty)
                          Wrap(
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 16,
                            children: actions,
                          ),
                      ],
                    ),
                  ),
                ),
                if (onDismiss != null)
                  SizedBox(
                    height: band,
                    child: IconButton(
                      onPressed: onDismiss,
                      tooltip: dismissTooltip,
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints.tightFor(
                        width: band,
                        height: band,
                      ),
                      icon: Icon(
                        Icons.close,
                        size: 18,
                        color: AppColors.grey500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A compact text button for [NoticeBanner.actions].
class NoticeAction extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback? onPressed;

  const NoticeAction({
    super.key,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: onPressed,
    style: TextButton.styleFrom(
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    ),
    child: Text(
      label,
      style: AppTextStyles.caption.copyWith(
        color: color,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}
