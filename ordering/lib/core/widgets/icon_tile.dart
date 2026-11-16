import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_card.dart';

/// A Profile-style row: a rounded icon badge whose top lines up with the
/// title's top (never centred against a two-line subtitle), the title and
/// subtitle, and an optional trailing widget centred on the badge.
class IconTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  /// A second, smaller line under the subtitle.
  final String? footnote;
  final VoidCallback? onTap;

  /// Defaults to a chevron when [onTap] is set.
  final Widget? trailing;

  /// Badge colours: orange by default, red for alerts.
  final Color? color;
  final Color? background;

  /// False inside another card (no card of its own, no side padding).
  final bool card;

  const IconTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.footnote,
    this.onTap,
    this.trailing,
    this.color,
    this.background,
    this.card = true,
  });

  static const double badge = 40;

  @override
  Widget build(BuildContext context) {
    final end =
        trailing ??
        (onTap == null
            ? null
            : Icon(Icons.chevron_right, color: AppColors.grey500));
    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: badge,
          height: badge,
          decoration: BoxDecoration(
            color: background ?? AppColors.lightOrange,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 22, color: color ?? AppColors.primary),
        ),
        AppGaps.w16,
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTextStyles.heading3),
              if (subtitle != null)
                Text(subtitle!, style: AppTextStyles.caption),
              if (footnote != null) ...[
                AppGaps.h4,
                Text(footnote!, style: AppTextStyles.caption),
              ],
            ],
          ),
        ),
        if (end != null) ...[
          AppGaps.w8,
          SizedBox(
            height: badge,
            child: Center(child: end),
          ),
        ],
      ],
    );

    final body = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: card ? const EdgeInsets.all(16) : EdgeInsets.zero,
        child: row,
      ),
    );
    return card ? AppCard(padding: EdgeInsets.zero, child: body) : body;
  }
}
