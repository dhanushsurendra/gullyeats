import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_padding.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_back_button.dart';

class BaseScreen extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final Widget child;
  final VoidCallback? onBack;
  final bool centerContent;
  final Widget? header;
  final bool expandToFullHeight;
  final bool showBackButton;
  final Widget? bottomNavigationBar;

  const BaseScreen({
    super.key,
    this.title,
    this.subtitle,
    required this.child,
    this.onBack,
    this.expandToFullHeight = false,
    this.centerContent = false,
    this.header,
    this.showBackButton = true,
    this.bottomNavigationBar,
  });

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (header != null)
          header!
        else ...[
          if (title != null)
            Text(title!, style: AppTextStyles.heading1),
          if (subtitle != null && subtitle!.isNotEmpty) ...[
            AppGaps.h4,
            Text(
              subtitle!,
              style: AppTextStyles.body.copyWith(
                color: AppColors.grey400,
              ),
            ),
          ],
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: expandToFullHeight
            ? Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Padding(
                    padding: AppPadding.screen,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (showBackButton && onBack != null) ...[
                          AppBackButton(),
                          AppGaps.h16,
                        ],
                        _buildHeader(),
                        AppGaps.h32,
                        Expanded(child: child),
                      ],
                    ),
                  ),
                ),
              )
            : SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: AppPadding.screen.add(
                  EdgeInsets.only(bottom: bottomInset + 80),
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (showBackButton && onBack != null) ...[
                          AppBackButton(),
                          AppGaps.h16,
                        ],

                        _buildHeader(),

                        AppGaps.h32,

                        child,
                      ],
                    ),
                  ),
                ),
              ),
      ),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}