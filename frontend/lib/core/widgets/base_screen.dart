import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_padding.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_back_button.dart';
import 'package:gullyeats/core/widgets/theme_toggle.dart';

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

  // Back (when there is one) on the left, the theme switch on the right.
  Widget _buildTopBar() {
    return Row(
      children: [
        if (showBackButton && onBack != null) AppBackButton(onPressed: onBack),
        const Spacer(),
        const ThemeToggle(),
      ],
    );
  }

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
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: expandToFullHeight
            ? Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: LayoutBuilder(builder: _buildExpanded),
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
                        _buildTopBar(),
                        AppGaps.h16,

                        _buildHeader(),

                        AppGaps.h32,

                        child,
                      ],
                    ),
                  ),
                ),
              ),
      ),
      bottomNavigationBar: bottomNavigationBar == null
          ? null
          // Same max width as the body so footer buttons don't stretch on tablets.
          : Center(
              heightFactor: 1,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500),
                child: bottomNavigationBar,
              ),
            ),
    );
  }

  Widget _buildExpanded(BuildContext context, BoxConstraints constraints) {
    final top = [
      _buildTopBar(),
      AppGaps.h16,
      _buildHeader(),
      AppGaps.h32,
    ];

    // Short windows (keyboard open on small phones, split screen) would squeeze
    // the child to nothing: scroll the header away and give the child a full
    // viewport instead.
    if (constraints.maxHeight < _minExpandedHeight) {
      return SingleChildScrollView(
        padding: AppPadding.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...top,
            SizedBox(
              height: constraints.maxHeight - AppPadding.screen.vertical,
              child: child,
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: AppPadding.screen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [...top, Expanded(child: child)],
      ),
    );
  }
}

const double _minExpandedHeight = 480;