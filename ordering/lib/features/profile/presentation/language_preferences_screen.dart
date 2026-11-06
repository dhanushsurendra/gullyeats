import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

class LanguagePreferencesScreen extends StatefulWidget {
  const LanguagePreferencesScreen({super.key});

  @override
  State<LanguagePreferencesScreen> createState() =>
      _LanguagePreferencesScreenState();
}

class _LanguagePreferencesScreenState
    extends State<LanguagePreferencesScreen> {
  /// English names too, so typing "Hindi" finds हिन्दी.
  static const _englishNames = {'en': 'English', 'kn': 'Kannada', 'hi': 'Hindi'};

  String selectedCode = LanguageProvider.current.languageCode;
  String searchQuery = "";

  List<String> get filteredLanguages {
    final query = searchQuery.toLowerCase();
    return LanguageProvider.languages.keys
        .where((code) =>
            LanguageProvider.languages[code]!.toLowerCase().contains(query) ||
            _englishNames[code]!.toLowerCase().contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      /// 🔶 APP BAR
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.black),
          onPressed: () => Navigator.pop(context),
        ),
      ),

      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: AppPadding.screen,
              children: [
                /// 🔶 TITLE
                Text(
                  context.l10n.languagePreferences,
                  style: AppTextStyles.heading1,
                ),
                AppGaps.h4,
                Text(
                  context.l10n.chooseLanguageSubtitle,
                  style: AppTextStyles.caption,
                ),

                AppGaps.h16,

                /// 🔶 CURRENT LANGUAGE
                AppCard(
                  padding: AppPadding.card,
                  child: Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        children: [
                          Text(context.l10n.currentLanguage,
                              style: AppTextStyles.caption),
                          AppGaps.h4,
                          Text(
                            LanguageProvider.languages[context
                                .watch<LanguageProvider>()
                                .locale
                                .languageCode]!,
                            style: AppTextStyles.heading3,
                          ),
                          AppGaps.h4,
                          Text(
                            context.l10n.supportedLanguages,
                            style: AppTextStyles.caption,
                          ),
                        ],
                      ),

                      Container(
                        padding: AppPadding.chip,
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.1),
                          borderRadius:
                              BorderRadius.circular(20),
                        ),
                        child: Text(
                          context.l10n.selected,
                          style:
                              AppTextStyles.caption.copyWith(
                            color: AppColors.success,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    ],
                  ),
                ),

                AppGaps.h16,

                AppSearchBar(
                  onChanged: (val) =>
                      setState(() => searchQuery = val),
                  hintText: context.l10n.searchLanguage,
                ),

                AppGaps.h16,

                /// 🔶 LIST HEADER
                Text(
                  context.l10n.availableLanguages,
                  style: AppTextStyles.heading3,
                ),

                AppGaps.h12,

                /// 🔶 LANGUAGE LIST
                ...filteredLanguages.map(
                  (lang) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _languageTile(lang),
                  ),
                ),

                AppGaps.h16,

                /// 🔶 INFO
                AppCard(
                  padding: AppPadding.smallCard,
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          size: 16, color: AppColors.grey500),
                      AppGaps.w8,
                      Expanded(
                        child: Text(
                          context.l10n.menuItemsUnchanged,
                          style: AppTextStyles.caption,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          /// 🔶 BOTTOM ACTION
          Padding(
            padding: AppPadding.screen,
            child: Column(
              children: [
                AppButton(
                  onPressed: () async {
                    await context
                        .read<LanguageProvider>()
                        .setLanguage(selectedCode);
                    if (context.mounted) Navigator.pop(context);
                  },
                  label: context.l10n.saveLanguageCaps,
                ),
                AppGaps.h8,
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Text(
                    context.l10n.cancel,
                    style: AppTextStyles.caption.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 🔶 LANGUAGE TILE
  Widget _languageTile(String code) {
    final isSelected = selectedCode == code;

    return GestureDetector(
      onTap: () => setState(() => selectedCode = code),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: AppPadding.card,
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: isSelected
              ? Border.all(
                  color: AppColors.primary,
                  width: 2,
                )
              : null,
          boxShadow: [
            BoxShadow(
              color: AppColors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Row(
          mainAxisAlignment:
              MainAxisAlignment.spaceBetween,
          children: [
            Text(
              LanguageProvider.languages[code]!,
              style: AppTextStyles.body.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),

            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary
                      : AppColors.grey300,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}